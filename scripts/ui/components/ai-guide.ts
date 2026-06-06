import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HeritageSite } from "../../types";

interface GuideMessage {
    role: "user" | "assistant";
    content: string;
}

/**
 * Aoi — a persistent 2D guide character pinned to the right-middle of the screen.
 *
 * She stays on screen across the map and the sites ("travels with you"). She speaks
 * replies aloud and listens hands-free; a speech bubble shows the subtitle. This is
 * NOT a chat box.
 *
 * Driven from main.ts: greet() (talk about current site), welcome() (general),
 * toggleListen() (mute), deactivate().
 */
@customElement("ai-guide")
export class AiGuide extends LitElement {
    /** Current heritage site (null = world map). */
    @property({ attribute: false }) site: HeritageSite | null = null;

    @state() private caption = "";
    @state() private status: "idle" | "listening" | "thinking" | "speaking" = "idle";
    @state() private handsFree = false;

    private history: GuideMessage[] = [];
    private recognition: any = null;
    private recognizing = false;
    private clearTimer: number | null = null;

    // Professional rig: if a Rive model (public/assets/aoi/aoi.riv) is present, we play it and drive
    // its "State" machine by her status. Until then we fall back to the layered PNG rig, then emoji.
    @state() private rigFailed = false;
    @state() private riveReady = false;
    private rive: any = null;
    private riveStateInput: any = null;
    private onResize = () => {
        try {
            this.rive?.resizeDrawingSurfaceToCanvas?.();
        } catch {
            /* ignore */
        }
    };

    static styles = css`
        :host {
            position: fixed;
            right: 22px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 250;
            font-family: sans-serif;
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 14px;
        }

        /* Speech bubble sits to the LEFT of the avatar */
        .bubble {
            position: relative;
            max-width: 300px;
            background: rgba(10, 10, 14, 0.92);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 14px;
            padding: 14px 16px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(6px);
            animation: pop 0.18s ease-out;
        }
        .bubble::after {
            content: "";
            position: absolute;
            right: -9px;
            top: 50%;
            transform: translateY(-50%);
            border-top: 9px solid transparent;
            border-bottom: 9px solid transparent;
            border-left: 9px solid rgba(10, 10, 14, 0.92);
        }
        .name {
            font-size: 11px;
            font-weight: 700;
            color: #93c5fd;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .pill {
            font-size: 10px;
            font-weight: 600;
            padding: 2px 7px;
            border-radius: 999px;
            text-transform: none;
            letter-spacing: normal;
        }
        .pill.listening {
            background: #ef4444;
            color: white;
        }
        .pill.thinking {
            background: rgba(255, 255, 255, 0.15);
            color: rgba(255, 255, 255, 0.85);
        }
        .pill.speaking {
            background: #3b82f6;
            color: white;
        }
        .text {
            margin-top: 5px;
            font-size: 14px;
            line-height: 1.5;
            color: white;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .foot {
            margin-top: 8px;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.4);
        }

        /* The character avatar (always visible) */
        .avatar-wrap {
            pointer-events: auto;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
        }
        .avatar {
            height: min(300px, 70vh);
            width: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 56px;
            filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5));
            animation: bob 3.2s ease-in-out infinite;
        }
        canvas.rive {
            height: 100%;
            width: auto;
            aspect-ratio: 600 / 980;
            display: block;
        }
        canvas.rive[hidden] {
            display: none;
        }
        .rig {
            position: relative;
            height: 100%;
            aspect-ratio: 360 / 587;
        }
        .layer {
            position: absolute;
            inset: 0;
            height: 100%;
            width: 100%;
            object-fit: contain;
        }
        .layer.base {
            transform-origin: 50% 100%;
            animation: breathe 3.6s ease-in-out infinite;
        }
        .layer.arm {
            transform-origin: 80% 27%;
            animation: armsway 3.6s ease-in-out infinite;
        }
        .avatar.speaking .layer.arm {
            animation: wave 0.95s ease-in-out infinite;
        }
        .avatar.speaking .layer.base {
            animation: breathe 2.2s ease-in-out infinite;
        }
        .avatar-wrap:hover .avatar {
            transform: scale(1.04);
        }
        .avatar.listening {
            animation: bob 3.2s ease-in-out infinite, glow 1.2s infinite;
        }
        .avatar.speaking {
            animation: bob 2.4s ease-in-out infinite;
        }
        .avatar.thinking {
            animation: tilt 1.4s ease-in-out infinite;
        }
        .tag {
            font-size: 11px;
            font-weight: 600;
            color: white;
            background: rgba(0, 0, 0, 0.6);
            padding: 3px 10px;
            border-radius: 999px;
            white-space: nowrap;
        }
        @keyframes pop {
            from {
                opacity: 0;
                transform: translateX(8px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        @keyframes bob {
            0%,
            100% {
                transform: translateY(0);
            }
            50% {
                transform: translateY(-5px);
            }
        }
        @keyframes tilt {
            0%,
            100% {
                transform: rotate(-3deg);
            }
            50% {
                transform: rotate(3deg);
            }
        }
        @keyframes glow {
            0%,
            100% {
                filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 0 rgba(239, 68, 68, 0));
            }
            50% {
                filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 9px rgba(239, 68, 68, 0.95));
            }
        }
        @keyframes breathe {
            0%,
            100% {
                transform: scaleY(1) translateY(0);
            }
            50% {
                transform: scaleY(1.018) translateY(-1px);
            }
        }
        @keyframes armsway {
            0%,
            100% {
                transform: rotate(-2deg);
            }
            50% {
                transform: rotate(3deg);
            }
        }
        @keyframes wave {
            0% {
                transform: rotate(-6deg);
            }
            20% {
                transform: rotate(14deg);
            }
            40% {
                transform: rotate(-2deg);
            }
            60% {
                transform: rotate(16deg);
            }
            80% {
                transform: rotate(2deg);
            }
            100% {
                transform: rotate(-6deg);
            }
        }
        @media (max-width: 520px) {
            .bubble {
                max-width: 180px;
            }
            .avatar {
                width: 64px;
                height: 64px;
                font-size: 34px;
            }
        }
    `;

