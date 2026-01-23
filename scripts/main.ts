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
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;

if (!canvas) {
    throw new Error("Canvas element not found.");
}

const GND_WIDTH = 100;
const GND_HEIGHT = 100;
const PLAYER_HEIGHT = 2;
const PLAYER_WIDTH = 1;

const engine = new Engine(canvas, true);

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

const setupCamera = function (canvas: HTMLCanvasElement, scene: Scene) {
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
    });
};

const createScene = async function () {
    const scene = setupScene(engine);

    const gravityVector = new Vector3(0, -9.81, 0);
    const havokInstance = await HavokPhysics();
    const physicsPlugin = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(gravityVector, physicsPlugin);

    setupCamera(canvas, scene);
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

    return scene;
};

const scene = await createScene();

let inspectorActive = false;

window.addEventListener("keydown", async (e) => {
    if (e.key.toLowerCase() === "f" && import.meta.env.DEV) {
        inspectorActive = !inspectorActive;

        if (inspectorActive) {
            const { Inspector } = await import("@babylonjs/inspector");
            Inspector.Show(scene, {
                embedMode: true,
            });
        } else {
            const { Inspector } = await import("@babylonjs/inspector");
            Inspector.Hide();
        }
    }
});

engine.runRenderLoop(function () {
    scene.render();
});

window.addEventListener("resize", function () {
    engine.resize();
});
