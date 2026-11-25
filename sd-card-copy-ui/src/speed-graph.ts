import { css, html, LitElement, svg } from 'lit';
import type { SpeedSample } from '../../sd-card-copy-server/src/status.contracts';
import { formatDuration, formatSpeed } from './format';

const width = 1000;
const height = 100;
const megabyte = 1000 * 1000;

/**
 * A line graph of copy speed against time, from the first sample (or windowMs before the last) to the last
 */
export class SpeedGraph extends LitElement {
    static properties = {
        samples: { attribute: false },
        windowMs: { type: Number },
    };

    declare samples: SpeedSample[];
    declare windowMs: number | undefined;

    constructor() {
        super();
        this.samples = [];
    }

    static styles = css`
        :host {
            display: block;
            position: relative;
            font-size: 11px;
            color: #57606a;
        }
        .plot {
            position: relative;
            height: var(--speed-graph-height, 80px);
            border-left: 1px solid #d0d7de;
            border-bottom: 1px solid #d0d7de;
        }
        svg {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
        }
        .grid {
            stroke: #eaeef2;
            stroke-width: 1;
        }
        .line {
            fill: none;
            stroke: #0969da;
            stroke-width: 2;
            stroke-linejoin: round;
        }
        .area {
            fill: #0969da;
            opacity: 0.12;
        }
        .max {
            position: absolute;
            top: 0;
            left: 4px;
            background: rgba(255, 255, 255, 0.8);
        }
        .axis {
            display: flex;
            justify-content: space-between;
            margin-top: 2px;
        }
    `;

    protected render() {
        const samples = this.samples;
        const last = samples.at(-1)?.[0] ?? 0;
        const first = Math.max(samples[0]?.[0] ?? 0, this.windowMs != null ? last - this.windowMs : -Infinity);
        const shown = samples.filter(([time]) => time >= first);
        const max = niceMax(Math.max(0, ...shown.map(([, speed]) => speed)));
        const span = Math.max(1, last - first);
        const points = shown.map(
            ([time, speed]) =>
                `${(((time - first) / span) * width).toFixed(1)},${(height - (speed / max) * height).toFixed(1)}`
        );

        return html`
            <div class="plot">
                <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                    ${[0.25, 0.5, 0.75].map(
                        (fraction) =>
                            svg`<line class="grid" x1="0" x2=${width} y1=${height * fraction} y2=${height * fraction} vector-effect="non-scaling-stroke"></line>`
                    )}
                    ${
                        points.length > 1
                            ? svg`<polygon class="area" points="${points[0].split(',')[0]},${height} ${points.join(' ')} ${points.at(-1)?.split(',')[0]},${height}"></polygon>
                                <polyline class="line" points=${points.join(' ')} vector-effect="non-scaling-stroke"></polyline>`
                            : null
                    }
                </svg>
                <span class="max">${formatSpeed(max)}</span>
            </div>
            <div class="axis">
                <span>${points.length > 1 ? `${formatDuration(last - first)} ago` : ''}</span>
                <span>now</span>
            </div>
        `;
    }
}

/**
 * The top of the graph: 1, 2 or 5 times a power of 10, in MB/s, so the scale reads well
 */
function niceMax(speed: number): number {
    const megabytes = Math.max(1, speed / megabyte);
    const power = 10 ** Math.floor(Math.log10(megabytes));
    const step = [1, 2, 5, 10].find((multiple) => multiple * power >= megabytes) ?? 10;
    return step * power * megabyte;
}

customElements.define('speed-graph', SpeedGraph);