    connectedCallback(): void {
        super.connectedCallback();
        this.setupRecognition();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.deactivate();
        window.removeEventListener("resize", this.onResize);
        try {
            this.rive?.cleanup?.();
        } catch {
            /* ignore */
        }
        this.rive = null;
    }

    protected firstUpdated(): void {
        this.initRive();
    }

    protected updated(changed: Map<string, unknown>): void {
        if (changed.has("status") && this.riveReady) this.applyRiveState();
    }

    private async initRive() {
        try {
            // Only load the Rive runtime + model once the rigged model has actually been added.
            // (Dev servers fall back to index.html for missing files, so also reject HTML.)
            const head = await fetch("/assets/aoi/aoi.riv", { method: "HEAD" });
            const contentType = head.headers.get("content-type") || "";
            if (!head.ok || contentType.includes("text/html")) return; // no model yet -> keep PNG rig
            const canvas = this.renderRoot.querySelector("canvas.rive") as HTMLCanvasElement | null;
            if (!canvas) return;
            const { Rive } = await import("@rive-app/canvas");
            this.rive = new Rive({
                src: "/assets/aoi/aoi.riv",
                canvas,
                autoplay: true,
                stateMachines: "State",
                onLoad: () => {
                    try {
                        this.rive.resizeDrawingSurfaceToCanvas();
                        const inputs = this.rive.stateMachineInputs("State") || [];
                        this.riveStateInput = inputs.find((i: any) => i.name === "state") || null;
                        this.riveReady = true;
                        this.applyRiveState();
                        window.addEventListener("resize", this.onResize);
                    } catch {
                        /* ignore */
                    }
                },
                onLoadError: () => {
                    this.riveReady = false;
                },
            });
        } catch {
            this.riveReady = false;
        }
    }

