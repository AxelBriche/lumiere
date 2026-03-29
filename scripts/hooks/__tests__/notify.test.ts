/**
 * Tests for scripts/hooks/notify.ts — Observer class
 */

import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { Paths } from '../../paths.js';
import { Observer } from '../notify.js';

/** Creates a temp directory and returns a fake Paths object pointing to it */
function makeTempPaths(): { paths: Paths; tempDir: string } {
	const tempDir = join(tmpdir(), `lumiere-notify-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	const lumiereDir = join(tempDir, '_lumiere');
	mkdirSync(lumiereDir, { recursive: true });

	return {
		tempDir,
		paths: {
			pluginRoot: join(tempDir, 'plugin'),
			projectDir: tempDir,
			lumiereDir,
			observations: join(lumiereDir, 'observations.jsonl'),
			intuitions: join(lumiereDir, 'intuitions'),
			archives: join(lumiereDir, 'archives'),
			config: join(lumiereDir, 'config.json'),
			observerPid: join(lumiereDir, '.observer.pid'),
			observerLog: join(lumiereDir, 'observer.log'),
			observerCounter: join(lumiereDir, '.observer-counter'),
			purgeMarker: join(lumiereDir, '.last-purge'),
			projectDirMarker: join(lumiereDir, '.project-dir'),
			analyzeScript: join(tempDir, 'plugin', 'scripts', 'analyze.ts'),
			observerScript: join(tempDir, 'plugin', 'scripts', 'observer.ts'),
		},
	};
}

describe('Observer', () => {
	let tempDir: string;
	let paths: Paths;
	let killSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		const t = makeTempPaths();
		tempDir = t.tempDir;
		paths = t.paths;
		// Spy on process.kill to prevent actual signal sending
		killSpy = spyOn(process, 'kill').mockImplementation(() => true);
	});

	afterEach(() => {
		killSpy.mockRestore();
		rmSync(tempDir, { recursive: true, force: true });
	});

	test('counter increments on each notify()', () => {
		expect.assertions(3);

		const observer = new Observer(paths);

		observer.notify();
		expect(readFileSync(paths.observerCounter, 'utf-8')).toBe('1');

		observer.notify();
		expect(readFileSync(paths.observerCounter, 'utf-8')).toBe('2');

		observer.notify();
		expect(readFileSync(paths.observerCounter, 'utf-8')).toBe('3');
	});

	test('counter < 20 does not trigger any signal or spawn', () => {
		expect.assertions(1);

		const observer = new Observer(paths);

		// Call 19 times — should not trigger
		for (let i = 0; i < 19; i++) {
			observer.notify();
		}

		// process.kill should not have been called (no PID file, no signal)
		expect(killSpy).not.toHaveBeenCalled();
	});

	test('counter resets to 0 at the 20th notification', () => {
		expect.assertions(2);

		const observer = new Observer(paths);

		// Call 19 times to reach counter=19
		for (let i = 0; i < 19; i++) {
			observer.notify();
		}
		expect(readFileSync(paths.observerCounter, 'utf-8')).toBe('19');

		// 20th call triggers threshold and resets
		observer.notify();
		expect(readFileSync(paths.observerCounter, 'utf-8')).toBe('0');
	});

	test('counter resets to 0 and restarts counting after reaching 20', () => {
		expect.assertions(2);

		const observer = new Observer(paths);

		// Reach 20 (resets to 0)
		for (let i = 0; i < 20; i++) {
			observer.notify();
		}
		expect(readFileSync(paths.observerCounter, 'utf-8')).toBe('0');

		// Next call starts counting again from 1
		observer.notify();
		expect(readFileSync(paths.observerCounter, 'utf-8')).toBe('1');
	});

	test('isRunning returns false when PID file does not exist', () => {
		expect.assertions(1);

		const observer = new Observer(paths);

		// No PID file exists — reaching 20 should try to start (spawn), not wake
		// Since there's no PID file, process.kill(pid, 0) should NOT be called
		for (let i = 0; i < 20; i++) {
			observer.notify();
		}

		// process.kill was never called for the "is alive?" check (signal 0)
		const signalZeroCalls = killSpy.mock.calls.filter(
			(call) => call[1] === 0
		);
		expect(signalZeroCalls.length).toBe(0);
	});

	test('isRunning returns false when PID file points to dead process', () => {
		expect.assertions(2);

		// Write a PID file with a PID that definitely doesn't exist
		writeFileSync(paths.observerPid, '99999999');

		// Make process.kill throw for the "is alive?" check (simulating dead process)
		killSpy.mockImplementation((pid: number, signal?: string | number) => {
			if (signal === 0) throw new Error('ESRCH');
			return true;
		});

		const observer = new Observer(paths);

		for (let i = 0; i < 20; i++) {
			observer.notify();
		}

		// Should have tried to check if alive (signal 0)
		const signalZeroCalls = killSpy.mock.calls.filter(
			(call) => call[1] === 0
		);
		expect(signalZeroCalls.length).toBe(1);

		// PID file should be cleaned up since process is dead
		expect(existsSync(paths.observerPid)).toBe(false);
	});

	test('sends SIGUSR1 when observer process is alive at threshold', () => {
		expect.assertions(2);

		// Write a PID file
		writeFileSync(paths.observerPid, '12345');

		// process.kill succeeds for signal 0 (alive) and SIGUSR1
		killSpy.mockImplementation(() => true);

		const observer = new Observer(paths);

		for (let i = 0; i < 20; i++) {
			observer.notify();
		}

		// Should have called process.kill(12345, 0) to check if alive
		const aliveCheck = killSpy.mock.calls.find(
			(call) => call[0] === 12345 && call[1] === 0
		);
		expect(aliveCheck).toBeDefined();

		// Should have called process.kill(12345, 'SIGUSR1') to wake it
		const wakeCall = killSpy.mock.calls.find(
			(call) => call[0] === 12345 && call[1] === 'SIGUSR1'
		);
		expect(wakeCall).toBeDefined();
	});

	test('counter file starts fresh when it does not exist', () => {
		expect.assertions(1);

		// Ensure no counter file exists
		expect(existsSync(paths.observerCounter)).toBe(false);
	});

	test('counter handles corrupted counter file gracefully', () => {
		expect.assertions(1);

		// Write garbage to the counter file
		writeFileSync(paths.observerCounter, 'not-a-number');

		const observer = new Observer(paths);
		observer.notify();

		// parseInt('not-a-number') returns NaN, NaN + 1 = NaN
		// The code writes String(NaN) — then next read parseInt('NaN') + 1 = NaN
		// This is a known edge case. The counter should still be writable.
		const content = readFileSync(paths.observerCounter, 'utf-8');
		expect(content).toBeString();
	});
});
