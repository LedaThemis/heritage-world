/**
 * Heritage Iraq — Site Comments (read-only)
 *
 * Renders the visitor comments section inside a site detail panel.
 * This is the OUTPUT half of the feature only: it displays comments that
 * are attached to a site. Posting new comments (the input) is intentionally
 * not implemented yet — a disabled "coming soon" composer hints at it.
 *
 * Visual language matches the rest of the app: glassmorphism, Mesopotamian
 * gold accents, Inter typography and soft cubic-bezier motion.
 */

import type { HeritageSite, SiteComment } from "../types";

let styleElement: HTMLStyleElement | null = null;

/** Inject the comments stylesheet once. */
export const injectCommentStyles = (): void => {
    if (styleElement) return;

    styleElement = document.createElement("style");
    styleElement.id = "heritage-comment-styles";
    styleElement.textContent = `
        /* ============================================
           SITE COMMENTS — Tokens (self-contained,
           falls back to timeline tokens when present)
           ============================================ */
        .sc-section {
            --sc-gold: var(--tl-gold, #c9a84c);
            --sc-gold-bright: var(--tl-gold-bright, #e6c65a);
            --sc-font: var(--tl-font, 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
            display: flex;
            flex-direction: column;
            gap: 14px;
            margin-top: 4px;
            padding-top: 20px;
            border-top: 1px solid rgba(201, 168, 76, 0.18);
            font-family: var(--sc-font);
        }

        /* ---- Header ---- */
        .sc-header {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .sc-header__title {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #fff;
            letter-spacing: 0.2px;
        }

        .sc-header__count {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 3px 10px;
            background: rgba(201, 168, 76, 0.12);
            border: 1px solid rgba(201, 168, 76, 0.22);
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            color: var(--sc-gold);
            line-height: 1;
        }

        .sc-header__count-icon { font-size: 11px; opacity: 0.85; }

        /* ---- List ---- */
        .sc-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        /* ---- Comment card ---- */
        .sc-comment {
            display: grid;
            grid-template-columns: 36px 1fr;
            gap: 12px;
            padding: 12px 14px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(201, 168, 76, 0.1);
            border-radius: 12px;
            transition: background 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                        border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                        transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 0;
            transform: translateY(8px);
            animation: sc-fade-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .sc-comment:hover {
            background: rgba(255, 255, 255, 0.06);
            border-color: rgba(201, 168, 76, 0.24);
            transform: translateY(-1px);
        }

        @keyframes sc-fade-in {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        /* ---- Avatar ---- */
        .sc-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 700;
            color: rgba(10, 8, 5, 0.92);
            text-transform: uppercase;
            user-select: none;
            background-size: cover;
            background-position: center;
            box-shadow: 0 1px 0 rgba(201, 168, 76, 0.15) inset,
                        0 2px 6px rgba(0, 0, 0, 0.35);
            overflow: hidden;
        }

        /* ---- Comment body ---- */
        .sc-comment__body { min-width: 0; }

        .sc-comment__meta {
            display: flex;
            align-items: baseline;
            gap: 8px;
            margin-bottom: 4px;
        }

        .sc-comment__author {
            font-size: 13.5px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.95);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .sc-comment__time {
            font-size: 11.5px;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.4);
            white-space: nowrap;
            flex-shrink: 0;
        }

        .sc-comment__text {
            margin: 0;
            font-size: 13.5px;
            line-height: 1.55;
            color: rgba(255, 255, 255, 0.82);
            word-wrap: break-word;
            overflow-wrap: anywhere;
        }

        /* ---- Empty state ---- */
        .sc-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            padding: 22px 16px;
            text-align: center;
            background: rgba(255, 255, 255, 0.03);
            border: 1px dashed rgba(201, 168, 76, 0.18);
            border-radius: 12px;
        }

        .sc-empty__icon { font-size: 22px; opacity: 0.55; }

        .sc-empty__title {
            font-size: 13.5px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.7);
        }

        .sc-empty__hint {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.4);
        }

        /* ---- Disabled composer (coming soon) ---- */
        .sc-composer {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 8px 8px 14px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(201, 168, 76, 0.12);
            border-radius: 24px;
            opacity: 0.6;
            cursor: not-allowed;
        }

        .sc-composer__placeholder {
            flex: 1;
            font-size: 13px;
            color: rgba(255, 255, 255, 0.4);
            user-select: none;
        }

        .sc-composer__btn {
            flex-shrink: 0;
            padding: 7px 16px;
            font-family: var(--sc-font);
            font-size: 12.5px;
            font-weight: 600;
            color: rgba(10, 8, 5, 0.7);
            background: linear-gradient(135deg, rgba(230, 198, 90, 0.55), rgba(201, 168, 76, 0.55));
            border: none;
            border-radius: 18px;
            cursor: not-allowed;
            pointer-events: none;
        }

        .sc-composer__note {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 11.5px;
            color: rgba(201, 168, 76, 0.65);
            letter-spacing: 0.2px;
        }
    `;

    document.head.appendChild(styleElement);
};

/** Remove the injected stylesheet (mirrors the timeline module's API). */
export const removeCommentStyles = (): void => {
    if (styleElement) {
        styleElement.remove();
        styleElement = null;
    }
};

