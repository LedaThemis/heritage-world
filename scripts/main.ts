// TODO: Side panel: Implement "see more" instead of scrollbar
// TODO: Make side panel a grid
// TODO: Remove subtitle when entering virtual world
// TODO: Menu button (works with ESC)
// TODO: Players count next to "ONLINE" with person head icon
// TODO: Change "Start Experience" to be inside box on floating description

import {
    Engine,
    Scene,
    Vector3,
    Color3,
    HemisphericLight,
    MeshBuilder,
    ArcRotateCamera,
    PointerEventTypes,
    HavokPlugin,
    PhysicsAggregate,
    PhysicsShapeType,
    UniversalCamera,
    StandardMaterial,
    CubeTexture,
    Mesh,
    DynamicTexture,
    Animation,
    CubicEase,
    EasingFunction,
    Color4,
    ImportMeshAsync,
    TransformNode,
    SSAO2RenderingPipeline,
    Quaternion,
    AbstractMesh,
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { Client, getStateCallbacks, Room } from "colyseus.js";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";

interface PlayerRoomType {
    players: {
        x: number;
        y: number;
        z: number;
        rotX?: number;
        rotY?: number;
        rotZ?: number;
        rotW?: number;
        name?: string;
    }[];
}

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;

if (!canvas) {
    throw new Error("Canvas element not found.");
}

const GND_WIDTH = 50;
const GND_HEIGHT = 50;
const PLAYER_HEIGHT = 2;
const PLAYER_WIDTH = 1;

const ADJECTIVES = ["Brave", "Swift", "Clever", "Gentle", "Lucky", "Nimble", "Calm", "Bright"];
const ANIMALS = ["Fox", "Otter", "Panda", "Hawk", "Wolf", "Dolphin", "Lynx", "Koala"];

const generateFriendlyName = (): string => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    return `${adj} ${animal}`;
};

const engine = new Engine(canvas, true);
let activeScene: Scene | null = null;
let gameStarted = false;
let selectedSite: { worldModelPath: string | null } | null = null;
const playerEntities: { [key: string]: Mesh | TransformNode } = {};
const playerNextPosition: { [key: string]: Vector3 } = {};
const playerNextRotation: { [key: string]: Quaternion } = {};
const playerLabels: { [key: string]: Mesh } = {};

const setupScene = function (engine: Engine) {
    const scene = new Scene(engine);
    scene.collisionsEnabled = true;
    return scene;
};

const setupLight = function (scene: Scene) {
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    return light;
};

const setupSkybox = function (scene: Scene) {
    const skyBoxTexture = new CubeTexture("./assets/textures/skybox/skybox", scene);
    scene.createDefaultSkybox(skyBoxTexture, true, 1000);
};

const createPlayerMesh = function (scene: Scene) {
    const playerMesh = MeshBuilder.CreateCapsule(
        "player",
        {
            height: PLAYER_HEIGHT,
            radius: PLAYER_WIDTH / 2,
        },
        scene
    );
    playerMesh.position = new Vector3(0, PLAYER_HEIGHT / 2, 0);

    // Make player mesh transparent
    const playerMaterial = new StandardMaterial("player_mat", scene);
    playerMaterial.diffuseColor = new Color3(1, 1, 1);
    playerMaterial.alpha = 0;
    playerMesh.material = playerMaterial;

    // Enable collision on base
    playerMesh.checkCollisions = true;

    return playerMesh;
};

const createNameLabel = (name: string, scene: Scene) => {
    const plane = MeshBuilder.CreatePlane("nameplate", { size: 2 }, scene);
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;
    plane.position.y = 2.5;
    plane.scaling.y = -1; // flip so text is upright

    const texture = new DynamicTexture("nameplate-texture", { width: 256, height: 128 }, scene, false);
    texture.hasAlpha = true;
    texture.drawText(name, null, 80, "bold 36px Arial", "white", "transparent", true);

    const mat = new StandardMaterial("nameplate-mat", scene);
    mat.diffuseTexture = texture;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.backFaceCulling = false;

    plane.material = mat;
    return plane;
};

const createBillboardLabel = (text: string, scene: Scene) => {
    // Calculate dimensions based on text length
    const textLength = text.length;
    const textureWidth = Math.max(512, textLength * 80);
    const textureHeight = 128;
    const planeWidth = Math.max(4, textLength * 0.5);
    const planeHeight = 1;

    const plane = MeshBuilder.CreatePlane(`map-label-${text}`, { width: planeWidth, height: planeHeight }, scene);
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;
    plane.position.y = 2.5;

    const texture = new DynamicTexture(
        `map-label-texture-${text}`,
        { width: textureWidth, height: textureHeight },
        scene,
        false
    );
    texture.hasAlpha = true;
    texture.drawText(text, null, null, "bold 128px Arial", "white", "transparent", true, true);

    const mat = new StandardMaterial(`map-label-mat-${text}`, scene);
    mat.diffuseTexture = texture;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.backFaceCulling = false;

    plane.material = mat;
    return plane;
};

const updateNameLabel = (labelMesh: Mesh | undefined, name: string) => {
    if (!labelMesh || !labelMesh.material) return;
    const mat = labelMesh.material as StandardMaterial;
    const texture = mat.diffuseTexture as DynamicTexture | null;
    if (!texture) return;
    texture.clear();
    texture.drawText(name, null, 80, "bold 36px Arial", "white", "transparent", true);
    texture.update(false);
};

