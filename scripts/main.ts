import {
    Engine,
    Scene,
    Vector3,
    Color3,
    HemisphericLight,
    MeshBuilder,
    HavokPlugin,
    PhysicsAggregate,
    PhysicsShapeType,
    UniversalCamera,
    StandardMaterial,
    CubeTexture,
    Mesh,
    DynamicTexture,
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { Client, getStateCallbacks, Room } from "colyseus.js";

interface PlayerRoomType {
    players: { x: number; y: number; z: number; name?: string }[];
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
const playerEntities: { [key: string]: Mesh } = {};
const playerNextPosition: { [key: string]: Vector3 } = {};
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
    plane.position.y = 1.6;
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

        // Debounced position updates to server
        const now = performance.now();
        if (
            (movement.x !== 0 || movement.y !== 0 || movement.z !== 0) &&
            now - lastPositionSend >= positionSendIntervalMs
        ) {
            lastPositionSend = now;
            room.send("updatePosition", {
                x: playerMesh.position.x,
                y: playerMesh.position.y + 1, // TODO: Do we need to add one here? since the height of player mesh is 2 but remote player is 1
                z: playerMesh.position.z,
            });
        }
    });

    return { camera, playerMesh };
};

const createScene = async function (nickname: string) {
    const scene = setupScene(engine);

    const gravityVector = new Vector3(0, -9.81, 0);
    const havokInstance = await HavokPhysics();
    const physicsPlugin = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(gravityVector, physicsPlugin);

    const client = new Client(import.meta.env.VITE_SERVER_URL);
    let room: Room | null;
    try {
        room = await client.joinOrCreate("central", { nickname });
        room.send("setName", { name: nickname });
        const $ = getStateCallbacks<PlayerRoomType>(room);

        $(room.state).players.onAdd((player, sessionId) => {
            const isCurrentPlayer = sessionId === room.sessionId;

            // create player Sphere
            if (isCurrentPlayer) {
                playerMesh.position.set(player.x, player.y, player.z);
            } else {
                const remotePlayerMesh = MeshBuilder.CreateSphere(
                    `player-${sessionId}`,
                    {
                        segments: 8,
                        diameter: 2,
                    },
                    scene
                );

                remotePlayerMesh.position.set(player.x, player.y, player.z);
                playerEntities[sessionId] = remotePlayerMesh;
                playerNextPosition[sessionId] = remotePlayerMesh.position.clone();

                const label = createNameLabel(player.name ?? "Player", scene);
                label.parent = remotePlayerMesh;
                playerLabels[sessionId] = label;
            }

            $(player).onChange(function () {
                if (isCurrentPlayer) {
                } else {
                    playerNextPosition[sessionId].set(player.x, player.y, player.z);
                    if (player.name) {
                        updateNameLabel(playerLabels[sessionId], player.name);
                    }
                }
            });
        });

        $(room.state).players.onRemove(function (player, sessionId) {
            playerEntities[sessionId].dispose();
            delete playerEntities[sessionId];
            playerLabels[sessionId]?.dispose();
            delete playerLabels[sessionId];
        });
    } catch (error) {
        console.error("An error occurred: ", error);
    }

    const { playerMesh } = setupCamera(canvas, scene, room!);
    setupLight(scene);
    setupSkybox(scene);

    const sphere = MeshBuilder.CreateSphere("sphere", { diameter: 3, segments: 32 }, scene);
    sphere.position = new Vector3(0, 2, 10);
    sphere.checkCollisions = true;

    const ground = MeshBuilder.CreateGround("ground", { width: GND_WIDTH, height: GND_HEIGHT }, scene);
    ground.checkCollisions = true;

    const sphereAggregate = new PhysicsAggregate(
        sphere,
        PhysicsShapeType.SPHERE,
        { mass: 1, restitution: 0.75 },
        scene
    );

    const groundAggregate = new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // Remote Movement Loop
    scene.registerBeforeRender(() => {
        for (let sessionId in playerEntities) {
            var entity = playerEntities[sessionId];
            var targetPosition = playerNextPosition[sessionId];
            entity.position = Vector3.Lerp(entity.position, targetPosition, 0.05);
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
    overlay.style.background = "rgba(0, 0, 0, 0.8)";
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
    startBtn.textContent = "Start";
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
        await startGame(input.value.trim() || input.value);
    });

    document.body.appendChild(overlay);
};

const startGame = async (nickname: string) => {
    activeScene = await createScene(nickname);

    // Inspector toggle (dev only)
    let inspectorActive = false;
    window.addEventListener("keydown", async (e) => {
        if (e.key.toLowerCase() === "f" && import.meta.env.DEV) {
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
};

createMainMenu(startGame);
