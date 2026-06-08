// ─────────────────────────────────────────────────────
// Tests — devtools logger middleware
// ─────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStore } from './store.js';
import { createLogger } from './logger.js';

afterEach(() => {
    vi.restoreAllMocks();
});

// ── Helpers ────────────────────────────────────────────

function makeCounter() {
    return createStore(
        (set) => ({
            count: 0,
            name:  'counter',
            inc:   () => set((s) => ({ count: s.count + 1 })),
            reset: () => set({ count: 0 }),
        }),
    );
}

// ── Tests ──────────────────────────────────────────────

describe('createLogger', () => {
    it('calls output with prev and next state lines on setState', () => {
        const output = vi.fn();
        const useStore = createStore(
            (set) => ({ count: 0, inc: () => set((s) => ({ count: s.count + 1 })) }),
            { middleware: [createLogger({ output })] },
        );

        useStore.getState().inc();

        // At least a "prev" and "next" line
        expect(output).toHaveBeenCalledTimes(3); // prev + next + diff
        const lines: string[] = output.mock.calls.map((c) => c[0]);
        expect(lines.some((l) => l.includes('prev'))).toBe(true);
        expect(lines.some((l) => l.includes('next'))).toBe(true);
    });

    it('prev line contains the old state and next line contains the new state', () => {
        const output = vi.fn();
        const useStore = createStore(
            (set) => ({ count: 0, inc: () => set((s) => ({ count: s.count + 1 })) }),
            { middleware: [createLogger({ output })] },
        );

        useStore.getState().inc();

        const lines: string[] = output.mock.calls.map((c) => c[0]);
        const prevLine = lines.find((l) => l.includes('prev'))!;
        const nextLine = lines.find((l) => l.includes('next'))!;

        expect(prevLine).toContain('"count":0');
        expect(nextLine).toContain('"count":1');
    });

    it('emits a diff line with from/to for changed keys', () => {
        const output = vi.fn();
        const useStore = createStore(
            (set) => ({ count: 0, inc: () => set((s) => ({ count: s.count + 1 })) }),
            { middleware: [createLogger({ output, diff: true })] },
        );

        useStore.getState().inc();

        const lines: string[] = output.mock.calls.map((c) => c[0]);
        const diffLine = lines.find((l) => l.includes('diff'));
        expect(diffLine).toBeDefined();
        expect(diffLine).toContain('"from":0');
        expect(diffLine).toContain('"to":1');
    });

    it('suppresses diff line when diff: false', () => {
        const output = vi.fn();
        const useStore = createStore(
            (set) => ({ count: 0, inc: () => set((s) => ({ count: s.count + 1 })) }),
            { middleware: [createLogger({ output, diff: false })] },
        );

        useStore.getState().inc();

        const lines: string[] = output.mock.calls.map((c) => c[0]);
        expect(lines.some((l) => l.includes('diff'))).toBe(false);
        // Still emits prev + next
        expect(output).toHaveBeenCalledTimes(2);
    });

    it('prepends the name label when name option is provided', () => {
        const output = vi.fn();
        const useStore = createStore(
            (set) => ({ x: 0, set: (v: number) => set({ x: v }) }),
            { middleware: [createLogger({ output, name: 'myStore' })] },
        );

        useStore.getState().set(5);

        const lines: string[] = output.mock.calls.map((c) => c[0]);
        expect(lines.every((l) => l.startsWith('[myStore]'))).toBe(true);
    });

    it('emits no label when name is omitted', () => {
        const output = vi.fn();
        const useStore = createStore(
            (set) => ({ x: 0, set: (v: number) => set({ x: v }) }),
            { middleware: [createLogger({ output })] },
        );

        useStore.getState().set(3);

        const lines: string[] = output.mock.calls.map((c) => c[0]);
        expect(lines.every((l) => !l.startsWith('['))).toBe(true);
    });

    it('does not throw when update is an empty partial', () => {
        const output = vi.fn();
        const useStore = createStore(
            () => ({ value: 42 }),
            { middleware: [createLogger({ output })] },
        );

        // setState with no actual changes — still should not throw
        expect(() => useStore.setState({})).not.toThrow();
    });

    it('diff is not emitted when no values actually changed (Object.is bail-out)', () => {
        const output = vi.fn();
        const useStore = createStore(
            () => ({ value: 42 }),
            { middleware: [createLogger({ output, diff: true })] },
        );

        // Same value — store's Object.is bail-out means setState won't notify,
        // but the middleware still runs. Diff section should be empty.
        useStore.setState({ value: 42 });

        const lines: string[] = output.mock.calls.map((c) => c[0]);
        // No diff line because no keys changed
        expect(lines.some((l) => l.includes('diff'))).toBe(false);
    });

    it('works with multiple middleware in the chain', () => {
        const outputA = vi.fn();
        const outputB = vi.fn();

        const useStore = createStore(
            (set) => ({ n: 0, inc: () => set((s) => ({ n: s.n + 1 })) }),
            {
                middleware: [
                    createLogger({ output: outputA, name: 'A' }),
                    createLogger({ output: outputB, name: 'B' }),
                ],
            },
        );

        useStore.getState().inc();

        expect(outputA).toHaveBeenCalled();
        expect(outputB).toHaveBeenCalled();
    });

    it('each log line contains an ISO timestamp', () => {
        const output = vi.fn();
        const useStore = createStore(
            (set) => ({ x: 0, set: (v: number) => set({ x: v }) }),
            { middleware: [createLogger({ output })] },
        );

        useStore.getState().set(7);

        const lines: string[] = output.mock.calls.map((c) => c[0]);
        const isoPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        expect(lines.every((l) => isoPattern.test(l))).toBe(true);
    });
});