const setupCamera = function (canvas: HTMLCanvasElement, scene: Scene, room: Room) {
    const playerMesh = createPlayerMesh(scene);

    // Create camera
    const camera = new UniversalCamera("player_camera", new Vector3(0, PLAYER_HEIGHT, 0), scene);
    camera.attachControl(canvas, true);
    camera.touchAngularSensibility = Infinity; // Disable default touch rotation
    camera.touchMoveSensibility = Infinity; // Disable default touch movement
    camera.parent = playerMesh;

    // Disable arrow keys
    camera.keysUp = [];
    camera.keysDown = [];
    camera.keysLeft = [];
    camera.keysRight = [];

    // Input handling for WASD movement and jumping
    const inputMap: { [key: string]: boolean } = {};
    const moveSpeed = 0.15;
    const jumpForce = 0.3;
    const gravity = 0.02;
    let verticalVelocity = 0;
    let isGrounded = false;
    let lastPositionSend = 0;
    let lastSentRotation = Quaternion.FromEulerAngles(0, 0, 0);
    const positionSendIntervalMs = 100;

    window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "escape") {
            document.exitPointerLock();
        } else {
            inputMap[e.key.toUpperCase()] = true;
            // Handle jumping
            if (e.key === " " && isGrounded) {
                verticalVelocity = jumpForce;
                isGrounded = false;
            }
        }
    });

    window.addEventListener("keyup", (e) => {
        inputMap[e.key.toUpperCase()] = false;
    });

    // Mobile touch controls
    let lastTouchX = 0;
    let lastTouchY = 0;
    const lookSensitivity = 0.005;

    const isMobile = () => {
        return (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            navigator.maxTouchPoints > 0
        );
    };

    const setupMobileControls = () => {
        // Only show on mobile
        if (!isMobile()) return;

        // Left side: movement joystick area
        const joystickContainer = document.createElement("div");
        joystickContainer.style.position = "fixed";
        joystickContainer.style.bottom = "20px";
        joystickContainer.style.left = "20px";
        joystickContainer.style.width = "120px";
        joystickContainer.style.height = "120px";
        joystickContainer.style.borderRadius = "50%";
        joystickContainer.style.background = "rgba(255, 255, 255, 0.1)";
        joystickContainer.style.border = "2px solid rgba(255, 255, 255, 0.3)";
        joystickContainer.style.zIndex = "100";
        joystickContainer.style.touchAction = "none";

        const joystickHandle = document.createElement("div");
        joystickHandle.style.position = "absolute";
        joystickHandle.style.width = "40px";
        joystickHandle.style.height = "40px";
        joystickHandle.style.borderRadius = "50%";
        joystickHandle.style.background = "rgba(255, 255, 255, 0.3)";
        joystickHandle.style.top = "50%";
        joystickHandle.style.left = "50%";
        joystickHandle.style.transform = "translate(-50%, -50%)";
        joystickHandle.style.transition = "all 0.1s ease-out";

        joystickContainer.appendChild(joystickHandle);
        document.body.appendChild(joystickContainer);

        // Right side: look around area (invisible touch zone)
        const lookZone = document.createElement("div");
        lookZone.style.position = "fixed";
        lookZone.style.right = "0";
        lookZone.style.top = "0";
        lookZone.style.width = "50%";
        lookZone.style.height = "100%";
        lookZone.style.zIndex = "1";
        lookZone.style.touchAction = "none";
        document.body.appendChild(lookZone);

        // Jump button
        const jumpBtn = document.createElement("button");
        jumpBtn.textContent = "↑";
        jumpBtn.style.position = "fixed";
        jumpBtn.style.bottom = "40px";
        jumpBtn.style.right = "40px";
        jumpBtn.style.padding = "15px 25px";
        jumpBtn.style.fontSize = "16px";
        jumpBtn.style.background = "#3b82f6";
        jumpBtn.style.color = "white";
        jumpBtn.style.border = "none";
        jumpBtn.style.borderRadius = "50%";
        jumpBtn.style.aspectRatio = "1";
        jumpBtn.style.cursor = "pointer";
        jumpBtn.style.zIndex = "100";
        jumpBtn.style.touchAction = "manipulation";
        document.body.appendChild(jumpBtn);

        jumpBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            if (isGrounded) {
                verticalVelocity = jumpForce;
                isGrounded = false;
            }
        });

        // Joystick touch handler
        let joystickTouchId: number | null = null;
        joystickContainer.addEventListener("touchstart", (e) => {
            joystickTouchId = e.touches[0].identifier;
            updateJoystick(e);
        });

        joystickContainer.addEventListener("touchmove", (e) => {
            updateJoystick(e);
        });

        const clearJoystick = () => {
            joystickTouchId = null;
            inputMap["W"] = false;
            inputMap["A"] = false;
            inputMap["S"] = false;
            inputMap["D"] = false;
            joystickHandle.style.transform = "translate(-50%, -50%)";
        };

        joystickContainer.addEventListener("touchend", clearJoystick);
        joystickContainer.addEventListener("touchcancel", clearJoystick);

        const updateJoystick = (e: TouchEvent) => {
            const rect = joystickContainer.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const touch = Array.from(e.touches).find((t) => t.identifier === joystickTouchId) || e.touches[0];
            const dx = touch.clientX - centerX;
            const dy = touch.clientY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = 50;

            // Update handle position
            const handleDistance = Math.min(distance, maxDistance);
            const angle = Math.atan2(dy, dx);
            const handleX = centerX + Math.cos(angle) * handleDistance;
            const handleY = centerY + Math.sin(angle) * handleDistance;
            const offsetX = handleX - rect.left - rect.width / 2;
            const offsetY = handleY - rect.top - rect.height / 2;
            joystickHandle.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;

            // Update movement based on joystick position
            inputMap["W"] = false;
            inputMap["A"] = false;
            inputMap["S"] = false;
            inputMap["D"] = false;

            const threshold = 15;
            if (dy < -threshold) inputMap["W"] = true;
            if (dy > threshold) inputMap["S"] = true;
            if (dx < -threshold) inputMap["A"] = true;
            if (dx > threshold) inputMap["D"] = true;
        };

        // Look around with right side touch
        lookZone.addEventListener("touchstart", (e) => {
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
        });

        lookZone.addEventListener("touchmove", (e) => {
            const touch = e.touches[0];
            const deltaX = touch.clientX - lastTouchX;
            const deltaY = touch.clientY - lastTouchY;

            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;

            // Rotate camera based on touch movement
            camera.rotation.y -= deltaX * lookSensitivity;
            camera.rotation.x -= deltaY * lookSensitivity;

            // Clamp vertical look
            camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
        });
    };

    setupMobileControls();

    // Request pointer lock on canvas click
    canvas.addEventListener("click", () => {
        canvas.requestPointerLock();
    });

    // Movement loop
    scene.registerBeforeRender(() => {
        // Get forward and right directions relative to camera's horizontal rotation only
        const forward = camera.getDirection(Vector3.Forward());
        const right = camera.getDirection(Vector3.Right());

        forward.y = 0;
        right.y = 0;

        // Normalize after zeroing Y
        forward.normalize();
        right.normalize();

        // Apply gravity
        verticalVelocity -= gravity;
        playerMesh.position.y += verticalVelocity;

        // Ground check
        const groundLevel = 1; // Half of capsule height
        if (playerMesh.position.y <= groundLevel) {
            playerMesh.position.y = groundLevel;
            verticalVelocity = 0;
            isGrounded = true;
        } else {
            isGrounded = false;
        }

        const movement = new Vector3(0, 0, 0);

        if (inputMap["W"]) {
            movement.addInPlace(forward.scale(moveSpeed));
        }
        if (inputMap["S"]) {
            movement.subtractInPlace(forward.scale(moveSpeed));
        }
        if (inputMap["A"]) {
            movement.subtractInPlace(right.scale(moveSpeed));
        }
        if (inputMap["D"]) {
            movement.addInPlace(right.scale(moveSpeed));
        }

        playerMesh.moveWithCollisions(movement);

        // Debounced position and rotation updates to server
        const now = performance.now();
        const currentQuat = Quaternion.FromEulerAngles(camera.rotation.x, camera.rotation.y, camera.rotation.z);
        const rotationChanged =
            Math.abs(currentQuat.x - lastSentRotation.x) > 0.01 ||
            Math.abs(currentQuat.y - lastSentRotation.y) > 0.01 ||
            Math.abs(currentQuat.z - lastSentRotation.z) > 0.01 ||
            Math.abs(currentQuat.w - lastSentRotation.w) > 0.01;

        if (
            (movement.x !== 0 || movement.y !== 0 || movement.z !== 0 || rotationChanged) &&
            now - lastPositionSend >= positionSendIntervalMs
        ) {
            lastPositionSend = now;
            lastSentRotation = currentQuat.clone();
            if (room) {
                room.send("updatePosition", {
                    x: playerMesh.position.x,
                    y: playerMesh.position.y + 1,
                    z: playerMesh.position.z,
                    rotX: currentQuat.x,
                    rotY: currentQuat.y,
                    rotZ: currentQuat.z,
                    rotW: currentQuat.w,
                });
            }
        }
    });

    return { camera, playerMesh };
};

