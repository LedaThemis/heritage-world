/**
 * Heritage Iraq — Timeline Panel
 *
 * The main timeline bar component. Creates a floating, bottom-centered
 * glassmorphism panel with:
 *   - Clickable era labels
 *   - Draggable scrubber handle
 *   - Animated progress line
 *   - Hover effects and active state highlighting
 */

import { HISTORICAL_ERAS, getEraIndex, type HistoricalEra } from "./timelineData";
import { injectTimelineStyles, removeTimelineStyles } from "./timelineStyles";
import { showInfoCard, destroyInfoCard } from "./timelineInfoCard";
import { isCloudTransitioning } from "./cloudTransition";

export interface TimelineCallbacks {
    /** Called when the active era changes */
    onEraChange: (era: HistoricalEra, index: number) => void;
}

let panelElement: HTMLDivElement | null = null;
let currentEraIndex = 0;
let isDragging = false;

// References for updating
let progressBar: HTMLDivElement | null = null;
let scrubberHandle: HTMLDivElement | null = null;
let eraLabelButtons: HTMLButtonElement[] = [];
let tickMarks: HTMLDivElement[] = [];
let trackContainer: HTMLDivElement | null = null;

// Callbacks
let callbacks: TimelineCallbacks | null = null;

/**
 * Gets the percentage position (0–100) for an era index.
 */
const getEraPercent = (index: number): number => {
    const count = HISTORICAL_ERAS.length;
    if (count <= 1) return 50;
    return (index / (count - 1)) * 100;
};

/**
 * Finds the nearest era index for a given percentage position.
 */
const getNearestEraIndex = (percent: number): number => {
    const count = HISTORICAL_ERAS.length;
    const index = Math.round((percent / 100) * (count - 1));
    return Math.max(0, Math.min(count - 1, index));
};

/**
 * Updates the visual state of the timeline to reflect the active era.
 */
const updateVisualState = (eraIndex: number, animate = true): void => {
    const percent = getEraPercent(eraIndex);

    // Update progress bar
    if (progressBar) {
        if (animate) {
            progressBar.style.transition = `width var(--tl-transition)`;
        } else {
            progressBar.style.transition = "none";
        }
        progressBar.style.width = `${percent}%`;
    }

    // Update scrubber position
    if (scrubberHandle) {
        if (animate) {
            scrubberHandle.style.transition = `left var(--tl-transition)`;
        } else {
            scrubberHandle.style.transition = "none";
        }
        scrubberHandle.style.left = `${percent}%`;
    }

    // Update era label active states
    eraLabelButtons.forEach((btn, i) => {
        if (i === eraIndex) {
            btn.classList.add("tl-era-label--active");
        } else {
            btn.classList.remove("tl-era-label--active");
        }
    });

    // Update tick marks
    tickMarks.forEach((tick, i) => {
        const tickPercent = getEraPercent(i);
        if (tickPercent <= percent) {
            tick.classList.add("tl-tick--passed");
        } else {
            tick.classList.remove("tl-tick--passed");
        }
    });
};

/**
 * Sets the active era by index and fires the callback.
 */
const setEraByIndex = (index: number, fireCallback = true): void => {
    if (index === currentEraIndex || isCloudTransitioning()) return;
    currentEraIndex = index;
    updateVisualState(index);

    const era = HISTORICAL_ERAS[index];
    if (fireCallback && callbacks?.onEraChange) {
        callbacks.onEraChange(era, index);
    }
};

/**
 * Handles pointer/mouse down on the track for click-to-seek.
 */
const onTrackClick = (e: MouseEvent): void => {
    if (!trackContainer || isDragging || isCloudTransitioning()) return;
    const rect = trackContainer.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    const nearestIndex = getNearestEraIndex(percent);
    setEraByIndex(nearestIndex);
};

let activeOnMove: ((e: MouseEvent | TouchEvent) => void) | null = null;
let activeOnUp: (() => void) | null = null;

/**
 * Handles scrubber drag start.
 */
