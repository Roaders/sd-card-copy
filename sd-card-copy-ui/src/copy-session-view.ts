import { css, html, LitElement, nothing } from 'lit';
import type { ICopyFile, ICopySession } from '../../sd-card-copy-server/src/status.contracts';
import { formatBytes, formatDuration, formatSpeed, formatTime } from './format';

const stateLabels: Record<ICopySession['state'], string> = {
    scanning: 'Scanning',
    copying: 'Copying',
    deleting: 'Deleting',
    complete: 'Complete',
    failed: 'Failed',
    refused: 'Not copied',
};

/**
 * One copy session: a drive and its files. The files of a finished session are collapsed.
 */
export class CopySessionView extends LitElement {
    static properties = { session: { attribute: false } };

    declare session: ICopySession;

    static styles = css`
        :host {
            display: block;
            background: white;
            border: 1px solid #d0d7de;
            border-radius: 8px;
            padding: 12px 16px;
        }
        .header {
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            gap: 4px 12px;
        }
        .source {
            font-weight: 600;
        }
        .state {
            font-size: 12px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 10px;
            background: #ddf4ff;
            color: #0969da;
        }
        .state.complete {
            background: #dafbe1;
            color: #1a7f37;
        }
        .state.failed {
            background: #ffebe9;
            color: #cf222e;
        }
        .state.refused {
            background: #eaeef2;
            color: #57606a;
        }
        .meta {
            color: #57606a;
            font-size: 13px;
            margin-left: auto;
        }
        .target {
            color: #57606a;
            font-size: 13px;
            margin-top: 4px;
            word-break: break-all;
        }
        .message {
            margin-top: 6px;
            font-size: 13px;
            color: #cf222e;
            word-break: break-word;
        }
        .refused .message {
            color: #57606a;
        }
        details {
            margin-top: 8px;
        }
        summary {
            cursor: pointer;
            font-size: 13px;
            color: #0969da;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 13px;
        }
        td {
            padding: 4px 8px 4px 0;
            border-top: 1px solid #eaeef2;
            white-space: nowrap;
        }
        td.name {
            white-space: normal;
            word-break: break-all;
            width: 100%;
        }
        td.size,
        td.speed {
            text-align: right;
            color: #57606a;
        }
        td.speed {
            min-width: 80px;
            font-weight: 600;
            color: #0969da;
        }
        .bar {
            width: 140px;
            height: 8px;
            border-radius: 4px;
            background: #eaeef2;
            overflow: hidden;
        }
        .bar > div {
            height: 100%;
            background: #0969da;
        }
        .complete .bar > div {
            background: #1a7f37;
        }
        .failed .bar > div {
            background: #cf222e;
        }
        .pending {
            color: #8c959f;
        }
        @media (max-width: 600px) {
            :host {
                padding: 10px;
            }
            .meta {
                margin-left: 0;
            }
            .bar {
                width: 48px;
            }
            td.speed {
                min-width: 0;
            }
        }
    `;

    protected render() {
        const session = this.session;
        const files = session.files;
        const totalBytes = files.reduce((total, file) => total + file.size, 0);
        const copiedBytes = files.reduce((total, file) => total + file.copiedBytes, 0);
        const completedFiles = files.filter((file) => file.state === 'complete').length;
        const duration =
            session.finished != null && files.length > 0
                ? ` · took ${formatDuration(session.finished - session.started)}`
                : '';
        const fileCount = `${files.length} ${files.length === 1 ? 'file' : 'files'}`;
        const progress =
            files.length > 0
                ? `${completedFiles} / ${fileCount} · ${formatBytes(copiedBytes)} / ${formatBytes(totalBytes)} · `
                : '';
        const table = html`<table>
            ${files.map((file) => this.renderFile(file))}
        </table>`;

        return html`
            <div class=${session.state}>
                <div class="header">
                    <span class="source">${session.sourcePath}</span>
                    <span class="state ${session.state}">${stateLabels[session.state]}</span>
                    <span class="meta">${progress}${formatTime(session.started)}${duration}</span>
                </div>
                ${session.targetPath ? html`<div class="target">→ ${session.targetPath}</div>` : nothing}
                ${session.message ? html`<div class="message">${session.message}</div>` : nothing}
                ${
                    files.length === 0
                        ? nothing
                        : session.finished == null
                          ? table
                          : html`<details>
                                <summary>${fileCount}</summary>
                                ${table}
                            </details>`
                }
            </div>
        `;
    }

    private renderFile(file: ICopyFile) {
        const percentage = file.size > 0 ? (file.copiedBytes / file.size) * 100 : file.state === 'complete' ? 100 : 0;

        return html`<tr class=${file.state}>
            <td class="name">${file.path}</td>
            <td class="size">${formatBytes(file.size)}</td>
            <td>
                <div class="bar" title="${percentage.toFixed(0)}%"><div style="width: ${percentage}%"></div></div>
            </td>
            <td class="size">${file.state === 'copying' ? `${percentage.toFixed(0)}%` : nothing}</td>
            <td class="speed">
                ${
                    file.speed != null
                        ? formatSpeed(file.speed)
                        : file.state === 'pending'
                          ? html`<span class="pending">waiting</span>`
                          : file.state === 'failed'
                            ? 'failed'
                            : nothing
                }
            </td>
        </tr>`;
    }
}

customElements.define('copy-session-view', CopySessionView);