const createScene = async function (nickname: string, worldModelPath?: string | null) {
    const scene = setupScene(engine);

    const gravityVector = new Vector3(0, -9.81, 0);
    const havokInstance = await HavokPhysics();
    const physicsPlugin = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(gravityVector, physicsPlugin);

    // Create connection status header
    const statusHeader = document.createElement("div");
    statusHeader.textContent = "CONNECTING...";
    statusHeader.style.position = "fixed";
    statusHeader.style.top = "20px";
    statusHeader.style.right = "20px";
    statusHeader.style.padding = "8px 16px";
    statusHeader.style.fontSize = "14px";
    statusHeader.style.fontWeight = "bold";
    statusHeader.style.color = "white";
    statusHeader.style.background = "rgba(200, 200, 0, 0.7)";
    statusHeader.style.borderRadius = "6px";
    statusHeader.style.zIndex = "100";
    statusHeader.style.fontFamily = "monospace";
    document.body.appendChild(statusHeader);

    const updateStatus = (status: "ONLINE" | "OFFLINE") => {
        statusHeader.textContent = status;
        if (status === "ONLINE") {
            statusHeader.style.background = "rgba(0, 200, 0, 0.7)";
        } else {
            statusHeader.style.background = "rgba(200, 0, 0, 0.7)";
        }
    };

    const client = new Client(import.meta.env.VITE_SERVER_URL);
    let room: Room | null;
    try {
        room = await client.joinOrCreate("central", { nickname });
        room.send("setName", { name: nickname });
        const $ = getStateCallbacks<PlayerRoomType>(room);

        // Update status to online when connected
        updateStatus("ONLINE");

        // Listen for disconnect events
        room.onLeave((code) => {
            console.log("Disconnected from server:", code);
            updateStatus("OFFLINE");
        });

        room.onError((code, message) => {
            console.error("Room error:", code, message);
            updateStatus("OFFLINE");
        });

        $(room.state).players.onAdd(async (player, sessionId) => {
            const isCurrentPlayer = sessionId === room?.sessionId;

            // create player Sphere
            if (isCurrentPlayer) {
                playerMesh.position.set(player.x, player.y, player.z);
            } else {
                // Load eva.gltf model for remote players
                const modelData = await ImportMeshAsync("./assets/models/eva.glb", scene);
                const rootMesh = modelData.meshes[0];

                modelData.animationGroups.forEach((animationGroup) => {
                    animationGroup.stop();
                });

                // Create parent container for positioning
                const remotePlayerContainer = new TransformNode(`player-${sessionId}`, scene);
                remotePlayerContainer.position.set(player.x, player.y, player.z);
                remotePlayerContainer.scaling = new Vector3(1, 1, 1);

                // Parent all meshes to the container
                modelData.meshes.forEach((mesh) => {
                    if (mesh.parent === null) {
                        mesh.parent = remotePlayerContainer;
                    }
                    mesh.isPickable = false;
                });

                playerEntities[sessionId] = remotePlayerContainer;
                playerNextPosition[sessionId] = remotePlayerContainer.position.clone();
                playerNextRotation[sessionId] = remotePlayerContainer.rotationQuaternion || Quaternion.Identity();

                const label = createNameLabel(player.name ?? "Player", scene);
                label.parent = remotePlayerContainer;
                playerLabels[sessionId] = label;
            }

            $(player).onChange(function () {
                if (isCurrentPlayer) {
                } else {
                    playerNextPosition[sessionId].set(player.x, player.y, player.z);
                    if (
                        player.rotX !== undefined &&
                        player.rotY !== undefined &&
                        player.rotZ !== undefined &&
                        player.rotW !== undefined
                    ) {
                        playerNextRotation[sessionId] = new Quaternion(
                            player.rotX,
                            player.rotY,
                            player.rotZ,
                            player.rotW
                        );
                    }
                    if (player.name) {
                        updateNameLabel(playerLabels[sessionId], player.name);
                    }
                }
            });
        });

        $(room.state).players.onRemove(function (player, sessionId) {
            playerEntities[sessionId].dispose();
            delete playerEntities[sessionId];
            delete playerNextRotation[sessionId];
            playerLabels[sessionId]?.dispose();
            delete playerLabels[sessionId];
        });
    } catch (error) {
        console.error("Room error:", error);
        updateStatus("OFFLINE");
    }

    const { camera, playerMesh } = setupCamera(canvas, scene, room!);
    setupLight(scene);
    setupSkybox(scene);

    // Enable ambient occlusion
    const ssao = new SSAO2RenderingPipeline("ssao", scene, {
        ssaoRatio: 0.5,
        blurRatio: 1,
    });
    ssao.radius = 2;
    ssao.totalStrength = 1.3;
    ssao.expensiveBlur = true;
    ssao.samples = 16;
    ssao.maxZ = 250;
    scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);

    let ground: AbstractMesh | TransformNode;
    if (worldModelPath) {
        // Load custom world model
        const worldModel = await ImportMeshAsync(worldModelPath, scene);
        const rootMesh = worldModel.meshes[0];

        // Create parent transform node for the world model
        const worldParent = new TransformNode("world_parent", scene);
        worldParent.rotation.y = 0;
        worldParent.scaling = new Vector3(2, 2, 2);

        if (rootMesh) {
            // Calculate bounding box to find center
            const boundingInfo = rootMesh.getHierarchyBoundingVectors();
            const center = boundingInfo.max.add(boundingInfo.min).scale(0.5);

            // Move model so its center is at origin
            rootMesh.position.subtractInPlace(center);
        }

        // Parent all meshes to the transform node
        worldModel.meshes.forEach((mesh) => {
            if (mesh.parent === null) {
                mesh.parent = worldParent;
            }
            mesh.checkCollisions = true;
        });

        ground = worldParent;
        // ground.checkCollisions = true;
    } else {
        // Use default ground plane
        const defaultWorld = MeshBuilder.CreateGround("ground", { width: GND_WIDTH, height: GND_HEIGHT }, scene);
        defaultWorld.checkCollisions = true;
        ground = defaultWorld;
    }

    // Remote Movement Loop
    scene.registerBeforeRender(() => {
        for (const sessionId in playerEntities) {
            const entity = playerEntities[sessionId];
            const targetPosition = playerNextPosition[sessionId];
            const targetRotation = playerNextRotation[sessionId];
            entity.position = Vector3.Lerp(entity.position, targetPosition, 0.05);
            if (targetRotation) {
                entity.rotationQuaternion = Quaternion.Slerp(
                    entity.rotationQuaternion ?? Quaternion.Identity(),
                    targetRotation,
                    0.05
                );
            }
        }
    });

    return scene;
};