/** Warm, on-theme gradient pairs for initials avatars. */
const AVATAR_GRADIENTS = [
    ["#e6c65a", "#c9a84c"], // gold
    ["#d9a066", "#cd853f"], // bronze
    ["#e0b878", "#b8860b"], // amber
    ["#d2a679", "#a9711c"], // copper
    ["#ddc07a", "#9a7b2e"], // antique gold
];

/** Pick a stable gradient for a given author so the same person looks consistent. */
const gradientForAuthor = (author: string): [string, string] => {
    let hash = 0;
    for (let i = 0; i < author.length; i++) {
        hash = (hash * 31 + author.charCodeAt(i)) >>> 0;
    }
    return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length] as [string, string];
};

/** Up to two uppercase initials from a name. */
const initialsFor = (author: string): string => {
    const parts = author.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Human-friendly relative time, e.g. "3h ago", "2d ago". */
const formatRelativeTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    if (diff < 0) return "just now";

    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    const wk = Math.floor(day / 7);
    if (wk < 5) return `${wk}w ago`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(day / 365)}y ago`;
};

/** Build a single comment card element. */
const createCommentCard = (comment: SiteComment, index: number): HTMLElement => {
    const card = document.createElement("div");
    card.className = "sc-comment";
    // Subtle stagger so the list cascades in.
    card.style.animationDelay = `${Math.min(index, 8) * 55}ms`;

    const avatar = document.createElement("div");
    avatar.className = "sc-avatar";
    if (comment.avatarUrl) {
        avatar.style.backgroundImage = `url("${comment.avatarUrl}")`;
    } else {
        const [from, to] = gradientForAuthor(comment.author);
        avatar.style.background = `linear-gradient(135deg, ${from}, ${to})`;
        avatar.textContent = initialsFor(comment.author);
    }
    avatar.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    body.className = "sc-comment__body";

    const meta = document.createElement("div");
    meta.className = "sc-comment__meta";

    const author = document.createElement("span");
    author.className = "sc-comment__author";
    author.textContent = comment.author;

    const time = document.createElement("span");
    time.className = "sc-comment__time";
    time.textContent = formatRelativeTime(comment.timestamp);
    time.title = new Date(comment.timestamp).toLocaleString();

    meta.appendChild(author);
    meta.appendChild(time);

    const text = document.createElement("p");
    text.className = "sc-comment__text";
    text.textContent = comment.text;

    body.appendChild(meta);
    body.appendChild(text);

    card.appendChild(avatar);
    card.appendChild(body);
    return card;
};

/** Empty-state shown when a site has no comments yet. */
const createEmptyState = (): HTMLElement => {
    const empty = document.createElement("div");
    empty.className = "sc-empty";

    const icon = document.createElement("div");
    icon.className = "sc-empty__icon";
    icon.textContent = "💬";

    const title = document.createElement("div");
    title.className = "sc-empty__title";
    title.textContent = "No comments yet";

    const hint = document.createElement("div");
    hint.className = "sc-empty__hint";
    hint.textContent = "Be the first to share a note about this place.";

    empty.appendChild(icon);
    empty.appendChild(title);
    empty.appendChild(hint);
    return empty;
};

/** The disabled "coming soon" composer that hints at future posting. */
const createComposerPlaceholder = (): HTMLElement => {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "8px";

    const composer = document.createElement("div");
    composer.className = "sc-composer";
    composer.setAttribute("aria-disabled", "true");

    const placeholder = document.createElement("span");
    placeholder.className = "sc-composer__placeholder";
    placeholder.textContent = "Share your thoughts…";

    const btn = document.createElement("span");
    btn.className = "sc-composer__btn";
    btn.textContent = "Post";

    composer.appendChild(placeholder);
    composer.appendChild(btn);

    const note = document.createElement("div");
    note.className = "sc-composer__note";
    note.textContent = "🔒 Commenting is coming soon";

    wrap.appendChild(composer);
    wrap.appendChild(note);
    return wrap;
};

export interface CommentsSection {
    /** Root element to append into the site detail panel. */
    element: HTMLElement;
    /** Re-render the section for the given site. */
    update: (site: HeritageSite) => void;
}

/**
 * Create the comments section. Returns a stable root element plus an `update`
 * function to repopulate it whenever a different site is selected.
 */
export const createCommentsSection = (): CommentsSection => {
    injectCommentStyles();

    const section = document.createElement("section");
    section.className = "sc-section";

    // Header (title + live count).
    const header = document.createElement("div");
    header.className = "sc-header";

    const title = document.createElement("h3");
    title.className = "sc-header__title";
    title.textContent = "Comments";

    const count = document.createElement("span");
    count.className = "sc-header__count";

    const countIcon = document.createElement("span");
    countIcon.className = "sc-header__count-icon";
    countIcon.textContent = "💬";
    const countText = document.createElement("span");
    count.appendChild(countIcon);
    count.appendChild(countText);

    header.appendChild(title);
    header.appendChild(count);

    // List container (cards or empty state).
    const list = document.createElement("div");
    list.className = "sc-list";

    section.appendChild(header);
    section.appendChild(list);
    section.appendChild(createComposerPlaceholder());

    const update = (site: HeritageSite): void => {
        const comments = (site.comments ?? [])
            .slice()
            .sort((a, b) => b.timestamp - a.timestamp); // newest first

        countText.textContent = String(comments.length);

        list.replaceChildren();
        if (comments.length === 0) {
            list.appendChild(createEmptyState());
            return;
        }
        comments.forEach((comment, i) => list.appendChild(createCommentCard(comment, i)));
    };

    return { element: section, update };
};
