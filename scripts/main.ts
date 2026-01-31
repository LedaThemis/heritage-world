// TODO: Side panel: Implement "see more" instead of scrollbar
// TODO: Make side panel a grid
import "./ui/components/website-header";

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
    ParticleSystem,
    Texture,
    CylinderParticleEmitter,
    GPUParticleSystem,
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

interface HeritageSite {
    id: string;
    name: string;
    position: Vector3;
    description: string;
    thumbnailPath: string;
    modelPath?: string;
    worldModelPath?: string;
    websiteUrl?: string;
    virtualWalkthroughUrl?: string;
    sketchfabUrl?: string;
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

let allowedEmotes: string[] = [];

const generateFriendlyName = (): string => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    return `${adj} ${animal}`;
};

const engine = new Engine(canvas, true);
let activeScene: Scene | null = null;
let selectedSite: HeritageSite | null = null;
const playerEntities: { [key: string]: Mesh | TransformNode } = {};
const playerNextPosition: { [key: string]: Vector3 } = {};
const playerNextRotation: { [key: string]: Quaternion } = {};
const playerLabels: { [key: string]: Mesh } = {};
const playerEmotes: { [key: string]: Mesh } = {};
const playerEmoteTimeouts: { [key: string]: number } = {};
let currentEmotesButton: HTMLButtonElement | null = null;
let currentPlayerSessionId: string | null = null;

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