const createMapScene = async () => {
    const scene = setupScene(engine);
    scene.collisionsEnabled = false;

    const camera = new ArcRotateCamera("map_camera", -Math.PI / 2, Math.PI / 3, 60, Vector3.Zero(), scene);
    camera.lowerBetaLimit = Math.PI / 6;
    camera.upperBetaLimit = Math.PI / 2.2;
    camera.lowerRadiusLimit = 20;
    camera.upperRadiusLimit = 80;
    camera.attachControl(canvas, true);

    setupLight(scene);
    scene.clearColor = new Color4(220 / 255, 220 / 255, 220 / 255, 1);

    // Enable ambient occlusion
    const ssao = new SSAO2RenderingPipeline("ssao", scene, {
        ssaoRatio: 0.5,
        blurRatio: 1,
    });
    ssao.radius = 2;
    ssao.totalStrength = 1.3;
    ssao.expensiveBlur = true;
    ssao.samples = 16;
    ssao.maxZ = 250;
    scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);

    // Create container for left-side UI elements
    const leftContainer = document.createElement("div");
    leftContainer.style.position = "fixed";
    leftContainer.style.top = "20px";
    leftContainer.style.left = "20px";
    leftContainer.style.zIndex = "100";
    leftContainer.style.display = "flex";
    leftContainer.style.flexDirection = "column";
    leftContainer.style.gap = "20px";
    leftContainer.style.maxWidth = "390px";
    document.body.appendChild(leftContainer);

    // Create website header in top left
    const websiteHeader = document.createElement("div");
    websiteHeader.style.padding = "20px";
    websiteHeader.style.background = "rgba(0, 0, 0, 0.85)";
    websiteHeader.style.borderRadius = "8px";
    websiteHeader.style.color = "white";
    websiteHeader.style.fontFamily = "sans-serif";
    websiteHeader.style.pointerEvents = "none";

    const mainTitle = document.createElement("h1");
    mainTitle.textContent = "Heritage Iraq";
    mainTitle.style.margin = "0";
    mainTitle.style.fontSize = "32px";
    mainTitle.style.fontWeight = "bold";
    mainTitle.style.letterSpacing = "0.5px";
    websiteHeader.appendChild(mainTitle);

    const subtitle = document.createElement("p");
    subtitle.textContent = "A 3D Interactive Heritage Experience";
    subtitle.style.margin = "4px 0 0 0";
    subtitle.style.fontSize = "14px";
    subtitle.style.fontWeight = "300";
    subtitle.style.opacity = "0.9";
    subtitle.style.letterSpacing = "0.3px";
    websiteHeader.appendChild(subtitle);

    leftContainer.appendChild(websiteHeader);

    // Create info panel (left side)
    const infoPanel = document.createElement("div");
    infoPanel.style.width = "350px";
    infoPanel.style.maxHeight = "calc(100vh - 200px)";
    infoPanel.style.overflowY = "auto";
    infoPanel.style.background = "rgba(0, 0, 0, 0.85)";
    infoPanel.style.borderRadius = "12px";
    infoPanel.style.padding = "20px";
    infoPanel.style.color = "white";
    infoPanel.style.fontFamily = "sans-serif";
    leftContainer.appendChild(infoPanel);

    // Info panel header
    const infoPanelHeader = document.createElement("h2");
    infoPanelHeader.textContent = "About";
    infoPanelHeader.style.margin = "0 0 16px 0";
    infoPanelHeader.style.fontSize = "24px";
    infoPanelHeader.style.fontWeight = "bold";
    infoPanel.appendChild(infoPanelHeader);

    // Info panel content
    const infoContent = document.createElement("p");
    infoContent.textContent =
        "Explore Iraq's rich cultural heritage through this immersive 3D experience. Navigate through historic sites, ancient cities, and natural wonders that have shaped the cradle of civilization for millennia.";
    infoContent.style.margin = "0 0 20px 0";
    infoContent.style.fontSize = "14px";
    infoContent.style.lineHeight = "1.6";
    infoContent.style.color = "rgba(255, 255, 255, 0.9)";
    infoPanel.appendChild(infoContent);

    const creditsLink = document.createElement("a");
    creditsLink.textContent = "Learn more →";
    creditsLink.href = "/credits";
    creditsLink.style.color = "#60a5fa";
    creditsLink.style.fontSize = "13px";
    creditsLink.style.textDecoration = "none";
    creditsLink.style.fontWeight = "500";
    creditsLink.style.transition = "color 0.2s ease";
    creditsLink.style.pointerEvents = "auto";
    creditsLink.addEventListener("mouseenter", () => {
        creditsLink.style.color = "#93c5fd";
    });
    creditsLink.addEventListener("mouseleave", () => {
        creditsLink.style.color = "#60a5fa";
    });
    infoPanel.appendChild(creditsLink);

    // Create header with tip
    const headerTip = document.createElement("div");
    headerTip.textContent = "Tip: click on a site for more details";
    headerTip.style.position = "fixed";
    headerTip.style.top = "20px";
    headerTip.style.left = "50%";
    headerTip.style.transform = "translateX(-50%)";
    headerTip.style.padding = "12px 24px";
    headerTip.style.fontSize = "18px";
    headerTip.style.fontWeight = "500";
    headerTip.style.color = "white";
    headerTip.style.background = "rgba(0, 0, 0, 0.5)";
    headerTip.style.borderRadius = "8px";
    headerTip.style.zIndex = "100";
    headerTip.style.pointerEvents = "none";
    headerTip.style.opacity = "0"; // TODO: Do we show or hide it? It makes the site "cluttery"
    document.body.appendChild(headerTip);

    // Create side panel
    const sidePanel = document.createElement("div");
    sidePanel.style.width = "350px";
    sidePanel.style.maxHeight = "calc(60vh - 40px - 40px)";
    sidePanel.style.overflowY = "auto";
    sidePanel.style.background = "rgba(0, 0, 0, 0.85)";
    sidePanel.style.borderRadius = "12px";
    sidePanel.style.padding = "20px";
    sidePanel.style.color = "white";
    sidePanel.style.fontFamily = "sans-serif";

    // Custom scrollbar styling
    const style = document.createElement("style");
    style.textContent = `
        .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
        }
    `;
    document.head.appendChild(style);
    sidePanel.classList.add("custom-scrollbar");

    leftContainer.appendChild(sidePanel);

    // Panel header
    const panelHeader = document.createElement("h2");
    panelHeader.textContent = "Heritage Sites";
    panelHeader.style.position = "relative";
    panelHeader.style.top = "0";
    panelHeader.style.margin = "0 0 16px 0";
    panelHeader.style.fontSize = "24px";
    panelHeader.style.fontWeight = "bold";
    sidePanel.appendChild(panelHeader);

    // Create description box (hidden by default)
    const descriptionBox = document.createElement("div");
    descriptionBox.style.position = "fixed";
    descriptionBox.style.bottom = "0px";
    descriptionBox.style.right = "0";
    descriptionBox.style.padding = "16px 24px";
    descriptionBox.style.margin = "20px";
    descriptionBox.style.maxWidth = "500px";
    descriptionBox.style.fontSize = "20px";
    descriptionBox.style.lineHeight = "1.5";
    descriptionBox.style.color = "white";
    descriptionBox.style.background = "rgba(0, 0, 0, 0.7)";
    descriptionBox.style.borderRadius = "8px";
    descriptionBox.style.zIndex = "100";
    descriptionBox.style.display = "none";
    descriptionBox.style.textAlign = "center";
    document.body.appendChild(descriptionBox);

    // Create Start Experience button (hidden by default)
    const startExperienceBtn = document.createElement("button");
    startExperienceBtn.textContent = "Start Experience";
    startExperienceBtn.style.position = "fixed";
    startExperienceBtn.style.bottom = "0px";
    startExperienceBtn.style.right = "0px";
    startExperienceBtn.style.margin = "20px";
    startExperienceBtn.style.padding = "12px 24px";
    startExperienceBtn.style.fontSize = "24px";
    startExperienceBtn.style.fontWeight = "bold";
    startExperienceBtn.style.background = "#3b82f6";
    startExperienceBtn.style.color = "white";
    startExperienceBtn.style.border = "none";
    startExperienceBtn.style.borderRadius = "8px";
    startExperienceBtn.style.cursor = "pointer";
    startExperienceBtn.style.zIndex = "100";
    startExperienceBtn.style.display = "none";
    startExperienceBtn.style.transition = "opacity 0.3s ease";
    document.body.appendChild(startExperienceBtn);

    let currentFocusedSite: string | null = null;

    // Reusable function to animate camera focus
    const animateCameraFocus = (
        targetPosition: Vector3,
        targetRadius: number,
        targetAlpha?: number,
        animationDuration = 60,
        onComplete?: () => void
    ) => {
        const animations: Animation[] = [];

        // Animate camera target
        const targetAnimation = new Animation(
            "cameraTargetAnimation",
            "target",
            60,
            Animation.ANIMATIONTYPE_VECTOR3,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        targetAnimation.setKeys([
            { frame: 0, value: camera.target.clone() },
            { frame: animationDuration, value: targetPosition },
        ]);

        const easingFunction = new CubicEase();
        easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        targetAnimation.setEasingFunction(easingFunction);
        animations.push(targetAnimation);

        // Animate camera radius
        const radiusAnimation = new Animation(
            "cameraRadiusAnimation",
            "radius",
            60,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        radiusAnimation.setKeys([
            { frame: 0, value: camera.radius },
            { frame: animationDuration, value: targetRadius },
        ]);
        radiusAnimation.setEasingFunction(easingFunction);
        animations.push(radiusAnimation);

        // Optionally animate camera alpha (horizontal rotation)
        if (targetAlpha !== undefined) {
            const currentAlpha = camera.alpha;
            let deltaAlpha = targetAlpha - currentAlpha;

            // Normalize to [-PI, PI] for shortest rotation path
            while (deltaAlpha > Math.PI) deltaAlpha -= 2 * Math.PI;
            while (deltaAlpha < -Math.PI) deltaAlpha += 2 * Math.PI;

            const finalAlpha = currentAlpha + deltaAlpha;

            const alphaAnimation = new Animation(
                "cameraAlphaAnimation",
                "alpha",
                60,
                Animation.ANIMATIONTYPE_FLOAT,
                Animation.ANIMATIONLOOPMODE_CONSTANT
            );
            alphaAnimation.setKeys([
                { frame: 0, value: currentAlpha },
                { frame: animationDuration, value: finalAlpha },
            ]);
            alphaAnimation.setEasingFunction(easingFunction);
            animations.push(alphaAnimation);
        }

        // Apply animations
        camera.animations = animations;
        const animatable = scene.beginAnimation(camera, 0, animationDuration, false);
        if (onComplete) {
            animatable.onAnimationEnd = onComplete;
        }
    };

    startExperienceBtn.addEventListener("click", () => {
        if (currentFocusedSite) {
            // Store the selected site
            const site = sites.find((s) => s.id === currentFocusedSite);
            selectedSite = site || null;

            // Clean up map scene UI
            // websiteHeader.remove();
            infoPanel.remove();
            headerTip.remove();
            descriptionBox.remove();
            startExperienceBtn.remove();
            sidePanel.remove();
            // Show main menu for nickname entry
            createMainMenu(startGame);
        }
    });

    // ESC key handler to remove focus
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && currentFocusedSite) {
            currentFocusedSite = null;
            startExperienceBtn.style.display = "none";
            descriptionBox.style.display = "none";
            animateCameraFocus(Vector3.Zero(), 60);
        }
    });

    // Load Iraq 3D model
    const iraqModel = await ImportMeshAsync("./assets/models/iraq.glb", scene);

    // Create parent transform node for the model
    const modelParent = new TransformNode("iraq_parent", scene);
    modelParent.rotation.y = Math.PI;
    modelParent.scaling = new Vector3(1.25, 1.25, 1.25);

    // Center and scale the model
    const rootMesh = iraqModel.meshes[0];
    if (rootMesh) {
        // Calculate bounding box to find center
        const boundingInfo = rootMesh.getHierarchyBoundingVectors();
        const center = boundingInfo.max.add(boundingInfo.min).scale(0.5);

        // Move model so its center is at origin
        rootMesh.position.subtractInPlace(center);
    }

    // Parent all meshes to the transform node
    iraqModel.meshes.forEach((mesh) => {
        if (mesh.parent === null) {
            mesh.parent = modelParent;
        }
        mesh.isPickable = true;
    });

    // Create fog wall cylinder around the perimeter
    const fogWall = MeshBuilder.CreateCylinder(
        "fog_wall",
        {
            height: 120,
            diameter: 180,
            tessellation: 64,
        },
        scene
    );
    fogWall.position.y = 15;
    fogWall.isPickable = false;
    fogWall.visibility = 0;

    const fogMaterial = new StandardMaterial("fog_mat", scene);
    fogMaterial.diffuseColor = new Color3(0.9, 0.9, 0.9);
    fogMaterial.emissiveColor = new Color3(0.85, 0.85, 0.85);
    fogMaterial.alpha = 0.85;
    fogMaterial.backFaceCulling = false;
    fogWall.material = fogMaterial;

    const sites = [
        {
            id: "1",
            name: "Hosh Al-Bay'ah Collection",
            position: new Vector3(-15, 1, 15),
            description:
                "A historic collection showcasing traditional architecture and cultural heritage of the region.",
            thumbnailPath: "./assets/sites/hosh-al-bayah.svg",
            modelPath: null,
            worldModelPath: "./assets/models/al-tahira-world.glb",
        },
        {
            id: "2",
            name: "Old City of Mosul",
            position: new Vector3(-12, 1, 11),
            description:
                "Ancient city with centuries of history, featuring the iconic Al-Nuri Mosque and winding streets.",
            thumbnailPath: "./assets/sites/mosul.webp",
            modelPath: null,
            worldModelPath: null,
        },
        {
            id: "3",
            name: "Erbil Citadel",
            position: new Vector3(-7.5, 1, 12.5),
            description:
                "One of the oldest continuously inhabited settlements in the world, a UNESCO World Heritage site.",
            thumbnailPath: "./assets/sites/erbil.png",
            modelPath: null,
            worldModelPath: null,
        },
        {
            id: "4",
            name: "Baghdad Museum",
            position: new Vector3(-1.5, 1, -1),
            description:
                "Home to priceless artifacts from Mesopotamian civilizations and Iraq's rich cultural history.",
            thumbnailPath: "./assets/sites/baghdad-museum.webp",
            modelPath: null,
            worldModelPath: null,
        },
        {
            id: "5",
            name: "Uruk City",
            position: new Vector3(0, 1, -15),
            description:
                "Ancient Sumerian city-state, birthplace of writing and one of the world's first great cities.",
            thumbnailPath: "./assets/sites/uruk.jpg",
            modelPath: null,
            worldModelPath: null,
        },
        {
            id: "6",
            name: "Al-Chibayish Marshlands",
            position: new Vector3(15, 1, -19),
            description: "Unique wetland ecosystem, home to the Marsh Arabs and diverse wildlife in southern Iraq.",
            thumbnailPath: "./assets/sites/marshlands.png",
            modelPath: "./assets/models/mudhif.glb",
            worldModelPath: null,
        },
    ];

    // Populate side panel with sites
    sites.forEach((site) => {
        const siteCard = document.createElement("div");
        siteCard.style.background = "rgba(255, 255, 255, 0.1)";
        siteCard.style.borderRadius = "8px";
        siteCard.style.padding = "12px";
        siteCard.style.marginBottom = "12px";
        siteCard.style.cursor = "pointer";
        siteCard.style.transition = "all 0.2s ease";
        siteCard.style.border = "2px solid transparent";

        siteCard.addEventListener("mouseenter", () => {
            siteCard.style.background = "rgba(255, 255, 255, 0.2)";
            siteCard.style.borderColor = "rgba(59, 130, 246, 0.5)";
        });

        siteCard.addEventListener("mouseleave", () => {
            siteCard.style.background = "rgba(255, 255, 255, 0.1)";
            siteCard.style.borderColor = "transparent";
        });

        siteCard.addEventListener("click", () => {
            currentFocusedSite = site.id;
            startExperienceBtn.style.display = "none";
            descriptionBox.style.display = "none";

            const targetPosition = site.position.clone();
            targetPosition.y = 0;

            const targetRadius = 20;
            const animationDuration = 2 * 60;

            const dx = targetPosition.x - camera.target.x;
            const dz = targetPosition.z - camera.target.z;
            const targetAlpha = Math.atan2(dx, dz);

            const currentAlpha = camera.alpha;
            let deltaAlpha = targetAlpha - currentAlpha;

            while (deltaAlpha > Math.PI) deltaAlpha -= 2 * Math.PI;
            while (deltaAlpha < -Math.PI) deltaAlpha += 2 * Math.PI;

            const finalAlpha = currentAlpha + deltaAlpha;

            animateCameraFocus(targetPosition, targetRadius, finalAlpha, animationDuration, () => {
                startExperienceBtn.style.display = "block";
                descriptionBox.style.display = "block";
                descriptionBox.textContent = site.description;
            });
        });

        // Thumbnail image
        const thumbnail = document.createElement("img");
        thumbnail.src = site.thumbnailPath;
        thumbnail.style.width = "100%";
        thumbnail.style.height = "120px";
        thumbnail.style.objectFit = "contain";
        thumbnail.style.borderRadius = "6px";
        thumbnail.style.marginBottom = "8px";
        siteCard.appendChild(thumbnail);

        // Site name
        const siteName = document.createElement("h3");
        siteName.textContent = site.name;
        siteName.style.margin = "0 0 6px 0";
        siteName.style.fontSize = "16px";
        siteName.style.fontWeight = "600";
        siteCard.appendChild(siteName);

        // Site description
        const siteDesc = document.createElement("p");
        siteDesc.textContent = site.description;
        siteDesc.style.margin = "0";
        siteDesc.style.fontSize = "13px";
        siteDesc.style.lineHeight = "1.4";
        siteDesc.style.color = "rgba(255, 255, 255, 0.8)";
        siteCard.appendChild(siteDesc);

        sidePanel.appendChild(siteCard);
    });

    sites.forEach(async (site) => {
        // Create invisible clickable box for all sites (for detecting clicks)
        const clickBox = MeshBuilder.CreateBox(`site-${site.id}`, { size: 2 }, scene);
        clickBox.position.copyFrom(site.position);
        clickBox.isPickable = true;
        clickBox.visibility = 0; // Invisible but still pickable

        if (site.modelPath) {
            // Load 3D model if modelPath is provided
            const modelData = await ImportMeshAsync(site.modelPath, scene);
            const rootMesh = modelData.meshes[0];

            if (rootMesh) {
                // Calculate bounding box to find center
                const boundingInfo = rootMesh.getHierarchyBoundingVectors();
                const center = boundingInfo.max.add(boundingInfo.min).scale(0.5);

                // Move model so its center is at origin
                rootMesh.position.subtractInPlace(center);
            }

            // Create parent container for positioning
            const siteContainer = new TransformNode(`site-model-${site.id}`, scene);
            siteContainer.position.copyFrom(site.position);
            siteContainer.scaling = new Vector3(0.075, 0.075, 0.075);

            // Parent all meshes to the container
            modelData.meshes.forEach((mesh) => {
                if (mesh.parent === null) {
                    mesh.parent = siteContainer;
                }
                mesh.isPickable = false; // Don't pick individual model meshes
            });
        } else {
            // Create visible material for box if no model is provided
            const boxMat = new StandardMaterial(`site-mat-${site.id}`, scene);
            boxMat.diffuseColor = new Color3(246 / 255, 215 / 255, 176 / 255);
            clickBox.material = boxMat;
            clickBox.visibility = 1; // Make visible
        }

        // Create and position label above the site
        const label = createBillboardLabel(site.name, scene);
        label.position.copyFrom(site.position);
        label.position.y += 3;
    });

    scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
        if (pointerInfo.pickInfo?.hit && pointerInfo.pickInfo.pickedMesh?.name.startsWith("site-")) {
            const clickedMesh = pointerInfo.pickInfo.pickedMesh;
            const target = clickedMesh.name.replace("site-", "");

            currentFocusedSite = target;
            startExperienceBtn.style.display = "none";
            descriptionBox.style.display = "none";

            // Find and display site description
            const siteData = sites.find((s) => s.id === target);
            if (siteData) {
                descriptionBox.textContent = siteData.description;
            }

            // Animate camera to focus on the clicked cube
            const targetPosition = clickedMesh.position.clone();
            targetPosition.y = 0; // Focus on ground level of the cube

            const targetRadius = 20; // Fixed distance from the site
            const animationDuration = 2 * 60; // frames (1 second at 60fps)

            // Calculate optimal alpha angle to face the site
            const dx = targetPosition.x - camera.target.x;
            const dz = targetPosition.z - camera.target.z;
            const targetAlpha = Math.atan2(dx, dz);

            // Find shortest rotation path
            const currentAlpha = camera.alpha;
            let deltaAlpha = targetAlpha - currentAlpha;

            // Normalize to [-PI, PI]
            while (deltaAlpha > Math.PI) deltaAlpha -= 2 * Math.PI;
            while (deltaAlpha < -Math.PI) deltaAlpha += 2 * Math.PI;

            const finalAlpha = currentAlpha + deltaAlpha;

            animateCameraFocus(targetPosition, targetRadius, finalAlpha, animationDuration, () => {
                startExperienceBtn.style.display = "block";
                descriptionBox.style.display = "block";
            });
        } else if (
            pointerInfo.pickInfo?.hit &&
            pointerInfo.pickInfo.pickedMesh &&
            !pointerInfo.pickInfo.pickedMesh.name.startsWith("site-")
        ) {
            // Clicking the ground/model refocuses to center
            currentFocusedSite = null;
            startExperienceBtn.style.display = "none";
            descriptionBox.style.display = "none";
            animateCameraFocus(Vector3.Zero(), 60);
        }
    });

    return scene;
};

