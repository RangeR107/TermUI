// ─────────────────────────────────────────────────────
// @termuijs/store — Devtools Logger Middleware
//
// Provides two exports:
//
//   logger        — drop-in middleware constant; logs prev/next state
//                   to the console. Intended for devtools use only —
//                   do not enable in production terminal apps.
//
//   createLogger  — factory for a configurable logger: custom output
//                   sink, optional per-key diff, optional store label.
//
// Usage (simple):
//   import { createStore, logger } from '@termuijs/store';
//   const useStore = createStore(creator, { middleware: [logger] });
//
// Usage (configurable):
//   import { createStore } from '@termuijs/store';
//   import { createLogger } from '@termuijs/store';
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
     * Defaults to appending to `<tmpdir>/termuijs-store.log`.
     * Pass `output: (msg) => console.log(msg)` to redirect to the console.
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

// ── Simple logger constant ─────────────────────────────

/**
 * Drop-in logger middleware. Logs the previous and next state to the
 * console on every `setState` call. Intended for devtools / debugging
 * only — remove from production builds.
 *
 * ```typescript
 * const useStore = createStore(creator, { middleware: [logger] });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const logger: Middleware<any> = (prevState, update, next): void => {
    // console.log is intentional here — this is a devtools-only middleware
    // eslint-disable-next-line no-console
    console.log('Previous State:', prevState);
    const nextState = next(update);
    // eslint-disable-next-line no-console
    console.log('Next State:', nextState);
};

// ── Default output sink for createLogger ──────────────

function defaultOutput(message: string): void {
    const logFile = path.join(os.tmpdir(), 'termuijs-store.log');
    try {
        fs.appendFileSync(logFile, message + '\n', 'utf8');
    } catch {
        // Swallow write errors — never crash the terminal app
    }
}

// ── Configurable logger factory ────────────────────────

/**
 * createLogger — produce a store middleware that logs state transitions
 * to a configurable output sink.
 *
 * ```typescript
 * const useStore = createStore(creator, {
 *     middleware: [
 *         createLogger({ name: 'myStore', diff: true }),
 *     ],
 * });
 * ```
 *
 * Every `setState` call emits two or three lines:
 *   `[label] <iso-timestamp> prev   {...}`
 *   `[label] <iso-timestamp> next   {...}`
 *   `[label] <iso-timestamp> diff   { key: { from: <old>, to: <new> } }`  ← when diff: true
 */
export function createLogger<T extends object>(options?: LoggerOptions): Middleware<T> {
    const write    = options?.output ?? defaultOutput;
    const showDiff = options?.diff ?? true;
    const prefix   = options?.name ? `[${options.name}] ` : '';

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
