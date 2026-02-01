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
    websiteUrl?: string;
    virtualWalkthroughUrl?: string;
    sketchfabUrl?: string;
}
