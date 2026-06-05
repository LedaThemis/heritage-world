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

export interface HeritageSite {
    id: string;
    name: string;
    position: Vector3;
    description: string;
    thumbnailPath: string;
    modelPath?: string;
    worldModelPath?: string;
    worldModelScaling?: Vector3;
    worldModelRotation?: Vector3;
    worldPlayerSpawnPosition?: Vector3;
    worldPlayerRotation?: Vector3;
    websiteUrl?: string;
    virtualWalkthroughUrl?: string;
    sketchfabUrl?: string;
    worldObjects?: { id: string; modelPath: string; position: Vector3; rotation: Vector3; scaling: Vector3 }[];
}
