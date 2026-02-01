import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { HeritageSite } from "../../types";

@customElement("site-info-panel")
export class SiteInfoPanel extends LitElement {
    static styles = css`
        :host {
            position: fixed;
            top: 20px;
            right: -400px;
            width: 360px;
            max-height: calc(100vh - 40px);
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.85);
            border-radius: 12px;
            padding: 24px;
            z-index: 100;
            display: flex;
            flex-direction: column;
            gap: 20px;
            transition: right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
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

        .site-header {
            margin: 0;
            font-size: 24px;
            font-weight: bold;
            color: white;
        }

        .site-description {
            margin: 0;
            font-size: 15px;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.9);
        }

        .features {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 8px;
        }

        .features-header {
            margin: 0 0 8px 0;
            font-size: 16px;
            font-weight: 600;
            color: white;
        }

        .feature-item {
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.9);
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
        }

        .feature-item-header {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .feature-item-icon {
            font-size: 18px;
            font-weight: bold;
            color: #10b981;
        }

        .feature-item-label {
            font-weight: 600;
        }

        .feature-item-description {
            margin: 0 0 4px 28px;
            font-size: 13px;
            color: rgba(255, 255, 255, 0.7);
        }

        .feature-item-link {
            color: #60a5fa;
            font-size: 13px;
            text-decoration: none;
            margin-left: 28px;
            word-break: break-all;
            transition: color 0.2s ease;
        }

        .feature-item-link:hover {
            color: "#93c5fd";
        }

        .site-button {
            width: 100%;
            padding: 12px 32px;
            font-size: 16px;
            font-weight: bold;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-top: 8px;
        }

        .site-button:hover {
            background: #2563eb;
        }
    `;

    @property({ type: Object })
    site: Pick<
        HeritageSite,
        "name" | "description" | "sketchfabUrl" | "virtualWalkthroughUrl" | "websiteUrl" | "worldModelPath"
    > = {
        name: "",
        description: "",
    };

    @property()
    onStartExperience?: () => void;

    get siteFeatures() {
        return [
            ...(this.site.websiteUrl
                ? [
                      {
                          label: "External Website",
                          url: this.site.websiteUrl,
                          description: "You can visit the external website at:",
                      },
                  ]
                : []),
            ...(this.site.virtualWalkthroughUrl
                ? [
                      {
                          label: "Virtual Walkthrough",
                          url: this.site.virtualWalkthroughUrl,
                          description: "You can experience the virtual walkthrough at:",
                      },
                  ]
                : []),
            ...(this.site.sketchfabUrl
                ? [
                      {
                          label: "Sketchfab 3D Collection",
                          url: this.site.sketchfabUrl,
                          description: "You can view the Sketchfab collection at:",
                      },
                  ]
                : []),
            ...(this.site.worldModelPath
                ? [
                      {
                          label: "Interactive Experience",
                          url: null,
                          description:
                              'You can immerse yourself in the interactive experience by clicking "Start Experience" below.',
                      },
                  ]
                : []),
        ];
    }

    protected render() {
        return html`
            <h2 class="site-header">${this.site.name}</h2>
            <p class="site-description">${this.site.description}</p>
            ${this.siteFeatures.length > 0
                ? html` <div class="features">
                      <h3 class="features-header">Available Features</h3>
                      ${this.siteFeatures.map(
                          (feature) => html`
                              <div class="feature-item">
                                  <div class="feature-item-header">
                                      <span class="feature-item-icon">✓</span>
                                      <span class="feature-item-label">${feature.label}</span>
                                  </div>
                                  <p class="feature-item-description">${feature.description}</p>
                                  ${feature.url
                                      ? html`
                                            <a
                                                class="feature-item-link"
                                                href="${feature.url}"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                ${feature.url}
                                            </a>
                                        `
                                      : nothing}
                              </div>
                          `
                      )}
                  </div>`
                : nothing}
            ${this.site.worldModelPath
                ? html`<button class="site-button" @click="${this.onStartExperience}">Start Experience</button>`
                : nothing}
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "site-info-panel": SiteInfoPanel;
    }
}
