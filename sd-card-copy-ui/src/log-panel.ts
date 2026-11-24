import { css, html, LitElement, type PropertyValues } from 'lit';
import type { ILogEntry } from '../../sd-card-copy-server/src/status.contracts';

const maxEntries = 500;

/**
 * The server's recent log entries, streamed while the panel is open
 */
export class LogPanel extends LitElement {
    static properties = { entries: { state: true } };

    declare entries: ILogEntry[];

    private events: EventSource | undefined;
    private followLatest = true;

    constructor() {
        super();
        this.entries = [];
    }

    static styles = css`
        :host {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            height: 40vh;
            display: flex;
            flex-direction: column;
            background: #0d1117;
            color: #c9d1d9;
            box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.2);
            font:
                12px/1.5 ui-monospace,
                SFMono-Regular,
                Consolas,
                monospace;
        }
        .title {
            display: flex;
            align-items: center;
            padding: 6px 12px;
            background: #161b22;
            font-family: system-ui, sans-serif;
            font-size: 13px;
            font-weight: 600;
        }
        button {
            margin-left: auto;
            font: inherit;
            color: inherit;
            background: none;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 2px 10px;
            cursor: pointer;
        }
        .entries {
            flex: 1;
            overflow-y: auto;
            padding: 6px 12px;
        }
        .entry {
            word-break: break-word;
        }
        .message {
            white-space: pre-wrap;
        }
        .time {
            color: #8b949e;
        }
        .level {
            font-weight: 600;
            color: #58a6ff;
        }
        .warn {
            color: #d29922;
        }
        .error {
            color: #f85149;
        }
        .context {
            color: #a5d6ff;
        }
        .empty {
            color: #8b949e;
        }
    `;

    connectedCallback() {
        super.connectedCallback();
        // the server sends its last 500 entries then each new one
        this.entries = [];
        this.events = new EventSource('api/logs');
        this.events.onmessage = (event) => {
            this.entries = [...this.entries, JSON.parse(event.data)].slice(-maxEntries);
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.events?.close();
    }

    protected render() {
        return html`
            <div class="title">
                Logs
                <button @click=${() => this.dispatchEvent(new Event('close'))}>Close</button>
            </div>
            <div class="entries" @scroll=${this.onScroll}>
                ${this.entries.length === 0 ? html`<div class="empty">No log entries yet</div>` : ''}
                ${this.entries.map(
                    (entry) =>
                        html`<div class="entry">
                            <span class="time">${new Date(entry.timestamp).toLocaleTimeString()}</span>
                            <span class="level ${entry.level}">${entry.level}</span>
                            ${entry.context ? html`<span class="context">[${entry.context}]</span>` : ''}
                            <span class="message ${entry.level}">${entry.message}</span>
                        </div>`
                )}
            </div>
        `;
    }

    protected updated(changed: PropertyValues<this>) {
        if (changed.has('entries') && this.followLatest) {
            const list = this.renderRoot.querySelector('.entries');
            list?.scrollTo({ top: list.scrollHeight });
        }
    }

    /**
     * keep showing the newest entries unless the user has scrolled up to read older ones
     */
    private onScroll(event: Event) {
        const list = event.target as HTMLElement;
        this.followLatest = list.scrollHeight - list.scrollTop - list.clientHeight < 20;
    }
}

customElements.define('log-panel', LogPanel);
