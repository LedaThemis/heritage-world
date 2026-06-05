/**
 * Heritage Iraq — Timeline CSS Styles
 *
 * Injects all timeline-related styles into the document head.
 * Uses glassmorphism, Mesopotamian gold accents, and premium animations.
 */

let styleElement: HTMLStyleElement | null = null;

export const injectTimelineStyles = (): void => {
    if (styleElement) return; // Already injected

    // Load Inter font from Google Fonts
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap";
    document.head.appendChild(fontLink);

    styleElement = document.createElement("style");
    styleElement.id = "heritage-timeline-styles";
    styleElement.textContent = `
        /* ============================================
           TIMELINE — Design Tokens
           ============================================ */
        :root {
            --tl-gold: #c9a84c;
            --tl-gold-bright: #e6c65a;
            --tl-gold-dim: #8b6914;
            --tl-bronze: #cd853f;
            --tl-glass-bg: rgba(10, 8, 5, 0.78);
            --tl-glass-border: rgba(201, 168, 76, 0.18);
            --tl-glass-border-hover: rgba(201, 168, 76, 0.35);
            --tl-blur: 24px;
            --tl-radius: 16px;
            --tl-radius-sm: 10px;
            --tl-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            --tl-transition: 0.35s cubic-bezier(0.4, 0, 0.2, 1);
            --tl-transition-fast: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ============================================
           TIMELINE — Keyframe Animations
           ============================================ */
        @keyframes tl-glow-pulse {
            0%, 100% {
                box-shadow: 0 0 8px rgba(201, 168, 76, 0.3), 0 0 16px rgba(201, 168, 76, 0.1);
            }
            50% {
                box-shadow: 0 0 12px rgba(201, 168, 76, 0.5), 0 0 24px rgba(201, 168, 76, 0.2);
            }
        }

        @keyframes tl-fade-slide-up {
            from {
                opacity: 0;
                transform: translateY(12px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes tl-fade-slide-down {
            from {
                opacity: 1;
                transform: translateY(0);
            }
            to {
                opacity: 0;
                transform: translateY(8px);
            }
        }

        @keyframes tl-shimmer {
            0% {
                background-position: -200% center;
            }
            100% {
                background-position: 200% center;
            }
        }

        @keyframes tl-scrubber-pulse {
            0%, 100% {
                box-shadow: 0 0 0 0 rgba(201, 168, 76, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);
            }
            50% {
                box-shadow: 0 0 0 6px rgba(201, 168, 76, 0.08), 0 2px 8px rgba(0, 0, 0, 0.3);
            }
        }

        @keyframes tl-entrance {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        /* ============================================
           TIMELINE — Panel Container
           ============================================ */
        .tl-panel {
            position: fixed;
            bottom: 24px;
            /* Left edge = sidebar width (390px) + sidebar offset (20px) + gap (20px) = 430px */
            left: 430px;
            right: 20px;
            z-index: 200;
            padding: 18px 28px 20px;
            max-width: 900px;
            background: var(--tl-glass-bg);
            backdrop-filter: blur(var(--tl-blur));
            -webkit-backdrop-filter: blur(var(--tl-blur));
            border: 1px solid var(--tl-glass-border);
            border-radius: var(--tl-radius);
            font-family: var(--tl-font);
            box-shadow:
                0 8px 32px rgba(0, 0, 0, 0.4),
                0 1px 0 rgba(201, 168, 76, 0.08) inset;
            animation: tl-entrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            user-select: none;
            -webkit-user-select: none;
        }

        /* ============================================
           TIMELINE — Era Labels Row
           ============================================ */
        .tl-eras {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 14px;
            gap: 4px;
        }

        .tl-era-label {
            position: relative;
            padding: 6px 10px;
            border: none;
            background: transparent;
            color: rgba(255, 255, 255, 0.45);
            font-family: var(--tl-font);
            font-size: 12px;
            font-weight: 500;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            cursor: pointer;
            transition: all var(--tl-transition-fast);
            white-space: nowrap;
            border-radius: 6px;
            outline: none;
        }

        .tl-era-label:hover {
            color: rgba(255, 255, 255, 0.8);
            background: rgba(201, 168, 76, 0.08);
        }

        .tl-era-label--active {
            color: var(--tl-gold-bright) !important;
            font-weight: 600;
            background: rgba(201, 168, 76, 0.1) !important;
        }

        .tl-era-label--active::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 60%;
            height: 2px;
            background: linear-gradient(90deg, transparent, var(--tl-gold), transparent);
            border-radius: 1px;
            animation: tl-glow-pulse 2.5s ease-in-out infinite;
        }

        .tl-era-year {
            display: block;
            font-size: 10px;
            font-weight: 400;
            letter-spacing: 0.3px;
            text-transform: none;
            color: rgba(255, 255, 255, 0.3);
            margin-top: 2px;
            transition: color var(--tl-transition-fast);
        }

        .tl-era-label--active .tl-era-year {
            color: rgba(201, 168, 76, 0.6);
        }

        .tl-era-label:hover .tl-era-year {
            color: rgba(255, 255, 255, 0.5);
        }

        /* ============================================
           TIMELINE — Track & Progress
           ============================================ */
        .tl-track-container {
            position: relative;
            width: 100%;
            height: 20px;
            display: flex;
            align-items: center;
            cursor: pointer;
        }

        .tl-track {
            position: absolute;
            left: 0;
            right: 0;
            height: 3px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 2px;
            overflow: visible;
        }

        .tl-progress {
            position: absolute;
            left: 0;
            top: 0;
            height: 100%;
            border-radius: 2px;
            background: linear-gradient(90deg, var(--tl-gold-dim), var(--tl-gold));
            transition: width var(--tl-transition);
            box-shadow: 0 0 10px rgba(201, 168, 76, 0.3);
            animation: tl-glow-pulse 3s ease-in-out infinite;
        }

        /* Era tick marks on the track */
        .tl-tick {
            position: absolute;
            top: -4px;
            width: 1px;
            height: 11px;
            background: rgba(255, 255, 255, 0.12);
            border-radius: 1px;
            transition: background var(--tl-transition-fast);
        }

        .tl-tick--passed {
            background: rgba(201, 168, 76, 0.35);
        }

        /* ============================================
           TIMELINE — Scrubber Handle
           ============================================ */
        .tl-scrubber {
            position: absolute;
            top: 50%;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--tl-gold-bright), var(--tl-gold));
            border: 2.5px solid rgba(255, 255, 255, 0.9);
            transform: translate(-50%, -50%);
            cursor: grab;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 10;
            animation: tl-scrubber-pulse 3s ease-in-out infinite;
        }

        .tl-scrubber:hover {
            transform: translate(-50%, -50%) scale(1.2);
            box-shadow: 0 0 0 6px rgba(201, 168, 76, 0.15), 0 2px 12px rgba(0, 0, 0, 0.4);
        }

        .tl-scrubber--dragging {
            cursor: grabbing !important;
            transform: translate(-50%, -50%) scale(1.3) !important;
            box-shadow: 0 0 0 8px rgba(201, 168, 76, 0.2), 0 4px 16px rgba(0, 0, 0, 0.5) !important;
            animation: none !important;
            transition: none !important;
        }

        /* ============================================
           TIMELINE — Info Card
           ============================================ */
        .tl-info-card {
            width: 100%;
            padding-bottom: 16px;
            margin-bottom: 14px;
            border-bottom: 1px solid rgba(201, 168, 76, 0.15);
            font-family: var(--tl-font);
            animation: tl-fade-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            pointer-events: none;
            display: grid;
            grid-template-columns: auto 1fr auto;
            grid-template-rows: auto auto;
            gap: 4px 32px;
            align-items: center;
        }

        .tl-info-card__era-icon {
            display: inline-block;
            margin-right: 8px;
            font-size: 14px;
            opacity: 0.7;
        }

        .tl-info-card__era-name {
            grid-column: 1;
            grid-row: 1;
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            color: var(--tl-gold-bright);
            line-height: 1.3;
        }

        .tl-info-card__date-range {
            grid-column: 1;
            grid-row: 2;
            margin: 0;
            font-size: 13px;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.5);
            letter-spacing: 0.5px;
        }

        .tl-info-card__description {
            grid-column: 2;
            grid-row: 1 / span 2;
            margin: 0;
            font-size: 13.5px;
            font-weight: 400;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.8);
        }

        .tl-info-card__sites-badge {
            grid-column: 3;
            grid-row: 1 / span 2;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 12px;
            background: rgba(201, 168, 76, 0.12);
            border: 1px solid rgba(201, 168, 76, 0.2);
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            color: var(--tl-gold);
            white-space: nowrap;
        }

        .tl-info-card__sites-icon {
            font-size: 12px;
        }

        /* ============================================
           TIMELINE — Responsive
           ============================================ */

        /* Sidebar collapses on smaller screens — use full-width centering below 900px */
        @media (max-width: 900px) {
            .tl-panel {
                left: 16px;
                right: 16px;
                padding: 14px 16px 16px;
                bottom: 16px;
            }

            .tl-info-card {
                width: 100%;
                padding-bottom: 12px;
                margin-bottom: 12px;
                grid-template-columns: 1fr auto;
                grid-template-rows: auto auto auto;
                gap: 8px 16px;
            }

            .tl-info-card__era-name { grid-column: 1; grid-row: 1; }
            .tl-info-card__date-range { grid-column: 1; grid-row: 2; }
            .tl-info-card__sites-badge { grid-column: 2; grid-row: 1 / span 2; align-self: center; }
            .tl-info-card__description { grid-column: 1 / span 2; grid-row: 3; margin-top: 4px; }

            .tl-era-label {
                font-size: 10px;
                padding: 4px 6px;
                letter-spacing: 0.3px;
            }

            .tl-era-year {
                display: none;
            }

            .tl-info-card__era-name {
                font-size: 15px;
            }
        }

        @media (max-width: 500px) {
            .tl-era-label {
                font-size: 9px;
                padding: 3px 4px;
            }

            .tl-info-card {
                grid-template-columns: 1fr;
                grid-template-rows: auto auto auto auto;
                gap: 6px;
            }

            .tl-info-card__era-name { grid-column: 1; grid-row: 1; }
            .tl-info-card__date-range { grid-column: 1; grid-row: 2; }
            .tl-info-card__sites-badge { grid-column: 1; grid-row: 3; justify-self: start; }
            .tl-info-card__description { grid-column: 1; grid-row: 4; margin-top: 4px; }
        }
    `;

    document.head.appendChild(styleElement);
};

export const removeTimelineStyles = (): void => {
    if (styleElement) {
        styleElement.remove();
        styleElement = null;
    }
};