    /** Map her status to the Rive "state" number input (0 idle, 1 listening, 2 thinking, 3 speaking). */
    private applyRiveState() {
        if (!this.riveStateInput) return;
        const map: Record<string, number> = { idle: 0, listening: 1, thinking: 2, speaking: 3 };
        this.riveStateInput.value = map[this.status] ?? 0;
    }

    // ---------------- Public API (called from main.ts) ----------------

    /** Talk about the current site (and then listen hands-free). */
    async greet(): Promise<void> {
        if (this.status === "thinking") return;
        this.history = [];
        this.handsFree = true;
        await this.ask(
            "(You are the visitor's guide and have just arrived with them at this place. Greet them warmly and introduce it in 2 short sentences, then invite them to ask you anything.)",
            { silentUser: true }
        );
    }

    /** General welcome on the world map (no specific site). */
    async welcome(): Promise<void> {
        if (this.status === "thinking") return;
        this.site = null;
        this.history = [];
        this.handsFree = true;
        await this.ask(
            "(The visitor just said hello to you on the world map of Iraq. Warmly welcome them and invite them to click any heritage site on the map to hear about it.)",
            { silentUser: true }
        );
    }

    /** Toggle the hands-free mic on/off (mute). */
    toggleListen(): void {
        if (!this.recognition) {
            this.show("Voice isn't supported in this browser — try Chrome.", 4000);
            return;
        }
        if (this.handsFree) {
            this.handsFree = false;
            this.stopRec();
            this.status = "idle";
            this.show("Mic muted. Tap me or press V to talk again.", 3000);
        } else {
            this.handsFree = true;
            window.speechSynthesis?.cancel();
            this.startRec();
        }
    }

    /** Stop everything (e.g. when leaving a scene). */
    deactivate(): void {
        this.handsFree = false;
        this.stopRec();
        try {
            window.speechSynthesis?.cancel();
        } catch {
            /* ignore */
        }
        this.status = "idle";
        this.caption = "";
    }

    private onAvatarClick = () => {
        // Tapping the character: welcome on the map, or (re)introduce the current site.
        if (this.status === "thinking" || this.status === "speaking") return;
        if (this.site) this.greet();
        else this.welcome();
    };

    // ---------------- Speech recognition (continuous) ----------------

