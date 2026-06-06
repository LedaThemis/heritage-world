/**
 * Heritage Iraq — Timeline Animations
 *
 * Helpers for integrating timeline era changes with BabylonJS:
 * - Camera target adjustments (drift toward era region)
 * - Heritage site marker visibility based on active era
 */

import {
    Scene,
    ArcRotateCamera,
    Vector3,
    Animation,
    CubicEase,
    EasingFunction,
    AbstractMesh,
} from "@babylonjs/core";
import { HistoricalEra, SITE_ERA_MAP } from "./timelineData";

/**
 * Smoothly moves the ArcRotateCamera target toward the region associated
 * with the given era. Uses the existing BabylonJS animation system.
 */
export const animateCameraToEra = (
    era: HistoricalEra,
    camera: ArcRotateCamera,
    scene: Scene
): void => {
    const [tx, tz] = era.cameraTarget;
    const targetPosition = new Vector3(tx, 0, tz);

    const animDuration = 90; // frames at 60fps = 1.5s

    // Stop existing animations to prevent conflicts when switching rapidly
    scene.stopAnimation(camera, "tl-camera-target");
    scene.stopAnimation(camera, "tl-camera-radius");

    // Animate camera target
    const targetAnim = new Animation(
        "tl-camera-target",
        "target",
        60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    targetAnim.setKeys([
        { frame: 0, value: camera.target.clone() },
        { frame: animDuration, value: targetPosition },
    ]);

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    targetAnim.setEasingFunction(easing);

    // Animate radius to a comfortable zoom
    const radiusAnim = new Animation(
        "tl-camera-radius",
        "radius",
        60,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    const targetRadius = 45;
    radiusAnim.setKeys([
        { frame: 0, value: camera.radius },
        { frame: animDuration, value: targetRadius },
    ]);
    radiusAnim.setEasingFunction(easing);

    camera.animations = [targetAnim, radiusAnim];
    scene.beginAnimation(camera, 0, animDuration, false);
};

// Reuse a single easing instance for performance
const visibilityEasing = new CubicEase();
visibilityEasing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

/**
 * Updates the visibility of heritage site markers based on the active era.
 * Sites associated with the era fade in; others fade out.
 *
 * @param eraId The active era ID
 * @param siteClickBoxes Map of site name → mesh references
 * @param scene BabylonJS scene
 * @returns The number of sites visible for this era
 */
export const updateSiteVisibility = (
    eraId: string,
    siteClickBoxes: Map<string, AbstractMesh[]>,
    scene: Scene
): number => {
    let visibleCount = 0;

    for (const [siteName, meshes] of siteClickBoxes) {
        const associatedEras = SITE_ERA_MAP[siteName] || [];
        const isVisible = associatedEras.includes(eraId);

        if (isVisible) visibleCount++;

        for (const mesh of meshes) {
            // Animate visibility
            const targetAlpha = isVisible ? 1.0 : 0.15;
            const currentAlpha = mesh.visibility;

            if (Math.abs(currentAlpha - targetAlpha) < 0.01) continue;

            // Stop any currently running visibility animation to prevent glitching
            scene.stopAnimation(mesh, `tl-vis-${mesh.name}`);

            const visAnim = new Animation(
                `tl-vis-${mesh.name}`,
                "visibility",
                60,
                Animation.ANIMATIONTYPE_FLOAT,
                Animation.ANIMATIONLOOPMODE_CONSTANT
            );
            visAnim.setKeys([
                { frame: 0, value: currentAlpha },
                { frame: 90, value: targetAlpha }, // 1.5 second duration
            ]);

            visAnim.setEasingFunction(visibilityEasing);

            // Do not accumulate animations on the mesh object
            mesh.animations = [visAnim];
            
            scene.beginDirectAnimation(mesh, [visAnim], 0, 90, false);
        }
    }

    return visibleCount;
};
