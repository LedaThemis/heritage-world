/**
 * Heritage Iraq — Timeline Historical Data
 *
 * Mock data for the timeline navigation system.
 * Each era represents a major historical period of Mesopotamia/Iraq.
 */

export interface HistoricalEra {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Start year (negative = BCE) */
    startYear: number;
    /** End year (negative = BCE, Infinity = Present) */
    endYear: number;
    /** Human-readable date range */
    displayRange: string;
    /** Representative year for display */
    representativeYear: string;
    /** Heritage site names associated with this era */
    sites: string[];
    /** Short description of the era */
    description: string;
    /** Accent color (gold/bronze palette) */
    color: string;
    /** Camera target bias for this era [x, z] offsets on the map */
    cameraTarget: [number, number];
}

export const HISTORICAL_ERAS: HistoricalEra[] = [
    {
        id: "sumerian",
        name: "Sumerian",
        startYear: -3500,
        endYear: -2000,
        displayRange: "3500 BCE – 2000 BCE",
        representativeYear: "3500 BCE",
        sites: ["Uruk", "Ur", "Eridu"],
        description:
            "Birth of the world's first cities. The Sumerians invented writing, developed complex irrigation systems, and built the earliest known monumental architecture in human history.",
        color: "#d4a847",
        cameraTarget: [0, -15], // Southern Iraq (Uruk area)
    },
    {
        id: "babylonian",
        name: "Babylonian",
        startYear: -2000,
        endYear: -539,
        displayRange: "2000 BCE – 539 BCE",
        representativeYear: "1800 BCE",
        sites: ["Babylon", "Borsippa"],
        description:
            "Era of Hammurabi and monumental architecture. Babylon became the cultural and political center of Mesopotamia, producing the famous Code of Hammurabi and the Hanging Gardens.",
        color: "#c9943c",
        cameraTarget: [-1.5, -1], // Central Iraq (Baghdad area)
    },
    {
        id: "assyrian",
        name: "Assyrian",
        startYear: -2500,
        endYear: -609,
        displayRange: "2500 BCE – 609 BCE",
        representativeYear: "900 BCE",
        sites: ["Nineveh", "Nimrud", "Khorsabad"],
        description:
            "Military and cultural power of northern Mesopotamia. The Assyrian Empire created vast libraries, intricate palace reliefs, and some of the ancient world's most powerful armies.",
        color: "#b8860b",
        cameraTarget: [-12, 11], // Northern Iraq (Mosul/Nineveh area)
    },
    {
        id: "islamic",
        name: "Islamic Golden Age",
        startYear: 750,
        endYear: 1258,
        displayRange: "750 CE – 1258 CE",
        representativeYear: "900 CE",
        sites: ["Baghdad", "Samarra"],
        description:
            "Center of science, philosophy, and learning. Baghdad's House of Wisdom became the intellectual center of the world, advancing mathematics, astronomy, medicine, and literature.",
        color: "#daa520",
        cameraTarget: [-1.5, -1], // Central Iraq (Baghdad)
    },
    {
        id: "ottoman",
        name: "Ottoman Era",
        startYear: 1534,
        endYear: 1918,
        displayRange: "1534 CE – 1918 CE",
        representativeYear: "1700 CE",
        sites: ["Mosul", "Basra"],
        description:
            "Regional trade and imperial administration. Under Ottoman rule, Iraq's cities became vital nodes in transcontinental trade routes, blending local traditions with imperial culture.",
        color: "#cd853f",
        cameraTarget: [-12, 11], // Northern Iraq (Mosul)
    },
    {
        id: "modern",
        name: "Modern Iraq",
        startYear: 1921,
        endYear: Infinity,
        displayRange: "1921 CE – Present",
        representativeYear: "2025",
        sites: ["Baghdad Museum", "Hosh Al-Bay'ah Collection"],
        description:
            "Preservation of Iraq's cultural heritage. Modern Iraq works to protect and celebrate millennia of history through museums, digital archives, and international partnerships.",
        color: "#e6be5a",
        cameraTarget: [-1.5, -1], // Central Iraq (Baghdad)
    },
];

/** Get era by ID */
export const getEraById = (id: string): HistoricalEra | undefined => {
    return HISTORICAL_ERAS.find((era) => era.id === id);
};

/** Get era index by ID */
export const getEraIndex = (id: string): number => {
    return HISTORICAL_ERAS.findIndex((era) => era.id === id);
};

/** Map of existing heritage site names to their associated era IDs */
export const SITE_ERA_MAP: Record<string, string[]> = {
    "Hosh Al-Bay'ah Collection": ["modern", "ottoman"],
    "Old City of Mosul": ["islamic", "ottoman", "modern"],
    "Erbil Citadel": ["sumerian", "assyrian", "islamic", "ottoman", "modern"],
    "Baghdad Museum": ["modern"],
    "Uruk City": ["sumerian"],
    "Al-Chibayish Marshlands": ["sumerian", "modern"],
};
