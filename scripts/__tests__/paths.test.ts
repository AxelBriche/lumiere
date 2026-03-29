/**
 * Tests for scripts/paths.ts — centralized path resolution
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Save original env to restore after each test
let originalProjectDir: string | undefined;

beforeEach(() => {
	originalProjectDir = process.env.CLAUDE_PROJECT_DIR;
});

afterEach(() => {
	if (originalProjectDir !== undefined) {
		process.env.CLAUDE_PROJECT_DIR = originalProjectDir;
	} else {
		delete process.env.CLAUDE_PROJECT_DIR;
	}
});

describe('createPaths', () => {
	test('returns correct paths when CLAUDE_PROJECT_DIR is set', () => {
		expect.assertions(12);

		process.env.CLAUDE_PROJECT_DIR = '/tmp/test-project';

		// Re-import to get a fresh module (createPaths reads env at call time)
		const { createPaths } = require('../paths.js');
		const paths = createPaths();

		expect(paths.projectDir).toBe('/tmp/test-project');
		expect(paths.lumiereDir).toBe('/tmp/test-project/_lumiere');
		expect(paths.observations).toBe('/tmp/test-project/_lumiere/observations.jsonl');
		expect(paths.intuitions).toBe('/tmp/test-project/_lumiere/intuitions');
		expect(paths.archives).toBe('/tmp/test-project/_lumiere/archives');
		expect(paths.config).toBe('/tmp/test-project/_lumiere/config.json');
		expect(paths.observerPid).toBe('/tmp/test-project/_lumiere/.observer.pid');
		expect(paths.observerLog).toBe('/tmp/test-project/_lumiere/observer.log');
		expect(paths.observerCounter).toBe('/tmp/test-project/_lumiere/.observer-counter');
		expect(paths.purgeMarker).toBe('/tmp/test-project/_lumiere/.last-purge');
		expect(paths.projectDirMarker).toBe('/tmp/test-project/_lumiere/.project-dir');
		expect(paths.pluginRoot).toBeString();
	});

	test('pluginRoot points to parent of scripts/', () => {
		expect.assertions(2);

		process.env.CLAUDE_PROJECT_DIR = '/tmp/test-project';

		const { createPaths } = require('../paths.js');
		const paths = createPaths();

		// pluginRoot should end with the plugin directory name, not scripts/
		expect(paths.pluginRoot).not.toContain('scripts');
		// analyzeScript should be inside pluginRoot/scripts/
		expect(paths.analyzeScript).toBe(join(paths.pluginRoot, 'scripts', 'analyze.ts'));
	});

	test('observerScript is correctly derived from pluginRoot', () => {
		expect.assertions(1);

		process.env.CLAUDE_PROJECT_DIR = '/tmp/test-project';

		const { createPaths } = require('../paths.js');
		const paths = createPaths();

		expect(paths.observerScript).toBe(join(paths.pluginRoot, 'scripts', 'observer.ts'));
	});

	test('throws with clear message when CLAUDE_PROJECT_DIR is not set and no fallback', () => {
		expect.assertions(1);

		delete process.env.CLAUDE_PROJECT_DIR;

		const { createPaths } = require('../paths.js');

		expect(() => createPaths()).toThrow('Cannot determine project directory');
	});

	test('uses hookCwd as fallback when env var is not set', () => {
		expect.assertions(1);

		delete process.env.CLAUDE_PROJECT_DIR;

		const { createPaths } = require('../paths.js');
		const paths = createPaths('/tmp/hook-cwd-project');

		expect(paths.projectDir).toBe('/tmp/hook-cwd-project');
	});

	test('CLAUDE_PROJECT_DIR takes priority over hookCwd', () => {
		expect.assertions(1);

		process.env.CLAUDE_PROJECT_DIR = '/tmp/env-project';

		const { createPaths } = require('../paths.js');
		const paths = createPaths('/tmp/hook-cwd-project');

		expect(paths.projectDir).toBe('/tmp/env-project');
	});

	test('all _lumiere/ subpaths share the same lumiereDir prefix', () => {
		expect.assertions(7);

		process.env.CLAUDE_PROJECT_DIR = '/tmp/test-project';

		const { createPaths } = require('../paths.js');
		const paths = createPaths();
		const prefix = paths.lumiereDir;

		expect(paths.observations.startsWith(prefix)).toBe(true);
		expect(paths.intuitions.startsWith(prefix)).toBe(true);
		expect(paths.archives.startsWith(prefix)).toBe(true);
		expect(paths.config.startsWith(prefix)).toBe(true);
		expect(paths.observerPid.startsWith(prefix)).toBe(true);
		expect(paths.observerLog.startsWith(prefix)).toBe(true);
		expect(paths.observerCounter.startsWith(prefix)).toBe(true);
	});
});