const createEmoteBubble = (emote: string, scene: Scene) => {
    const plane = MeshBuilder.CreatePlane("emote-bubble", { size: 1.5 }, scene);
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;
    plane.position.y = 3.5;

    const texture = new DynamicTexture("emote-texture", { width: 128, height: 128 }, scene, false);
    texture.hasAlpha = true;

    // Draw white rounded background
    const ctx = texture.getContext();
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.roundRect(10, 10, 108, 108, 20);
    ctx.fill();

    // Draw emote
    texture.drawText(emote, null, 64 + 24, "bold 64px Arial", "black", "transparent", true);

    const mat = new StandardMaterial("emote-mat", scene);
    mat.diffuseTexture = texture;
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.backFaceCulling = false;
    mat.useAlphaFromDiffuseTexture = true;

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

const showEmote = (sessionId: string, emote: string, scene: Scene, parentMesh: Mesh | TransformNode) => {
    // Clear existing emote and timeout
    if (playerEmoteTimeouts[sessionId]) {
        clearTimeout(playerEmoteTimeouts[sessionId]);
        delete playerEmoteTimeouts[sessionId];
    }
    if (playerEmotes[sessionId]) {
        playerEmotes[sessionId].dispose();
        delete playerEmotes[sessionId];
    }

    // Update emotes button for current player
    const isCurrentPlayer = sessionId === currentPlayerSessionId;
    if (isCurrentPlayer && currentEmotesButton) {
        currentEmotesButton.textContent = emote;
    }

    // Create new emote bubble
    const emoteBubble = createEmoteBubble(emote, scene);
    emoteBubble.parent = parentMesh;
    playerEmotes[sessionId] = emoteBubble;

    // Remove after 3 seconds
    playerEmoteTimeouts[sessionId] = setTimeout(() => {
        emoteBubble.dispose();
        delete playerEmotes[sessionId];
        delete playerEmoteTimeouts[sessionId];

        // Reset emotes button for current player
        if (isCurrentPlayer && currentEmotesButton) {
            currentEmotesButton.textContent = "😊";
        }
    }, 3000);
};

const setupCamera = function (canvas: HTMLCanvasElement, scene: Scene, room: Room, nickname: string) {
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

    let gameMenuOverlay: HTMLDivElement | null = null;

    const toggleGameMenu = () => {
        if (gameMenuOverlay) {
            // Close menu
            gameMenuOverlay.remove();
            gameMenuOverlay = null;
            canvas.requestPointerLock();
        } else {
            // Open menu
            document.exitPointerLock();

            gameMenuOverlay = document.createElement("div");
            gameMenuOverlay.style.position = "fixed";
            gameMenuOverlay.style.inset = "0";
            gameMenuOverlay.style.background = "rgba(0, 0, 0, 0.90)";
            gameMenuOverlay.style.display = "flex";
            gameMenuOverlay.style.flexDirection = "column";
            gameMenuOverlay.style.alignItems = "center";
            gameMenuOverlay.style.justifyContent = "center";
            gameMenuOverlay.style.color = "white";
            gameMenuOverlay.style.fontFamily = "sans-serif";
            gameMenuOverlay.style.zIndex = "1000";
            gameMenuOverlay.style.padding = "40px 20px";
            gameMenuOverlay.style.overflowY = "auto";

            const menuContainer = document.createElement("div");
            menuContainer.style.maxWidth = "500px";
            menuContainer.style.width = "100%";

            // Menu title
            const title = document.createElement("h1");
            title.textContent = "Menu";
            title.style.margin = "0 0 40px 0";
            title.style.fontSize = "48px";
            title.style.fontWeight = "bold";
            title.style.textAlign = "center";
            menuContainer.appendChild(title);

            // Change Name section
            const nameSection = document.createElement("div");
            nameSection.style.background = "rgba(255, 255, 255, 0.05)";
            nameSection.style.padding = "24px";
            nameSection.style.borderRadius = "8px";
            nameSection.style.marginBottom = "20px";

            const nameLabel = document.createElement("label");
            nameLabel.textContent = "Name";
            nameLabel.style.display = "block";
            nameLabel.style.marginBottom = "12px";
            nameLabel.style.fontSize = "16px";
            nameLabel.style.fontWeight = "600";
            nameSection.appendChild(nameLabel);

            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.value = nickname;
            nameInput.style.width = "100%";
            nameInput.style.boxSizing = "border-box";
            nameInput.style.padding = "12px";
            nameInput.style.borderRadius = "6px";
            nameInput.style.border = "1px solid rgba(255, 255, 255, 0.2)";
            nameInput.style.background = "rgba(0, 0, 0, 0.3)";
            nameInput.style.color = "white";
            nameInput.style.fontSize = "16px";
            nameInput.style.marginBottom = "12px";
            nameSection.appendChild(nameInput);

            // Create style tag for button hover effect
            const nameButtonHoverStyle = document.createElement("style");
            nameButtonHoverStyle.textContent = `
                .name-save-btn-hover:hover {
                    background: #2563eb !important;
                }
            `;
            document.head.appendChild(nameButtonHoverStyle);

            const updateNameBtn = document.createElement("button");
            updateNameBtn.textContent = "Save";
            updateNameBtn.className = "name-save-btn-hover";
            updateNameBtn.style.width = "100%";
            updateNameBtn.style.padding = "12px 24px";
            updateNameBtn.style.border = "none";
            updateNameBtn.style.borderRadius = "6px";
            updateNameBtn.style.cursor = "pointer";
            updateNameBtn.style.background = "#3b82f6";
            updateNameBtn.style.color = "white";
            updateNameBtn.style.fontWeight = "bold";
            updateNameBtn.style.fontSize = "16px";
            updateNameBtn.style.transition = "background 0.2s ease";
            updateNameBtn.addEventListener("click", () => {
                const newName = nameInput.value.trim();
                if (newName && room) {
                    nickname = newName;
                    room.send("setName", { name: newName });

                    const originalText = updateNameBtn.textContent;
                    const originalBackground = updateNameBtn.style.background;
                    updateNameBtn.textContent = "✓";
                    updateNameBtn.style.background = "#10b981";
                    updateNameBtn.disabled = true;
                    updateNameBtn.className = ""; // Remove hover class

                    setTimeout(() => {
                        updateNameBtn.textContent = originalText;
                        updateNameBtn.style.background = originalBackground;
                        updateNameBtn.disabled = false;
                        updateNameBtn.className = "name-save-btn-hover"; // Re-add hover class
                    }, 2000);
                }
            });
            nameSection.appendChild(updateNameBtn);
            menuContainer.appendChild(nameSection);

            // Action buttons
            const actionsSection = document.createElement("div");
            actionsSection.style.display = "flex";
            actionsSection.style.flexDirection = "column";
            actionsSection.style.gap = "12px";
            actionsSection.style.marginBottom = "60px";

            const backToGameBtn = document.createElement("button");
            backToGameBtn.textContent = "Return to Game";
            backToGameBtn.style.width = "100%";
            backToGameBtn.style.padding = "12px 24px";
            backToGameBtn.style.border = "none";
            backToGameBtn.style.borderRadius = "6px";
            backToGameBtn.style.cursor = "pointer";
            backToGameBtn.style.background = "rgba(255, 255, 255, 0.1)";
            backToGameBtn.style.color = "white";
            backToGameBtn.style.fontWeight = "bold";
            backToGameBtn.style.fontSize = "16px";
            backToGameBtn.style.transition = "background 0.2s ease";
            backToGameBtn.addEventListener("mouseenter", () => {
                backToGameBtn.style.background = "rgba(255, 255, 255, 0.2)";
            });
            backToGameBtn.addEventListener("mouseleave", () => {
                backToGameBtn.style.background = "rgba(255, 255, 255, 0.1)";
            });
            backToGameBtn.addEventListener("click", async () => {
                toggleGameMenu();
            });
            actionsSection.appendChild(backToGameBtn);

            const backToMapBtn = document.createElement("button");
            backToMapBtn.textContent = "Back to Map";
            backToMapBtn.style.width = "100%";
            backToMapBtn.style.padding = "12px 24px";
            backToMapBtn.style.border = "none";
            backToMapBtn.style.borderRadius = "6px";
            backToMapBtn.style.cursor = "pointer";
            backToMapBtn.style.background = "rgba(255, 255, 255, 0.1)";
            backToMapBtn.style.color = "white";
            backToMapBtn.style.fontWeight = "bold";
            backToMapBtn.style.fontSize = "16px";
            backToMapBtn.style.transition = "background 0.2s ease";
            backToMapBtn.addEventListener("mouseenter", () => {
                backToMapBtn.style.background = "rgba(255, 255, 255, 0.2)";
            });
            backToMapBtn.addEventListener("mouseleave", () => {
                backToMapBtn.style.background = "rgba(255, 255, 255, 0.1)";
            });
            backToMapBtn.addEventListener("click", async () => {
                room.leave();
                gameMenuOverlay?.remove();
                gameMenuOverlay = null;
                activeScene?.dispose();
                selectedSite = null;
                activeScene = await createMapScene();
            });
            actionsSection.appendChild(backToMapBtn);
            menuContainer.appendChild(actionsSection);

            // Footer
            const footer = document.createElement("footer");
            footer.style.textAlign = "center";
            footer.style.marginTop = "40px";
            footer.style.paddingTop = "40px";
            footer.style.borderTop = "1px solid rgba(255, 255, 255, 0.1)";
            footer.style.opacity = "0.4";
            footer.style.fontSize = "13px";
            footer.innerHTML = `<p>&copy; 2026 Heritage Iraq</p>
                <p style="margin-top: 8px;">Part of <a href="https://pih.education" target="_blank" style="color: white; text-decoration: underline;">Project Innovation Hub</a></p>`;
            menuContainer.appendChild(footer);

            gameMenuOverlay.appendChild(menuContainer);
            document.body.appendChild(gameMenuOverlay);

            // Close menu when clicking on overlay (but not on menu content)
            gameMenuOverlay.addEventListener("click", (e) => {
                if (e.target === gameMenuOverlay) {
                    toggleGameMenu();
                }
            });
        }
    };

    window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "escape") {
            toggleGameMenu();
        } else if (e.key >= "1" && e.key <= "9") {
            // Handle emote shortcuts (1-9 or however many emotes exist)
            const emoteIndex = parseInt(e.key) - 1;
            const emote = allowedEmotes[emoteIndex];
            if (emote && room) {
                room.send("sendEmote", { emote });
                // Show emote locally immediately
                showEmote(room.sessionId, emote, scene, playerMesh);
            }
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

    return { camera, playerMesh, toggleGameMenu };
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
    statusHeader.style.display = "flex";
    statusHeader.style.alignItems = "center";
    statusHeader.style.gap = "12px";
    document.body.appendChild(statusHeader);

    let currentPlayerCount = 0;

    const updateStatus = (status: "ONLINE" | "OFFLINE", playerCount?: number) => {
        if (playerCount !== undefined) {
            currentPlayerCount = playerCount;
        }

        if (status === "ONLINE") {
            statusHeader.innerHTML = `<span style="opacity: 0.8; font-size: 12px;">👤 ${currentPlayerCount}</span> | ONLINE`;
            statusHeader.style.background = "rgba(0, 200, 0, 0.7)";
        } else {
            statusHeader.textContent = status;
            statusHeader.style.background = "rgba(200, 0, 0, 0.7)";
        }
    };

    const client = new Client(import.meta.env.VITE_SERVER_URL);
    let room: Room | null;
    try {
        room = await client.joinOrCreate("central", { nickname, siteId: selectedSite?.id || "map" });
        currentPlayerSessionId = room.sessionId;
        room.send("setName", { name: nickname });
        const $ = getStateCallbacks<PlayerRoomType>(room);

        // Request player count and setup periodic updates
        const requestPlayerCount = () => {
            room?.send("getPlayerCount");
        };

        room.onMessage("playerCount", (message: { count: number }) => {
            updateStatus("ONLINE", message.count);
        });

        // Request and listen for allowed emotes
        room.send("getAllowedEmotes");
        room.onMessage("allowedEmotes", (message: { emotes: string[] }) => {
            allowedEmotes = message.emotes;
        });

        // Listen for player emotes
        room.onMessage("playerEmote", (message: { sessionId: string; emote: string }) => {
            // Don't show own emote again (already shown locally)
            if (message.sessionId === room?.sessionId) return;

            const entity = playerEntities[message.sessionId];
            if (entity) {
                showEmote(message.sessionId, message.emote, scene, entity);
            }
        });

        // Initial player count request
        requestPlayerCount();

        // Update player count every 5 seconds
        const playerCountInterval = setInterval(() => {
            if (room?.connection.isOpen) {
                requestPlayerCount();
            }
        }, 5000);

        // Update status to online when connected
        updateStatus("ONLINE");

        // Listen for disconnect events
        room.onLeave((code) => {
            console.log("Disconnected from server:", code);
            clearInterval(playerCountInterval);
            updateStatus("OFFLINE");
        });

        room.onError((code, message) => {
            console.error("Room error:", code, message);
            if (playerCountInterval) clearInterval(playerCountInterval);
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

            // Clean up emote bubble and timeout
            if (playerEmoteTimeouts[sessionId]) {
                clearTimeout(playerEmoteTimeouts[sessionId]);
                delete playerEmoteTimeouts[sessionId];
            }
            if (playerEmotes[sessionId]) {
                playerEmotes[sessionId].dispose();
                delete playerEmotes[sessionId];
            }
        });
    } catch (error) {
        console.error("Room error:", error);
        updateStatus("OFFLINE");
    }

    // Find or create leftContainer for UI elements
    let leftContainer = document.querySelector('[data-ui-container="left"]') as HTMLDivElement;
    if (!leftContainer) {
        leftContainer = document.createElement("div");
        leftContainer.setAttribute("data-ui-container", "left");
        leftContainer.style.position = "fixed";
        leftContainer.style.top = "20px";
        leftContainer.style.left = "20px";
        leftContainer.style.zIndex = "100";
        leftContainer.style.display = "flex";
        leftContainer.style.flexDirection = "column";
        leftContainer.style.gap = "20px";
        leftContainer.style.maxWidth = "390px";
        document.body.appendChild(leftContainer);
    }

    const { camera, playerMesh, toggleGameMenu } = setupCamera(canvas, scene, room!, nickname);
    setupLight(scene);
    setupSkybox(scene);

    // Create persistent menu button for mobile and desktop
    const menuButton = document.createElement("button");
    menuButton.textContent = "☰";
    menuButton.style.width = "50px";
    menuButton.style.height = "50px";
    menuButton.style.fontSize = "24px";
    menuButton.style.background = "rgba(0, 0, 0, 0.7)";
    menuButton.style.color = "white";
    menuButton.style.border = "2px solid rgba(255, 255, 255, 0.3)";
    menuButton.style.borderRadius = "8px";
    menuButton.style.cursor = "pointer";
    menuButton.style.display = "flex";
    menuButton.style.alignItems = "center";
    menuButton.style.justifyContent = "center";
    menuButton.style.transition = "all 0.2s ease";
    menuButton.addEventListener("mouseenter", () => {
        menuButton.style.background = "rgba(0, 0, 0, 0.9)";
        menuButton.style.borderColor = "rgba(255, 255, 255, 0.5)";
    });
    menuButton.addEventListener("mouseleave", () => {
        menuButton.style.background = "rgba(0, 0, 0, 0.7)";
        menuButton.style.borderColor = "rgba(255, 255, 255, 0.3)";
    });
    menuButton.addEventListener("click", toggleGameMenu);
    leftContainer.appendChild(menuButton);

    // Create emotes button
    const emotesButton = document.createElement("button");
    currentEmotesButton = emotesButton;
    emotesButton.textContent = "😊";
    emotesButton.style.width = "50px";
    emotesButton.style.height = "50px";
    emotesButton.style.fontSize = "24px";
    emotesButton.style.background = "rgba(0, 0, 0, 0.7)";
    emotesButton.style.color = "white";
    emotesButton.style.border = "2px solid rgba(255, 255, 255, 0.3)";
    emotesButton.style.borderRadius = "8px";
    emotesButton.style.cursor = "pointer";
    emotesButton.style.display = "flex";
    emotesButton.style.alignItems = "center";
    emotesButton.style.justifyContent = "center";
    emotesButton.style.transition = "all 0.2s ease";
    emotesButton.addEventListener("mouseenter", () => {
        emotesButton.style.background = "rgba(0, 0, 0, 0.9)";
        emotesButton.style.borderColor = "rgba(255, 255, 255, 0.5)";
    });
    emotesButton.addEventListener("mouseleave", () => {
        emotesButton.style.background = "rgba(0, 0, 0, 0.7)";
        emotesButton.style.borderColor = "rgba(255, 255, 255, 0.3)";
    });

    // Create emotes panel (hidden by default)
    let emotesPanel: HTMLDivElement | null = null;

    const toggleEmotesPanel = () => {
        if (emotesPanel) {
            emotesPanel.remove();
            emotesPanel = null;
        } else {
            emotesPanel = document.createElement("div");
            emotesPanel.style.position = "fixed";
            emotesPanel.style.bottom = "20px";
            emotesPanel.style.left = "20px";
            emotesPanel.style.background = "rgba(0, 0, 0, 0.9)";
            emotesPanel.style.borderRadius = "12px";
            emotesPanel.style.padding = "16px";
            emotesPanel.style.display = "grid";
            emotesPanel.style.gridTemplateColumns = "repeat(5, 1fr)";
            emotesPanel.style.gap = "8px";
            emotesPanel.style.maxWidth = "300px";
            emotesPanel.style.zIndex = "1001";
            emotesPanel.style.border = "2px solid rgba(255, 255, 255, 0.2)";

            // Add title
            const title = document.createElement("div");
            title.textContent = "Emotes";
            title.style.gridColumn = "1 / -1";
            title.style.color = "white";
            title.style.fontFamily = "sans-serif";
            title.style.fontSize = "14px";
            title.style.fontWeight = "bold";
            title.style.marginBottom = "8px";
            title.style.textAlign = "center";
            emotesPanel.appendChild(title);

            // Add emote buttons
            allowedEmotes.forEach((emote, index) => {
                const emoteBtn = document.createElement("button");
                emoteBtn.textContent = emote;
                emoteBtn.style.width = "45px";
                emoteBtn.style.height = "45px";
                emoteBtn.style.fontSize = "24px";
                emoteBtn.style.background = "rgba(255, 255, 255, 0.1)";
                emoteBtn.style.border = "1px solid rgba(255, 255, 255, 0.2)";
                emoteBtn.style.borderRadius = "8px";
                emoteBtn.style.cursor = "pointer";
                emoteBtn.style.transition = "all 0.2s ease";
                emoteBtn.style.display = "flex";
                emoteBtn.style.alignItems = "center";
                emoteBtn.style.justifyContent = "center";

                // Show keyboard shortcut for first 9 emotes
                if (index < 9) {
                    emoteBtn.title = `Press ${index + 1} to use this emote`;
                }

                emoteBtn.addEventListener("mouseenter", () => {
                    emoteBtn.style.background = "rgba(255, 255, 255, 0.3)";
                    emoteBtn.style.transform = "scale(1.1)";
                });
                emoteBtn.addEventListener("mouseleave", () => {
                    emoteBtn.style.background = "rgba(255, 255, 255, 0.1)";
                    emoteBtn.style.transform = "scale(1)";
                });
                emoteBtn.addEventListener("click", () => {
                    if (room) {
                        room.send("sendEmote", { emote });
                        showEmote(room.sessionId, emote, scene, playerMesh);
                    }
                    toggleEmotesPanel(); // Close panel after selecting
                });

                emotesPanel!.appendChild(emoteBtn);
            });

            // Add helper text for keyboard shortcuts
            const helper = document.createElement("div");
            helper.textContent = "Press 1-9 for quick access";
            helper.style.gridColumn = "1 / -1";
            helper.style.color = "rgba(255, 255, 255, 0.6)";
            helper.style.fontFamily = "sans-serif";
            helper.style.fontSize = "11px";
            helper.style.marginTop = "8px";
            helper.style.textAlign = "center";
            emotesPanel.appendChild(helper);

            document.body.appendChild(emotesPanel);

            // Close when clicking outside
            const closeOnOutsideClick = (e: MouseEvent) => {
                if (emotesPanel && !emotesPanel.contains(e.target as Node) && e.target !== emotesButton) {
                    toggleEmotesPanel();
                    document.removeEventListener("click", closeOnOutsideClick);
                }
            };
            setTimeout(() => {
                document.addEventListener("click", closeOnOutsideClick);
            }, 0);
        }
    };

    emotesButton.addEventListener("click", toggleEmotesPanel);
    leftContainer.appendChild(emotesButton);

    // Add keyboard shortcut for emotes panel (E key)
    window.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "e") {
            document.exitPointerLock();
            toggleEmotesPanel();
        }
    });

    // Enable ambient occlusion
    const ssao = new SSAO2RenderingPipeline("ssao", scene, 1);
    ssao.radius = 1.5;
    ssao.samples = 16;
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

    const camera = new ArcRotateCamera("map_camera", -Math.PI / 2, Math.PI / 3.5, 60, Vector3.Zero(), scene);
    camera.lowerBetaLimit = Math.PI / 6;
    camera.upperBetaLimit = Math.PI / 2.5;
    camera.lowerRadiusLimit = 20;
    camera.upperRadiusLimit = 60;
    camera.attachControl(canvas, true);
    camera.useAutoRotationBehavior = true;
    if (camera.autoRotationBehavior) {
        camera.autoRotationBehavior.idleRotationSpeed = 0.05;
        camera.autoRotationBehavior.idleRotationWaitTime = 1000;
        camera.autoRotationBehavior.zoomStopsAnimation = true;
    }

    setupLight(scene);
    scene.clearColor = new Color4(179 / 255, 183 / 255, 181 / 255, 1);

    // Enable ambient occlusion
    const ssao = new SSAO2RenderingPipeline("ssao", scene, 1);
    ssao.radius = 1.5;
    ssao.samples = 16;
    scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);

    // Create container for left-side UI elements
    const leftContainer = document.createElement("div");
    leftContainer.setAttribute("data-ui-container", "left");
    leftContainer.style.position = "fixed";
    leftContainer.style.top = "20px";
    leftContainer.style.left = "20px";
    leftContainer.style.zIndex = "100";
    leftContainer.style.display = "flex";
    leftContainer.style.flexDirection = "column";
    leftContainer.style.gap = "20px";
    leftContainer.style.maxWidth = "390px";
    document.body.appendChild(leftContainer);

    const websiteHeader = document.createElement("website-header");
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
    creditsLink.href = "/credits.html";
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

    // Create right panel for site details (hidden by default)
    const experienceContainer = document.createElement("div");
    experienceContainer.style.position = "fixed";
    experienceContainer.style.top = "20px";
    experienceContainer.style.right = "-400px"; // Start off-screen
    experienceContainer.style.width = "360px";
    experienceContainer.style.maxHeight = "calc(100vh - 40px)";
    experienceContainer.style.overflowY = "auto";
    experienceContainer.style.background = "rgba(0, 0, 0, 0.85)";
    experienceContainer.style.borderRadius = "12px";
    experienceContainer.style.padding = "24px";
    experienceContainer.style.zIndex = "100";
    experienceContainer.style.display = "flex";
    experienceContainer.style.flexDirection = "column";
    experienceContainer.style.gap = "20px";
    experienceContainer.style.transition = "right 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
    experienceContainer.style.fontFamily = "sans-serif";
    experienceContainer.classList.add("custom-scrollbar");
    document.body.appendChild(experienceContainer);

    // Create site title
    const siteTitle = document.createElement("h2");
    siteTitle.style.margin = "0";
    siteTitle.style.fontSize = "24px";
    siteTitle.style.fontWeight = "bold";
    siteTitle.style.color = "white";
    experienceContainer.appendChild(siteTitle);

    // Create description text
    const descriptionBox = document.createElement("p");
    descriptionBox.style.margin = "0";
    descriptionBox.style.fontSize = "15px";
    descriptionBox.style.lineHeight = "1.6";
    descriptionBox.style.color = "rgba(255, 255, 255, 0.9)";
    experienceContainer.appendChild(descriptionBox);

    // Create features section
    const featuresSection = document.createElement("div");
    featuresSection.style.display = "flex";
    featuresSection.style.flexDirection = "column";
    featuresSection.style.gap = "12px";
    featuresSection.style.marginTop = "8px";
    experienceContainer.appendChild(featuresSection);

    const featuresTitle = document.createElement("h3");
    featuresTitle.textContent = "Available Features";
    featuresTitle.style.margin = "0 0 8px 0";
    featuresTitle.style.fontSize = "16px";
    featuresTitle.style.fontWeight = "600";
    featuresTitle.style.color = "white";
    featuresSection.appendChild(featuresTitle);

    const createFeatureItem = (label: string, available: boolean, url?: string) => {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.flexDirection = "column";
        item.style.gap = "8px";
        item.style.fontSize = "14px";
        item.style.color = available ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.4)";
        item.style.padding = "12px";
        item.style.background = "rgba(255, 255, 255, 0.05)";
        item.style.borderRadius = "8px";

        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.alignItems = "center";
        header.style.gap = "10px";

        const checkmark = document.createElement("span");
        checkmark.textContent = available ? "✓" : "✗";
        checkmark.style.fontSize = "18px";
        checkmark.style.fontWeight = "bold";
        checkmark.style.color = available ? "#10b981" : "rgba(255, 255, 255, 0.3)";
        header.appendChild(checkmark);

        const text = document.createElement("span");
        text.textContent = label;
        text.style.fontWeight = "600";
        header.appendChild(text);

        item.appendChild(header);

        if (url || label.includes("Interactive")) {
            const linkText = document.createElement("p");
            linkText.style.margin = "0 0 4px 28px";
            linkText.style.fontSize = "13px";
            linkText.style.color = "rgba(255, 255, 255, 0.7)";

            if (label.includes("Sketchfab")) {
                linkText.textContent = "You can view the Sketchfab collection at:";
            } else if (label.includes("Website")) {
                linkText.textContent = "You can visit the external website at:";
            } else if (label.includes("Virtual Walkthrough")) {
                linkText.textContent = "You can experience the virtual walkthrough at:";
            } else if (label.includes("Interactive")) {
                linkText.textContent =
                    'You can immerse yourself in the interactive experience by clicking "Start Experience" below.';
            }
            item.appendChild(linkText);

            if (url) {
                const link = document.createElement("a");
                link.href = url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = url;
                link.style.color = "#60a5fa";
                link.style.fontSize = "13px";
                link.style.textDecoration = "none";
                link.style.marginLeft = "28px";
                link.style.wordBreak = "break-all";
                link.style.transition = "color 0.2s ease";
                link.addEventListener("mouseenter", () => {
                    link.style.color = "#93c5fd";
                });
                link.addEventListener("mouseleave", () => {
                    link.style.color = "#60a5fa";
                });
                item.appendChild(link);
            }
        }

        return item;
    };

    const websiteFeature = createFeatureItem("External Website", false);
    const virtualWalkthroughFeature = createFeatureItem("Virtual Walkthrough", false);
    const sketchfabFeature = createFeatureItem("Sketchfab 3D Collection", false);
    const interactiveFeature = createFeatureItem("Interactive Experience", false);

    featuresSection.appendChild(websiteFeature);
    featuresSection.appendChild(virtualWalkthroughFeature);
    featuresSection.appendChild(sketchfabFeature);
    featuresSection.appendChild(interactiveFeature);

    // Create Start Experience button (only visible if interactive experience exists)
    const startExperienceBtn = document.createElement("button");
    startExperienceBtn.textContent = "Start Experience";
    startExperienceBtn.style.width = "100%";
    startExperienceBtn.style.padding = "12px 32px";
    startExperienceBtn.style.fontSize = "16px";
    startExperienceBtn.style.fontWeight = "bold";
    startExperienceBtn.style.background = "#3b82f6";
    startExperienceBtn.style.color = "white";
    startExperienceBtn.style.border = "none";
    startExperienceBtn.style.borderRadius = "8px";
    startExperienceBtn.style.cursor = "pointer";
    startExperienceBtn.style.transition = "all 0.2s ease";
    startExperienceBtn.style.marginTop = "8px";
    startExperienceBtn.addEventListener("mouseenter", () => {
        startExperienceBtn.style.background = "#2563eb";
    });
    startExperienceBtn.addEventListener("mouseleave", () => {
        startExperienceBtn.style.background = "#3b82f6";
    });
    experienceContainer.appendChild(startExperienceBtn);

    let currentFocusedSite: string | null = null;

    // Update panel with site data
    const updatePanelWithSite = (site: HeritageSite) => {
        siteTitle.textContent = site.name;
        descriptionBox.textContent = site.description;

        // Clear existing features
        while (featuresSection.children.length > 1) {
            featuresSection.removeChild(featuresSection.lastChild!);
        }

        // Add only available features
        const hasWebsite = !!site.websiteUrl;
        const hasVirtualWalkthrough = !!site.virtualWalkthroughUrl;
        const hasSketchfab = !!site.sketchfabUrl;
        const hasInteractive = !!site.worldModelPath;

        if (hasWebsite) {
            featuresSection.appendChild(createFeatureItem("External Website", true, site.websiteUrl));
        }
        if (hasVirtualWalkthrough) {
            featuresSection.appendChild(createFeatureItem("Virtual Walkthrough", true, site.virtualWalkthroughUrl));
        }
        if (hasSketchfab) {
            featuresSection.appendChild(createFeatureItem("Sketchfab 3D Collection", true, site.sketchfabUrl));
        }
        if (hasInteractive) {
            featuresSection.appendChild(createFeatureItem("Interactive Experience", true));
        }

        // Show/hide features section if no features available
        featuresSection.style.display =
            hasWebsite || hasVirtualWalkthrough || hasSketchfab || hasInteractive ? "flex" : "none";

        // Show/hide start button based on interactive availability
        startExperienceBtn.style.display = hasInteractive ? "block" : "none";
    };

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

    startExperienceBtn.addEventListener("click", async () => {
        if (currentFocusedSite) {
            // Store the selected site
            const site = sites.find((s) => s.id === currentFocusedSite);
            selectedSite = site || null;

            // Clean up map scene UI
            infoPanel.remove();
            sidePanel.remove();
            headerTip.remove();
            experienceContainer.remove();

            // Start game with randomly generated name
            const nickname = generateFriendlyName();
            await startGame(nickname);
        }
    });

    // ESC key handler to remove focus
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && currentFocusedSite) {
            currentFocusedSite = null;
            experienceContainer.style.right = "-400px"; // Animate out
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

    // Create cylindrical fog wall particle system around the perimeter
    const fogWallParticleSystem = new GPUParticleSystem("fogWallParticles", { capacity: 5000 }, scene);

    // Use cylinder particle emitter type for cylindrical fog wall
    fogWallParticleSystem.particleEmitterType = new CylinderParticleEmitter(30, 30, 2.5);

    // Use a simple cloud/smoke texture
    const fogWallTexture = new Texture("./assets/textures/smoke.png", scene);
    fogWallParticleSystem.particleTexture = fogWallTexture;

    // Color configuration - white/gray fog with low opacity
    fogWallParticleSystem.color1 = new Color4(0.9, 0.9, 0.9, 0.15);
    fogWallParticleSystem.color2 = new Color4(0.95, 0.95, 0.95, 0.2);
    fogWallParticleSystem.colorDead = new Color4(0.85, 0.85, 0.85, 0.1);

    // Size configuration - larger particles for wall effect
    fogWallParticleSystem.minSize = 5;
    fogWallParticleSystem.maxSize = 8 * 2;

    // Lifetime - persistent fog
    fogWallParticleSystem.minLifeTime = Number.MAX_SAFE_INTEGER;
    fogWallParticleSystem.maxLifeTime = Number.MAX_SAFE_INTEGER;

    // Emit configuration
    fogWallParticleSystem.manualEmitCount = fogWallParticleSystem.getCapacity();

    // Minimal movement - particles should mostly stay in place
    fogWallParticleSystem.gravity = new Vector3(0, 0, 0);
    fogWallParticleSystem.direction1 = new Vector3(0, 0, 0);
    fogWallParticleSystem.direction2 = new Vector3(0, 0, 0);
    fogWallParticleSystem.minAngularSpeed = 0;
    fogWallParticleSystem.maxAngularSpeed = 0;
    fogWallParticleSystem.minEmitPower = 0;
    fogWallParticleSystem.maxEmitPower = 0;
    fogWallParticleSystem.updateSpeed = 0;

    // Blend mode for atmospheric effect
    fogWallParticleSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    // Start the fog wall
    fogWallParticleSystem.start();

    const sites: HeritageSite[] = [
        {
            id: "1",
            name: "Hosh Al-Bay'ah Collection",
            position: new Vector3(-15, 1, 15),
            description:
                "A historic collection showcasing traditional architecture and cultural heritage of the region.",
            thumbnailPath: "./assets/sites/hosh-al-bayah.svg",
            worldModelPath: "./assets/models/al-tahira-world.glb",
            websiteUrl: "https://alqaba.com/al-tahira-church",
            virtualWalkthroughUrl: "https://www.alqaba.com/al-tahira-church/walkthrough",
            sketchfabUrl:
                "https://sketchfab.com/HusseinYaseen/collections/hosh-al-bayaah-churchs-67ed28d04539400b87073ef37b3218d8",
        },
        {
            id: "2",
            name: "Old City of Mosul",
            position: new Vector3(-12, 1, 11),
            description:
                "Ancient city with centuries of history, featuring the iconic Al-Nuri Mosque and winding streets.",
            thumbnailPath: "./assets/sites/mosul.webp",
            virtualWalkthroughUrl: "https://www.alqaba.com/old-town/walkthrough",
            websiteUrl: "https://www.alqaba.com/old-town",
        },
        {
            id: "3",
            name: "Erbil Citadel",
            position: new Vector3(-7.5, 1, 12.5),
            description:
                "One of the oldest continuously inhabited settlements in the world, a UNESCO World Heritage site.",
            thumbnailPath: "./assets/sites/erbil.png",
        },
        {
            id: "4",
            name: "Baghdad Museum",
            position: new Vector3(-1.5, 1, -1),
            description:
                "Home to priceless artifacts from Mesopotamian civilizations and Iraq's rich cultural history.",
            thumbnailPath: "./assets/sites/baghdad-museum.webp",
            sketchfabUrl:
                "https://sketchfab.com/HusseinYaseen/collections/iraqi-museum-b2f69baa92d84b50a90711d5db7d7f18",
        },
        {
            id: "5",
            name: "Uruk City",
            position: new Vector3(0, 1, -15),
            description:
                "Ancient Sumerian city-state, birthplace of writing and one of the world's first great cities.",
            thumbnailPath: "./assets/sites/uruk.jpg",
            sketchfabUrl: "https://sketchfab.com/HusseinYaseen/collections/uruk-city-0281a1d074b74daf937ccd853b9ec4fc",
        },
        {
            id: "6",
            name: "Al-Chibayish Marshlands",
            position: new Vector3(15, 1, -19),
            description: "Unique wetland ecosystem, home to the Marsh Arabs and diverse wildlife in southern Iraq.",
            thumbnailPath: "./assets/sites/marshlands.png",
            modelPath: "./assets/models/mudhif.glb",
            websiteUrl: "https://alqaba.com/iraq-marshes",
            virtualWalkthroughUrl: "https://www.alqaba.com/iraq-marshes/walkthrough",
            sketchfabUrl:
                "https://sketchfab.com/HusseinYaseen/collections/al-chibayish-marshes-b57822cc6dee4a698669e1e08c1e1f4b",
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
            experienceContainer.style.right = "-400px";

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
                // Populate panel with site data
                updatePanelWithSite(site);

                // Animate panel in
                experienceContainer.style.right = "20px";
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
            siteContainer.position.subtractInPlace(new Vector3(0, 0.25, 0));

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

            experienceContainer.style.right = "-400px"; // Animate out
            currentFocusedSite = target;

            // Find and display site description
            const siteData = sites.find((s) => s.id === target);
            if (siteData) {
                // Populate panel with site data
                updatePanelWithSite(siteData);
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
                // Animate panel in
                experienceContainer.style.right = "20px";
            });
        } else if (
            pointerInfo.pickInfo?.hit &&
            pointerInfo.pickInfo.pickedMesh &&
            !pointerInfo.pickInfo.pickedMesh.name.startsWith("site-")
        ) {
            // Clicking the ground/model refocuses to center
            currentFocusedSite = null;
            experienceContainer.style.right = "-400px"; // Animate out
            animateCameraFocus(Vector3.Zero(), 60);
        }
    });

    return scene;
};