const onScrubberDown = (e: MouseEvent | TouchEvent): void => {
    if (isCloudTransitioning()) return;
    e.preventDefault();
    e.stopPropagation();
    
    // Clean up any existing listeners just in case
    if (activeOnUp) {
        activeOnUp();
    }
    
    isDragging = true;
    
    const startEraIndex = currentEraIndex;

    if (scrubberHandle) {
        scrubberHandle.classList.add("tl-scrubber--dragging");
    }

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
        if (!isDragging || !trackContainer) return;
        const rect = trackContainer.getBoundingClientRect();
        const clientX =
            moveEvent instanceof MouseEvent ? moveEvent.clientX : (moveEvent as TouchEvent).touches[0].clientX;
        let percent = ((clientX - rect.left) / rect.width) * 100;
        percent = Math.max(0, Math.min(100, percent));

        // Update position immediately (no snap during drag)
        if (progressBar) {
            progressBar.style.transition = "none";
            progressBar.style.width = `${percent}%`;
        }
        if (scrubberHandle) {
            scrubberHandle.style.transition = "none";
            scrubberHandle.style.left = `${percent}%`;
        }

        // Update active label based on nearest era
        const nearestIndex = getNearestEraIndex(percent);
        if (nearestIndex !== currentEraIndex) {
            currentEraIndex = nearestIndex;
            eraLabelButtons.forEach((btn, i) => {
                if (i === nearestIndex) {
                    btn.classList.add("tl-era-label--active");
                } else {
                    btn.classList.remove("tl-era-label--active");
                }
            });
            // Update ticks
            const currentPercent = percent;
            tickMarks.forEach((tick, i) => {
                const tickPercent = getEraPercent(i);
                if (tickPercent <= currentPercent) {
                    tick.classList.add("tl-tick--passed");
                } else {
                    tick.classList.remove("tl-tick--passed");
                }
            });
        }
    };

    const onUp = () => {
        isDragging = false;
        if (scrubberHandle) {
            scrubberHandle.classList.remove("tl-scrubber--dragging");
        }

        // Snap to nearest era
        const nearestIndex = currentEraIndex;
        updateVisualState(nearestIndex, true);

        // Fire callback only if era changed
        if (nearestIndex !== startEraIndex) {
            const era = HISTORICAL_ERAS[nearestIndex];
            if (callbacks?.onEraChange) {
                callbacks.onEraChange(era, nearestIndex);
            }
        }

        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
        document.removeEventListener("touchcancel", onUp);
        
        activeOnMove = null;
        activeOnUp = null;
    };
    
    activeOnMove = onMove;
    activeOnUp = onUp;

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
    document.addEventListener("touchcancel", onUp);
};

/**
 * Creates and mounts the timeline panel into the DOM.
 * Returns a cleanup function.
 */
export const createTimelinePanel = (cbs: TimelineCallbacks): (() => void) => {
    // Inject styles
    injectTimelineStyles();

    callbacks = cbs;
    currentEraIndex = 0;
    eraLabelButtons = [];
    tickMarks = [];

    // --- Panel container ---
    const panel = document.createElement("div");
    panel.className = "tl-panel";

    // --- Era labels row ---
    const erasRow = document.createElement("div");
    erasRow.className = "tl-eras";

    HISTORICAL_ERAS.forEach((era, index) => {
        const btn = document.createElement("button");
        btn.className = "tl-era-label";
        if (index === 0) btn.classList.add("tl-era-label--active");

        const nameSpan = document.createElement("span");
        nameSpan.textContent = era.name;
        btn.appendChild(nameSpan);

        const yearSpan = document.createElement("span");
        yearSpan.className = "tl-era-year";
        yearSpan.textContent = era.representativeYear;
        btn.appendChild(yearSpan);

        btn.addEventListener("click", () => {
            setEraByIndex(index);
        });

        erasRow.appendChild(btn);
        eraLabelButtons.push(btn);
    });

    panel.appendChild(erasRow);

    // --- Track container (clickable area) ---
    const track = document.createElement("div");
    track.className = "tl-track-container";
    trackContainer = track;

    // Track background line
    const trackLine = document.createElement("div");
    trackLine.className = "tl-track";
    track.appendChild(trackLine);

    // Progress fill
    const progress = document.createElement("div");
    progress.className = "tl-progress";
    progress.style.width = "0%";
    trackLine.appendChild(progress);
    progressBar = progress;

    // Era tick marks
    HISTORICAL_ERAS.forEach((_, index) => {
        const tick = document.createElement("div");
        tick.className = "tl-tick";
        const percent = getEraPercent(index);
        tick.style.left = `${percent}%`;
        if (index === 0) tick.classList.add("tl-tick--passed");
        trackLine.appendChild(tick);
        tickMarks.push(tick);
    });

    // Scrubber handle
    const scrubber = document.createElement("div");
    scrubber.className = "tl-scrubber";
    scrubber.style.left = "0%";
    scrubber.addEventListener("mousedown", onScrubberDown);
    scrubber.addEventListener("touchstart", onScrubberDown, { passive: false });
    track.appendChild(scrubber);
    scrubberHandle = scrubber;

    // Track click-to-seek
    track.addEventListener("click", onTrackClick);

    panel.appendChild(track);

    // Mount
    document.body.appendChild(panel);
    panelElement = panel;

    // Show initial info card
    const initialEra = HISTORICAL_ERAS[0];
    showInfoCard(initialEra, initialEra.sites.length);

    // Fire initial callback
    if (callbacks?.onEraChange) {
        callbacks.onEraChange(initialEra, 0);
    }

    // Return cleanup function
    return () => {
        destroyTimeline();
    };
};

/**
 * Programmatically sets the active era by ID.
 */
export const setTimelineEra = (eraId: string): void => {
    const index = getEraIndex(eraId);
    if (index >= 0) {
        setEraByIndex(index);
    }
};

/**
 * Removes the timeline from the DOM and cleans up.
 */
export const destroyTimeline = (): void => {
    if (activeOnUp) {
        activeOnUp();
    }

    if (panelElement) {
        panelElement.remove();
        panelElement = null;
    }

    destroyInfoCard();
    removeTimelineStyles();

    progressBar = null;
    scrubberHandle = null;
    eraLabelButtons = [];
    tickMarks = [];
    trackContainer = null;
    callbacks = null;
    currentEraIndex = 0;
    isDragging = false;
};
