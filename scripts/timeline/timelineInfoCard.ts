/**
 * Heritage Iraq — Timeline Info Card
 *
 * Floating glassmorphism card that displays era details above the timeline panel.
 * Supports animated entrance/exit and smooth content transitions.
 */

import { HistoricalEra } from "./timelineData";

let cardElement: HTMLDivElement | null = null;
let currentEraId: string | null = null;

const ERA_ICONS: Record<string, string> = {
    sumerian: "𒀭",
    babylonian: "🏛",
    assyrian: "🦁",
    islamic: "☪",
    ottoman: "🕌",
    modern: "🏗",
};

/**
 * Creates or updates the floating info card with era details.
 */
export const showInfoCard = (era: HistoricalEra, visibleSiteCount: number): void => {
    // If same era, don't re-animate
    if (currentEraId === era.id && cardElement) {
        // Just update site count if it changed
        const badge = cardElement.querySelector(".tl-info-card__sites-badge");
        if (badge) {
            badge.innerHTML = `<span class="tl-info-card__sites-icon">📍</span> ${visibleSiteCount} heritage site${visibleSiteCount !== 1 ? "s" : ""} visible`;
        }
        return;
    }

    const previousCard = cardElement;

    // If there's an existing card, animate it out first
    if (previousCard) {
        previousCard.classList.add("tl-info-card--exiting");
        const exitDuration = 250;
        setTimeout(() => {
            previousCard.remove();
        }, exitDuration);
    }

    currentEraId = era.id;

    // Build new card
    const card = document.createElement("div");
    card.className = "tl-info-card";

    // Era icon + name
    const eraName = document.createElement("h3");
    eraName.className = "tl-info-card__era-name";
    const icon = ERA_ICONS[era.id] || "⚜";
    eraName.innerHTML = `<span class="tl-info-card__era-icon">${icon}</span> ${era.name}`;
    card.appendChild(eraName);

    // Date range
    const dateRange = document.createElement("p");
    dateRange.className = "tl-info-card__date-range";
    dateRange.textContent = era.displayRange;
    card.appendChild(dateRange);

    // Description
    const description = document.createElement("p");
    description.className = "tl-info-card__description";
    description.textContent = era.description;
    card.appendChild(description);

    // Sites badge
    const sitesBadge = document.createElement("div");
    sitesBadge.className = "tl-info-card__sites-badge";
    sitesBadge.innerHTML = `<span class="tl-info-card__sites-icon">📍</span> ${visibleSiteCount} heritage site${visibleSiteCount !== 1 ? "s" : ""} visible`;
    card.appendChild(sitesBadge);

    // Delay insertion slightly so exit animation of previous card is visible
    const delay = previousCard ? 150 : 0;
    setTimeout(() => {
        document.body.appendChild(card);
        cardElement = card;
    }, delay);
};

/**
 * Removes the info card with exit animation.
 */
export const hideInfoCard = (): void => {
    if (cardElement) {
        cardElement.classList.add("tl-info-card--exiting");
        const exitCard = cardElement;
        setTimeout(() => {
            exitCard.remove();
        }, 250);
        cardElement = null;
        currentEraId = null;
    }
};

/**
 * Immediately removes the info card without animation (for cleanup).
 */
export const destroyInfoCard = (): void => {
    if (cardElement) {
        cardElement.remove();
        cardElement = null;
        currentEraId = null;
    }
};