const startGame = async (nickname: string) => {
    activeScene?.dispose();
    activeScene = await createScene(nickname, selectedSite?.worldModelPath);
};

registerBuiltInLoaders();
activeScene = await createMapScene();

// Create FPS counter for debugging (only in dev mode)
let fpsDisplay: HTMLDivElement | null = null;
if (import.meta.env.DEV) {
    fpsDisplay = document.createElement("div");
    fpsDisplay.style.position = "fixed";
    fpsDisplay.style.top = "60px";
    fpsDisplay.style.right = "20px";
    fpsDisplay.style.padding = "8px 16px";
    fpsDisplay.style.fontSize = "14px";
    fpsDisplay.style.fontWeight = "bold";
    fpsDisplay.style.color = "white";
    fpsDisplay.style.background = "rgba(0, 0, 0, 0.7)";
    fpsDisplay.style.borderRadius = "6px";
    fpsDisplay.style.zIndex = "100";
    fpsDisplay.style.fontFamily = "monospace";
    fpsDisplay.textContent = "FPS: --";
    document.body.appendChild(fpsDisplay);
}

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
    if (fpsDisplay) {
        fpsDisplay.textContent = `FPS: ${engine.getFps().toFixed(0)}`;
    }
});

window.addEventListener("resize", function () {
    engine.resize();
});
