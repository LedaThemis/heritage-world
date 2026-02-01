import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("side-panel")
export class SidePanel extends LitElement {
    static styles = css`
        :host {
            width: 350px;
            max-height: calc(60vh - 40px - 40px);
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.85);
            border-radius: 12px;
            padding: 20px;
            color: white;
            font-family: sans-serif;
        }

        :host::-webkit-scrollbar {
            width: 8px;
        }

        :host::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }

        :host::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
        }

        :host::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
        }

        h2 {
            margin: 0 0 16px 0;
            font-size: 24px;
            font-weight: bold;
        }
    `;

    protected render() {
        return html`
            <h2>Heritage Sites</h2>
            <slot></slot>
        `;
    }
}
