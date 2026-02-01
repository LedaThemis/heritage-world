import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("website-header")
export class WebsiteHeader extends LitElement {
    static styles = css`
        :host {
            padding: 20px;
            background: rgba(0, 0, 0, 0.85);
            border-radius: 8px;
            color: white;
            font-family: sans-serif;
            pointer-events: none;
        }

        h1 {
            margin: 0;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 0.5px;
        }

        p {
            margin: 4px 0 0 0;
            font-size: 14px;
            font-weight: 300;
            opacity: 0.9;
            letter-spacing: 0.3px;
        }
    `;

    protected render() {
        return html`
            <h1>Heritage Iraq</h1>
            <p>A 3D Interactive Heritage Experience</p>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "website-header": WebsiteHeader;
    }
}
