import type { Vector3 } from "@babylonjs/core";

export interface PlayerRoomType {
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

export interface SiteComment {
    id: string;
    /** Display name of the commenter. */
    author: string;
    /** Optional avatar image URL. When absent, an initials avatar is rendered. */
    avatarUrl?: string;
    /** The comment body. */
    text: string;
    /** Creation time as epoch milliseconds. Used to render relative time. */
    timestamp: number;
}

export interface HeritageSite {
    id: string;
    name: string;
    position: Vector3;
    description: string;
    thumbnailPath: string;
    modelPath?: string;
    markerScale?: number;
    markerRotation?: number; // radians, spins the marker around the vertical axis
    worldModelPath?: string;
    worldModelScaling?: Vector3;
    worldModelRotation?: Vector3;
    worldPlayerSpawnPosition?: Vector3;
    worldPlayerRotation?: Vector3;
    websiteUrl?: string;
    virtualWalkthroughUrl?: string;
    sketchfabUrl?: string;
    worldObjects?: { id: string; modelPath: string; position: Vector3; rotation: Vector3; scaling: Vector3 }[];
    /** Visitor comments shown in the site detail panel (read-only for now). */
    comments?: SiteComment[];
}
