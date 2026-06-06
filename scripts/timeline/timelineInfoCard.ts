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

    currentEraId = era.id;
    const icon = ERA_ICONS[era.id] || "⚜";

    // If card already exists, seamlessly update its text with a quick fade
    if (cardElement) {
        cardElement.style.transition = "opacity 0.15s ease-out";
        cardElement.style.opacity = "0";

        setTimeout(() => {
            if (!cardElement) return;

            const eraName = cardElement.querySelector(".tl-info-card__era-name");
            const dateRange = cardElement.querySelector(".tl-info-card__date-range");
            const description = cardElement.querySelector(".tl-info-card__description");
            const sitesBadge = cardElement.querySelector(".tl-info-card__sites-badge");

            if (eraName) eraName.innerHTML = `<span class="tl-info-card__era-icon">${icon}</span> ${era.name}`;
            if (dateRange) dateRange.textContent = era.displayRange;
            if (description) description.textContent = era.description;
            if (sitesBadge) sitesBadge.innerHTML = `<span class="tl-info-card__sites-icon">📍</span> ${visibleSiteCount} heritage site${visibleSiteCount !== 1 ? "s" : ""} visible`;

            cardElement.style.opacity = "1";
        }, 150);
        return;
    }

    // Build new card
    const card = document.createElement("div");
    card.className = "tl-info-card";

    // Era icon + name
    const eraName = document.createElement("h3");
    eraName.className = "tl-info-card__era-name";
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

    // Append directly inside timeline panel to integrate visually
    const panel = document.querySelector(".tl-panel");
    if (panel) {
        panel.insertBefore(card, panel.firstChild);
    } else {
        document.body.appendChild(card);
    }
    cardElement = card;
};

/**
 * Removes the info card with fade out animation.
 */
export const hideInfoCard = (): void => {
    if (cardElement) {
        cardElement.style.transition = "opacity 0.25s ease-in";
        cardElement.style.opacity = "0";
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
