import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("info-panel")
export class InfoPanel extends LitElement {
    static styles = css`
        :host {
            padding: 20px;
            background: rgba(0, 0, 0, 0.85);
            border-radius: 8px;
            color: white;
            font-family: sans-serif;
            pointer-events: none;
            width: 350px;
            max-height: calc(100vh - 200px);
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.85);
            border-radius: 12px;
            padding: 20px;
            color: white;
            font-family: sans-serif;
        }

        h2 {
            margin: 0 0 16px 0;
            font-size: 24px;
            font-weight: bold;
        }

        p {
            margin: 0 0 20px 0;
            font-size: 14px;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.9);
        }

        a {
            color: #60a5fa;
            font-size: 13px;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.2s ease;
            pointer-events: auto;
        }

        a:hover {
            color: #93c5fd;
        }
    `;

    protected render() {
        return html`
            <h2>About</h2>
            <p>
                Explore Iraq's rich cultural heritage through this immersive 3D experience. Navigate through historic
                sites, ancient cities, and natural wonders that have shaped the cradle of civilization for millennia.
            </p>
            <a href="/credits.html">Learn more →</a>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "info-panel": InfoPanel;
    }
}
