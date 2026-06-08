// ─────────────────────────────────────────────────────
// @termuijs/store — Devtools Logger Middleware
//
// A pluggable action logger that records state transitions
// and key-level diffs to a configurable output sink.
//
// Usage:
//   import { createStore } from '@termuijs/store';
//   import { createLogger } from '@termuijs/store';
//
//   const useStore = createStore(creator, {
//       middleware: [createLogger({ name: 'counter', diff: true })],
//   });
// ─────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Middleware } from './store.js';

// ── Types ──────────────────────────────────────────────

export interface LoggerOptions {
    /**
     * Custom output sink — receives one formatted line at a time.
     * Defaults to appending to `<tmpdir>/termuijs-store.log` so
     * the terminal display is never polluted (no console.log in UI code).
     */
    output?: (message: string) => void;

    /**
     * Emit a per-key diff entry showing `from` → `to` for every key
     * whose value actually changed. Default: `true`.
     */
    diff?: boolean;

    /**
     * Label prepended to every log line, e.g. the store's name.
     * When omitted no label is prepended.
     */
    name?: string;
}

// ── Default output sink ────────────────────────────────

function defaultOutput(message: string): void {
    const logFile = path.join(os.tmpdir(), 'termuijs-store.log');
    try {
        fs.appendFileSync(logFile, message + '\n', 'utf8');
    } catch {
        // Swallow write errors — never crash the terminal app
    }
}

// ── Factory ────────────────────────────────────────────

/**
 * createLogger — produce a store middleware that logs state transitions.
 *
 * ```typescript
 * const useStore = createStore(creator, {
 *     middleware: [
 *         createLogger({ name: 'myStore', diff: true }),
 *     ],
 * });
 * ```
 *
 * Every `setState` call emits three lines (when diff is enabled):
 *   `[label] <iso-timestamp> action  prev: {...}`
 *   `[label] <iso-timestamp> action  next: {...}`
 *   `[label] <iso-timestamp> diff    { key: { from: <old>, to: <new> } }`
 *
 * With `diff: false` only the prev/next lines are emitted.
 */
export function createLogger<T extends object>(options?: LoggerOptions): Middleware<T> {
    const write   = options?.output ?? defaultOutput;
    const showDiff = options?.diff ?? true;
    const prefix  = options?.name ? `[${options.name}] ` : '';

    return (prevState, update, next): void => {
        const nextState = next(update);
        const ts = new Date().toISOString();

        write(`${prefix}${ts} prev   ${JSON.stringify(prevState)}`);
        write(`${prefix}${ts} next   ${JSON.stringify(nextState)}`);

        if (showDiff) {
            const changedKeys = (Object.keys(update) as (keyof T)[]).filter(
                (k) => !Object.is(prevState[k], (nextState as T)[k]),
            );

            if (changedKeys.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const diffObj: Record<string, { from: any; to: any }> = {};
                for (const k of changedKeys) {
                    diffObj[k as string] = {
                        from: prevState[k],
                        to:   (nextState as T)[k],
                    };
                }
                write(`${prefix}${ts} diff   ${JSON.stringify(diffObj)}`);
            }
        }
    };
}
