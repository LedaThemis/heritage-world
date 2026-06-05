/**
 * Heritage Iraq — Cloud Cover Era Transition
 *
 * When the user switches eras, a dense cloud storm spawns at the perimeter
 * and rushes inward to completely obscure the map. After the era changes,
 * the storm emission stops and the clouds naturally dissipate.
 *
 * Technical approach:
 *   - A second GPUParticleSystem ("coverSystem") is used with the exact same
 *     smoke.png texture.
 *   - It uses a CylinderParticleEmitter at radius 35 (outside the map) and a
 *     negative emit power to shoot the clouds inwards toward the center.
 *   - Color gradients smoothly fade the particles in as they spawn and fade
 *     them out as they die, creating a seamless transition without any
 *     manual per-frame alpha hacking.
 *   - Procedural wind/whoosh sound via Web Audio API.
 */

import {
    Scene,
    GPUParticleSystem,
    CylinderParticleEmitter,
    Texture,
    Color4,
    ParticleSystem,
} from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

// ── State ──────────────────────────────────────────────────────────────
let coverSystem: GPUParticleSystem | null = null;
let sceneRef: Scene | null = null;
let isTransitioning = false;
let audioCtx: AudioContext | null = null;

// Timing (milliseconds)
// The storm travels very fast: reaches center in ~0.9s, covers it for ~0.5s, rolls out by ~2.2s.
const EMIT_DURATION_MS = 500;    // How long we spawn particles to build the wave (controls pause length)
const CHANGE_ERA_MS = 1100;      // When to change era (safely in the middle of the cover)
const TOTAL_DURATION_MS = 2600;  // Must be >= EMIT_DURATION + maxLifeTime to prevent popping

// ── Audio ──────────────────────────────────────────────────────────────

/**
 * Plays a smooth procedural wind/whoosh sound effect synchronized with
 * the cloud transition phases.
 */
const playWhooshSound = (): void => {
    try {
        if (!audioCtx) {
            audioCtx = new AudioContext();
        }

        const ctx = audioCtx;
        const now = ctx.currentTime;
        const totalDuration = TOTAL_DURATION_MS / 1000;

        const bufferSize = ctx.sampleRate * Math.ceil(totalDuration + 0.5);
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const coverEnd = now + 0.9; // Wave reaches center
        const holdEnd = now + 1.4; // Wave leaves center
        const revealEnd = now + totalDuration;

        const bandpass = ctx.createBiquadFilter();
        bandpass.type = "bandpass";
        bandpass.Q.setValueAtTime(0.8, now);
        bandpass.frequency.setValueAtTime(300, now);
        bandpass.frequency.linearRampToValueAtTime(900, coverEnd);
        bandpass.frequency.setValueAtTime(900, holdEnd);
        bandpass.frequency.linearRampToValueAtTime(400, revealEnd);

        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.Q.setValueAtTime(0.5, now);
        lowpass.frequency.setValueAtTime(1200, now);
        lowpass.frequency.linearRampToValueAtTime(2500, coverEnd);
        lowpass.frequency.setValueAtTime(2500, holdEnd);
        lowpass.frequency.linearRampToValueAtTime(1200, revealEnd);

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.25, coverEnd);
        gainNode.gain.setValueAtTime(0.25, holdEnd);
        gainNode.gain.linearRampToValueAtTime(0, revealEnd);

        noiseSource.connect(bandpass);
        bandpass.connect(lowpass);
        lowpass.connect(gainNode);
        gainNode.connect(ctx.destination);

        noiseSource.start(now);
        noiseSource.stop(revealEnd + 0.2);
    } catch (e) {
        console.warn("Cloud transition audio failed:", e);
    }
};

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Initializes the cloud transition system.
 */
