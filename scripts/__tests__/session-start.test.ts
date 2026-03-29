/**
 * Tests for scripts/session-start.ts — Setup + IntuitionInjector classes
 */

import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { Paths } from '../paths.js';

// Dynamic import to avoid top-level side effects from session-start.ts main()
let Setup: new (paths: Paths) => { run(): void };
let IntuitionInjector: new (paths: Paths) => { inject(): void };

// Load classes once (the module's top-level try/catch will silently fail
// because CLAUDE_PROJECT_DIR is not set at import time — that's fine,
// we only need the exported classes)
beforeEach(async () => {
	const mod = await import('../session-start.js');
	Setup = mod.Setup as typeof Setup;
	IntuitionInjector = mod.IntuitionInjector as typeof IntuitionInjector;
});

/** Creates a temp directory and returns a fake Paths object pointing to it */
function makeTempPaths(): { paths: Paths; tempDir: string } {
	const tempDir = join(tmpdir(), `lumiere-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tempDir, { recursive: true });

	const lumiereDir = join(tempDir, '_lumiere');

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

// --- Setup class tests ---

describe('Setup', () => {
	let tempDir: string;
	let paths: Paths;

	beforeEach(() => {
		const t = makeTempPaths();
		tempDir = t.tempDir;
		paths = t.paths;
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	test('creates intuitions/ and archives/ directories', () => {
		expect.assertions(2);

		new Setup(paths).run();

		expect(existsSync(paths.intuitions)).toBe(true);
		expect(existsSync(paths.archives)).toBe(true);
	});

	test('creates config.json with default values when absent', () => {
		expect.assertions(5);

		new Setup(paths).run();

		expect(existsSync(paths.config)).toBe(true);

		const config = JSON.parse(readFileSync(paths.config, 'utf-8'));
		expect(config.enabled).toBe(true);
		expect(config.minObservations).toBe(20);
		expect(config.model).toBe('sonnet');
		expect(config.intervalMinutes).toBe(5);
	});

	test('merges existing config without overwriting user values', () => {
		expect.assertions(5);

		// Create _lumiere/ dir and a pre-existing config with custom values
		mkdirSync(paths.lumiereDir, { recursive: true });
		writeFileSync(
			paths.config,
			JSON.stringify({ enabled: false, model: 'opus', customKey: 'keep-me' }, null, '\t') + '\n'
		);

		new Setup(paths).run();

		const config = JSON.parse(readFileSync(paths.config, 'utf-8'));
		// User overrides are preserved
		expect(config.enabled).toBe(false);
		expect(config.model).toBe('opus');
		expect(config.customKey).toBe('keep-me');
		// Defaults are filled in for missing keys
		expect(config.minObservations).toBe(20);
		expect(config.intervalMinutes).toBe(5);
	});

	test('adds _lumiere/ to .gitignore if not already there', () => {
		expect.assertions(1);

		// Create a .gitignore without _lumiere
		writeFileSync(join(tempDir, '.gitignore'), 'node_modules/\n.env\n');

		new Setup(paths).run();

		const content = readFileSync(join(tempDir, '.gitignore'), 'utf-8');
		expect(content).toContain('_lumiere/');
	});

	test('does not duplicate _lumiere/ in .gitignore if already present', () => {
		expect.assertions(1);

		writeFileSync(join(tempDir, '.gitignore'), 'node_modules/\n_lumiere/\n');

		new Setup(paths).run();

		const content = readFileSync(join(tempDir, '.gitignore'), 'utf-8');
		// Count occurrences of _lumiere — should be exactly 1
		const matches = content.match(/_lumiere/g);
		expect(matches?.length).toBe(1);
	});

	test('does nothing to .gitignore if the file does not exist', () => {
		expect.assertions(1);

		new Setup(paths).run();

		// .gitignore should NOT be created if it didn't exist
		expect(existsSync(join(tempDir, '.gitignore'))).toBe(false);
	});

	test('is idempotent — running twice produces same result', () => {
		expect.assertions(4);

		writeFileSync(join(tempDir, '.gitignore'), 'node_modules/\n');

		new Setup(paths).run();
		const configAfterFirst = readFileSync(paths.config, 'utf-8');
		const gitignoreAfterFirst = readFileSync(join(tempDir, '.gitignore'), 'utf-8');

		new Setup(paths).run();
		const configAfterSecond = readFileSync(paths.config, 'utf-8');
		const gitignoreAfterSecond = readFileSync(join(tempDir, '.gitignore'), 'utf-8');

		expect(configAfterFirst).toBe(configAfterSecond);
		expect(gitignoreAfterFirst).toBe(gitignoreAfterSecond);
		expect(existsSync(paths.intuitions)).toBe(true);
		expect(existsSync(paths.archives)).toBe(true);
	});
});

// --- IntuitionInjector class tests ---

describe('IntuitionInjector', () => {
	let tempDir: string;
	let paths: Paths;
	let consoleSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		const t = makeTempPaths();
		tempDir = t.tempDir;
		paths = t.paths;
		consoleSpy = spyOn(console, 'log');
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		rmSync(tempDir, { recursive: true, force: true });
	});

	test('produces no output when intuitions directory does not exist', () => {
		expect.assertions(1);

		new IntuitionInjector(paths).inject();

		expect(consoleSpy).not.toHaveBeenCalled();
	});

	test('produces no output when intuitions directory is empty', () => {
		expect.assertions(1);

		mkdirSync(paths.intuitions, { recursive: true });

		new IntuitionInjector(paths).inject();

		expect(consoleSpy).not.toHaveBeenCalled();
	});

	test('produces no output when .md files have no valid frontmatter', () => {
		expect.assertions(1);

		mkdirSync(paths.intuitions, { recursive: true });
		writeFileSync(join(paths.intuitions, 'bad.md'), '# No frontmatter here\nJust content.\n');

		new IntuitionInjector(paths).inject();

		expect(consoleSpy).not.toHaveBeenCalled();
	});

	test('outputs formatted block for valid intuitions', () => {
		expect.assertions(3);

		mkdirSync(paths.intuitions, { recursive: true });
		writeFileSync(
			join(paths.intuitions, 'test-intuition.md'),
			`---
id: use-const-assertions
trigger: repeated let→const corrections
confidence: 0.8
domain: code-style
---

When the user corrects let to const, prefer const by default.
`
		);

		new IntuitionInjector(paths).inject();

		// Should have been called: header, one line, empty line
		expect(consoleSpy).toHaveBeenCalledTimes(3);
		expect(consoleSpy.mock.calls[0][0]).toContain('1 intuitions apprises');
		expect(consoleSpy.mock.calls[1][0]).toContain('use-const-assertions');
	});

	test('parses frontmatter correctly (id, trigger, confidence, domain)', () => {
		expect.assertions(4);

		mkdirSync(paths.intuitions, { recursive: true });
		writeFileSync(
			join(paths.intuitions, 'parsed.md'),
			`---
id: my-pattern
trigger: some trigger phrase
confidence: 0.95
domain: testing
---

Body content.
`
		);

		new IntuitionInjector(paths).inject();

		const outputLine = consoleSpy.mock.calls[1][0] as string;
		expect(outputLine).toContain('[0.9]'); // 0.95 formatted to 1 decimal
		expect(outputLine).toContain('some trigger phrase');
		expect(outputLine).toContain('my-pattern');
		expect(outputLine).toContain('testing');
	});

	test('sorts intuitions by confidence descending', () => {
		expect.assertions(2);

		mkdirSync(paths.intuitions, { recursive: true });

		writeFileSync(
			join(paths.intuitions, 'low.md'),
			`---
id: low-confidence
trigger: low trigger
confidence: 0.3
domain: misc
---
Low confidence pattern.
`
		);

		writeFileSync(
			join(paths.intuitions, 'high.md'),
			`---
id: high-confidence
trigger: high trigger
confidence: 0.9
domain: misc
---
High confidence pattern.
`
		);

		writeFileSync(
			join(paths.intuitions, 'mid.md'),
			`---
id: mid-confidence
trigger: mid trigger
confidence: 0.6
domain: misc
---
Mid confidence pattern.
`
		);

		new IntuitionInjector(paths).inject();

		// calls[0] = header, calls[1..3] = the three intuitions, calls[4] = empty line
		const firstLine = consoleSpy.mock.calls[1][0] as string;
		const secondLine = consoleSpy.mock.calls[2][0] as string;
		const thirdLine = consoleSpy.mock.calls[3][0] as string;

		expect(firstLine).toContain('high-confidence');
		expect(thirdLine).toContain('low-confidence');
	});

	test('ignores non-.md files in intuitions directory', () => {
		expect.assertions(1);

		mkdirSync(paths.intuitions, { recursive: true });
		writeFileSync(join(paths.intuitions, 'notes.txt'), 'not a markdown file');
		writeFileSync(join(paths.intuitions, 'data.json'), '{}');

		new IntuitionInjector(paths).inject();

		expect(consoleSpy).not.toHaveBeenCalled();
	});

	test('skips .md files where id or trigger is missing', () => {
		expect.assertions(1);

		mkdirSync(paths.intuitions, { recursive: true });

		// Missing trigger
		writeFileSync(
			join(paths.intuitions, 'no-trigger.md'),
			`---
id: has-id-only
confidence: 0.7
domain: misc
---
No trigger field.
`
		);

		// Missing id
		writeFileSync(
			join(paths.intuitions, 'no-id.md'),
			`---
trigger: has trigger only
confidence: 0.5
domain: misc
---
No id field.
`
		);

		new IntuitionInjector(paths).inject();

		expect(consoleSpy).not.toHaveBeenCalled();
	});
});