    private setupRecognition() {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const rec = new SR();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = false;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
            this.recognizing = true;
            if (this.handsFree && this.status === "idle") this.status = "listening";
        };
        rec.onend = () => {
            this.recognizing = false;
            if (this.handsFree && this.status !== "thinking" && this.status !== "speaking") {
                this.startRec();
            }
        };
        rec.onerror = (e: any) => {
            this.recognizing = false;
            if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
                this.handsFree = false;
                this.show("Microphone is blocked. Allow mic access, then tap me.", 6000);
            }
        };
        rec.onresult = (e: any) => {
            const transcript = e.results?.[e.results.length - 1]?.[0]?.transcript?.trim();
            if (transcript && transcript.length >= 2) this.ask(transcript);
        };

        this.recognition = rec;
    }

    private startRec() {
        if (!this.recognition || this.recognizing || !this.handsFree) return;
        if (this.status === "idle") this.status = "listening";
        try {
            this.recognition.start();
        } catch {
            /* already running */
        }
    }

    private stopRec() {
        if (!this.recognition || !this.recognizing) return;
        try {
            this.recognition.stop();
        } catch {
            /* ignore */
        }
    }

    // ---------------- Talking to the model ----------------

    private get apiBase(): string {
        const explicit = import.meta.env.VITE_GUIDE_API_URL as string | undefined;
        if (explicit) return explicit.replace(/\/$/, "");
        const server = (import.meta.env.VITE_SERVER_URL as string) || "http://localhost:2567";
        return server.replace(/^ws/, "http").replace(/\/$/, "");
    }

    private siteContext() {
        if (!this.site) return undefined;
        const artifacts = (this.site.worldObjects || [])
            .map((o) => o.id)
            .filter(Boolean)
            .map((id) => id.replace(/[-_]+/g, " ").trim());
        return {
            id: this.site.id,
            name: this.site.name,
            description: this.site.description,
            artifacts: artifacts.length ? artifacts : undefined,
        };
    }

    private async ask(text: string, opts: { silentUser?: boolean } = {}) {
        if (this.clearTimer) {
            clearTimeout(this.clearTimer);
            this.clearTimer = null;
        }
        this.status = "thinking";
        this.stopRec();
        this.history = [...this.history, { role: "user", content: text }].slice(-10);
        if (!opts.silentUser) this.caption = text;

        try {
            const res = await fetch(`${this.apiBase}/api/guide`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: this.history.map((m) => ({ role: m.role, content: m.content })),
                    site: this.siteContext(),
                }),
            });
            const data = await res.json().catch(() => ({}));
            const reply = data.reply || "Sorry, I had trouble answering that.";
            this.history = [...this.history, { role: "assistant", content: reply }].slice(-10);
            this.speak(reply);
        } catch {
            this.status = "idle";
            this.show("I couldn't reach the server. Is it running?", 5000);
            this.startRec();
        }
    }

    private speak(text: string) {
        this.status = "speaking";
        this.caption = text;

        const done = () => {
            this.status = "idle";
            this.scheduleClear();
            this.startRec();
        };

        if (!("speechSynthesis" in window)) {
            done();
            return;
        }
        try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.rate = 1;
            u.pitch = 1.05;
            u.onend = done;
            u.onerror = done;
            window.speechSynthesis.speak(u);
        } catch {
            done();
        }
    }

    private show(text: string, ms = 4000) {
        this.caption = text;
        this.scheduleClear(ms);
    }

    private scheduleClear(ms = 9000) {
        if (this.clearTimer) clearTimeout(this.clearTimer);
        this.clearTimer = window.setTimeout(() => {
            if (this.status === "idle" || this.status === "listening") this.caption = "";
        }, ms);
    }

    protected render() {
        const showBubble = !!this.caption || this.status !== "idle";

        const pill =
            this.status === "listening"
                ? html`<span class="pill listening">● listening</span>`
                : this.status === "thinking"
                  ? html`<span class="pill thinking">thinking…</span>`
                  : this.status === "speaking"
                    ? html`<span class="pill speaking">speaking</span>`
                    : nothing;

        const bubble = showBubble
            ? html`
                  <div class="bubble">
                      <div class="name">Aoi ${pill}</div>
                      ${this.caption ? html`<div class="text">${this.caption}</div>` : nothing}
                      <div class="foot">${this.handsFree ? "Just speak" : "Tap me to talk"} · ✨ AI, may be imprecise</div>
                  </div>
              `
            : nothing;

        return html`
            ${bubble}
            <div class="avatar-wrap" @click=${this.onAvatarClick} title="Talk to Aoi">
                <div class="avatar ${this.status}">
                    <canvas class="rive" ?hidden=${!this.riveReady}></canvas>
                    ${this.riveReady
                        ? nothing
                        : this.rigFailed
                          ? html`<span class="face">🧕</span>`
                          : html`
                                <div class="rig">
                                    <img
                                        class="layer base"
                                        src="/assets/aoi/base.png"
                                        alt="Aoi"
                                        @error=${() => (this.rigFailed = true)}
                                    />
                                    <img class="layer arm" src="/assets/aoi/arm.png" alt="" />
                                </div>
                            `}
                </div>
                <div class="tag">Aoi · guide</div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "ai-guide": AiGuide;
    }
}