export const initCloudTransition = (
    scene: Scene,
    mainFogSystem: GPUParticleSystem
): void => {
    sceneRef = scene;
    
    // Ensure the main perimeter fog is untouched and visible
    if (mainFogSystem.textureMask) {
        mainFogSystem.textureMask = new Color4(1, 1, 1, 1);
    }
    mainFogSystem.fogEnabled = true;

    // Create the storm cover system — optimized capacity for better FPS
    coverSystem = new GPUParticleSystem("fogCoverParticles", { capacity: 1500 }, scene);

    // Spawn in a wide ring just outside the main map (radius 35, thickness 5)
    coverSystem.particleEmitterType = new CylinderParticleEmitter(35, 10, 5);

    // Use exact same smoke texture
    coverSystem.particleTexture = new Texture("./assets/textures/smoke.png", scene);

    // Reduced emission rate for better performance, compensated by larger particles
    coverSystem.emitRate = 1200;

    // Lifetimes are strictly bound to crossing time so they don't linger invisibly and kill FPS
    coverSystem.minLifeTime = 1.7;
    coverSystem.maxLifeTime = 2.0;

    // Much larger particles to obscure everything with less overdraw (fixes lag)
    coverSystem.minSize = 35;
    coverSystem.maxSize = 55;

    // Fade in at the edges, stay fully opaque through the center, fade out just as they hit the opposite edge
    coverSystem.addColorGradient(0.0, new Color4(0.9, 0.9, 0.9, 0.0));
    coverSystem.addColorGradient(0.1, new Color4(0.9, 0.9, 0.9, 0.9)); 
    coverSystem.addColorGradient(0.8, new Color4(0.95, 0.95, 0.95, 0.9)); 
    coverSystem.addColorGradient(1.0, new Color4(0.85, 0.85, 0.85, 0.0));

    // Shoot inwards extremely fast so they clear the screen quickly and die immediately
    coverSystem.minEmitPower = -35;
    coverSystem.maxEmitPower = -45;

    coverSystem.gravity = new Vector3(0, 0, 0);
    coverSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    // Ensure clouds render on top of markers and the map
    coverSystem.renderingGroupId = 2;

    // DO NOT start() it here. It sits idle until triggered.
};

/**
 * Returns true if a cloud transition is currently in progress.
 */
export const isCloudTransitioning = (): boolean => isTransitioning;

/**
 * Triggers the full cloud cover → era change → reveal sequence.
 */
export const triggerCloudTransition = (onCovered: () => void): Promise<void> => {
    if (isTransitioning || !coverSystem) {
        onCovered();
        return Promise.resolve();
    }

    isTransitioning = true;
    playWhooshSound();

    return new Promise<void>((resolve) => {
        // Ensure GPU buffers are completely wiped from any previous transitions
        if (coverSystem) {
            coverSystem.reset();
        }

        // 1. Start emitting the wave
        coverSystem!.start();

        // 2. Stop emitting after the wave is built
        setTimeout(() => {
            coverSystem!.stop();
        }, EMIT_DURATION_MS);

        // 3. The wave converges on the center. Execute the era change while hidden.
        setTimeout(() => {
            onCovered();
        }, CHANGE_ERA_MS);

        // 4. The wave naturally crosses the center and expands outward,
        // revealing the new map. Wait for all particles to die.
        setTimeout(() => {
            isTransitioning = false;
            resolve();
        }, TOTAL_DURATION_MS);

        // 5. Deferred GPU cleanup — give particles an extra second to
        // fully roll out and fade via their color gradients before wiping
        // the GPU buffers. Without this reset the GPUParticleSystem keeps
        // running compute shaders forever, but calling it too early kills
        // the visual "roll-out" effect.
        setTimeout(() => {
            if (coverSystem) {
                coverSystem.reset();
            }
        }, TOTAL_DURATION_MS + 1000);
    });
};

/**
 * Disposes of all cloud transition resources.
 */
export const disposeCloudTransition = (): void => {
    if (coverSystem) {
        coverSystem.stop();
        coverSystem.dispose();
        coverSystem = null;
    }

    sceneRef = null;
    isTransitioning = false;

    if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
    }
};
