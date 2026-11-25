import { css, html, LitElement, nothing } from 'lit';
import type {
    ICompletedSessions,
    ICopySession,
    ISpeedHistory,
    IStatus,
    SpeedSample,
} from '../../sd-card-copy-server/src/status.contracts';
import { formatSpeed } from './format';
import './copy-session-view';
import './log-panel';
import './speed-graph';

const pageSize = 10;

/**
 * matches the server's total speed history
 */
const totalHistoryMs = 30 * 60 * 1000;

/**
 * The status page: total speed, the sessions in progress and the finished sessions
 */
export class CopyStatusApp extends LitElement {
    static properties = {
        status: { state: true },
        completed: { state: true },
        completedTotal: { state: true },
        connected: { state: true },
        showLogs: { state: true },
        totalHistory: { state: true },
        sessionHistory: { state: true },
    };

    declare status: IStatus | undefined;
    declare completed: ICopySession[];
    declare completedTotal: number;
    declare connected: boolean;
    declare showLogs: boolean;
    declare totalHistory: SpeedSample[];
    declare sessionHistory: Map<number, SpeedSample[]>;

    private events: EventSource | undefined;
    private shownCount = pageSize;
    private lastCompletedId: number | undefined;

    constructor() {
        super();
        this.completed = [];
        this.completedTotal = 0;
        this.connected = false;
        this.showLogs = false;
        this.totalHistory = [];
        this.sessionHistory = new Map();
    }

    static styles = css`
        :host {
            display: block;
            max-width: 1000px;
            margin: 0 auto;
            padding: 16px;
        }
        header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 16px;
        }
        h1 {
            font-size: 20px;
            margin: 0;
        }
        .version {
            font-size: 12px;
            color: #57606a;
            margin-left: -8px;
        }
        .total {
            margin-left: auto;
            text-align: right;
        }
        .total .speed {
            font-size: 28px;
            font-weight: 700;
            color: #0969da;
        }
        .total .label {
            font-size: 12px;
            color: #57606a;
        }
        .total-graph {
            background: white;
            border: 1px solid #d0d7de;
            border-radius: 8px;
            padding: 12px 16px 8px;
            margin-bottom: 16px;
            --speed-graph-height: 120px;
        }
        .disconnected {
            background: #fff8c5;
            border: 1px solid #d4a72c;
            border-radius: 8px;
            padding: 8px 12px;
            margin-bottom: 16px;
            font-size: 14px;
        }
        h2 {
            font-size: 15px;
            color: #57606a;
            margin: 24px 0 8px;
        }
        .sessions {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .empty {
            color: #8c959f;
            font-size: 14px;
        }
        @media (max-width: 600px) {
            :host {
                padding: 8px;
            }
            .total .speed {
                font-size: 22px;
            }
        }
        button.logs {
            margin-top: 0;
        }
        .log-space {
            /* so the end of the page can be scrolled above the log panel */
            height: 40vh;
        }
        button {
            font: inherit;
            margin-top: 12px;
            padding: 6px 16px;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            background: white;
            cursor: pointer;
        }
    `;

    connectedCallback() {
        super.connectedCallback();
        // EventSource reconnects by itself if the server restarts
        this.events = new EventSource('api/status');
        this.events.onopen = () => {
            this.connected = true;
            this.loadSpeedHistory();
        };
        this.events.onerror = () => (this.connected = false);
        this.events.onmessage = (event) => this.onStatus(JSON.parse(event.data));
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.events?.close();
    }

    protected render() {
        const active = this.status?.activeSessions ?? [];

        return html`
            <header>
                <h1>SD Card Copy</h1>
                ${this.status ? html`<span class="version">v${this.status.version}</span>` : nothing}
                <button class="logs" @click=${() => (this.showLogs = !this.showLogs)}>
                    ${this.showLogs ? 'Hide logs' : 'Logs'}
                </button>
                <div class="total">
                    <div class="speed">${formatSpeed(this.status?.totalSpeed ?? 0)}</div>
                    <div class="label">total copy speed</div>
                </div>
            </header>
            <speed-graph class="total-graph" .samples=${this.totalHistory} windowMs=${totalHistoryMs}></speed-graph>
            ${this.connected ? nothing : html`<div class="disconnected">Not connected to the server, retrying…</div>`}

            <h2>In progress</h2>
            <div class="sessions">
                ${
                    active.length === 0
                        ? html`<div class="empty">No copies in progress</div>`
                        : active.map(
                              (session) =>
                                  html`<copy-session-view
                                      .session=${session}
                                      .speedHistory=${this.sessionHistory.get(session.id) ?? []}
                                  ></copy-session-view>`
                          )
                }
            </div>

            <h2>Finished</h2>
            <div class="sessions">
                ${
                    this.completed.length === 0
                        ? html`<div class="empty">No copies since the server started</div>`
                        : this.completed.map(
                              (session) => html`<copy-session-view .session=${session}></copy-session-view>`
                          )
                }
            </div>
            ${
                this.completed.length < this.completedTotal
                    ? html`<button @click=${this.showMore}>More</button>`
                    : nothing
            }
            ${
                this.showLogs
                    ? html`<div class="log-space"></div>
                          <log-panel @close=${() => (this.showLogs = false)}></log-panel>`
                    : nothing
            }
        `;
    }

    private onStatus(status: IStatus) {
        this.status = status;
        this.totalHistory = appendSample(
            this.totalHistory.filter(([time]) => time > status.time - totalHistoryMs),
            [status.time, status.totalSpeed]
        );
        this.sessionHistory = new Map(
            status.activeSessions.map((session) => [
                session.id,
                appendSample(this.sessionHistory.get(session.id) ?? [], [
                    status.time,
                    session.files.reduce((total, file) => total + (file.speed ?? 0), 0),
                ]),
            ])
        );
        this.connected = true;
        if (status.lastCompletedId !== this.lastCompletedId) {
            this.lastCompletedId = status.lastCompletedId;
            this.loadCompleted();
        }
    }

    /**
     * the speeds recorded before the page opened (or reconnected), followed by any added since
     */
    private async loadSpeedHistory() {
        const response = await fetch('api/speed-history');
        const history: ISpeedHistory = await response.json();
        this.totalHistory = mergeSamples(history.total, this.totalHistory);
        const ids = new Set([...Object.keys(history.sessions).map(Number), ...this.sessionHistory.keys()]);
        this.sessionHistory = new Map(
            [...ids].map((id) => [id, mergeSamples(history.sessions[id] ?? [], this.sessionHistory.get(id) ?? [])])
        );
    }

    private showMore() {
        this.shownCount += pageSize;
        this.loadCompleted();
    }

    private async loadCompleted() {
        const response = await fetch(`api/sessions/completed?offset=0&limit=${this.shownCount}`);
        const completed: ICompletedSessions = await response.json();
        this.completed = completed.sessions;
        this.completedTotal = completed.total;
    }
}

function appendSample(samples: SpeedSample[], sample: SpeedSample): SpeedSample[] {
    return mergeSamples(samples, [sample]);
}

/**
 * earlier followed by the samples in later that come after it
 */
function mergeSamples(earlier: SpeedSample[], later: SpeedSample[]): SpeedSample[] {
    const end = earlier.at(-1)?.[0] ?? -Infinity;
    return [...earlier, ...later.filter(([time]) => time > end)];
}

customElements.define('copy-status-app', CopyStatusApp);