// Simple main menu overlay with nickname input and start button
const createMainMenu = (onStart: (nickname: string) => void) => {
    // TODO: Consider moving this to html?
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0, 0, 0, 0.85)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.gap = "12px";
    overlay.style.color = "white";
    overlay.style.fontFamily = "sans-serif";
    overlay.style.zIndex = "999";

    const header = document.createElement("h1");
    header.textContent = "Heritage World";
    header.style.margin = "0";
    overlay.appendChild(header);

    const title = document.createElement("h2");
    title.textContent = "Enter your nickname";
    title.style.margin = "0";
    overlay.appendChild(title);

    const input = document.createElement("input");
    input.type = "text";
    input.value = generateFriendlyName();
    input.style.padding = "8px 12px";
    input.style.borderRadius = "6px";
    input.style.border = "1px solid #444";
    input.style.minWidth = "220px";
    overlay.appendChild(input);

    const startBtn = document.createElement("button");
    startBtn.textContent = "Begin";
    startBtn.style.padding = "10px 16px";
    startBtn.style.border = "none";
    startBtn.style.borderRadius = "6px";
    startBtn.style.cursor = "pointer";
    startBtn.style.background = "#3b82f6";
    startBtn.style.color = "white";
    startBtn.style.fontWeight = "bold";
    overlay.appendChild(startBtn);

    startBtn.addEventListener("click", async () => {
        if (gameStarted) return;
        gameStarted = true;
        overlay.remove();
        onStart(input.value.trim() || input.value);
    });

    document.body.appendChild(overlay);
};

const startGame = async (nickname: string) => {
    activeScene?.dispose();
    activeScene = await createScene(nickname, selectedSite?.worldModelPath);
};

registerBuiltInLoaders();
activeScene = await createMapScene();

let inspectorActive = false;
window.addEventListener("keydown", async (e) => {
    if (e.key.toLowerCase() === "f") {
        inspectorActive = !inspectorActive;
        const { Inspector } = await import("@babylonjs/inspector");
        if (inspectorActive) {
            Inspector.Show(activeScene!, { embedMode: true });
        } else {
            Inspector.Hide();
        }
    }
});

engine.runRenderLoop(function () {
    activeScene?.render();
});

window.addEventListener("resize", function () {
    engine.resize();
});
