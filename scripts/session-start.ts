/**
 * Lumiere — Hook SessionStart
 *
 * Exécuté au démarrage de chaque session Claude Code.
 * 1. Initialise _lumiere/ si absent (classe Setup)
 * 2. Injecte toutes les intuitions dans le contexte de Claude (classe IntuitionInjector)
 *
 * Tout ce qui est écrit sur stdout est injecté dans le contexte initial de Claude.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createPaths, type Paths } from './paths.js';

// --- Setup : init lazy de _lumiere/ ---

class Setup {
	constructor(private readonly paths: Paths) {}

	/** Crée _lumiere/ et ses sous-dossiers si absents */
	ensureDirectories(): void {
		mkdirSync(join(this.paths.intuitions), { recursive: true });
		mkdirSync(join(this.paths.archives), { recursive: true });
	}

	/** Crée config.json avec les defaults si absent, merge si existant */
	ensureConfig(): void {
		const defaults = {
			enabled: true,
			minObservations: 20,
			model: 'sonnet',
			intervalMinutes: 5
		};

		if (existsSync(this.paths.config)) {
			const existing = JSON.parse(readFileSync(this.paths.config, 'utf-8'));
			const merged = { ...defaults, ...existing };
			writeFileSync(this.paths.config, JSON.stringify(merged, null, '\t') + '\n');
		} else {
			writeFileSync(this.paths.config, JSON.stringify(defaults, null, '\t') + '\n');
		}
	}

	/** Ajoute _lumiere/ au .gitignore du projet si absent */
	ensureGitignore(): void {
		const gitignorePath = join(this.paths.projectDir, '.gitignore');

		if (!existsSync(gitignorePath)) return;

		const content = readFileSync(gitignorePath, 'utf-8');
		if (content.includes('_lumiere')) return;

		writeFileSync(gitignorePath, content.trimEnd() + '\n\n# Lumiere data\n_lumiere/\n');
	}

	run(): void {
		this.ensureDirectories();
		this.ensureConfig();
		this.ensureGitignore();
	}
}

// --- IntuitionInjector : charge et formate les intuitions ---

interface IntuitionMeta {
	id: string;
	trigger: string;
	confidence: number;
	domain: string;
}

class IntuitionInjector {
	constructor(private readonly paths: Paths) {}

	/** Parse le frontmatter YAML simplifié d'un fichier .md */
	private parseFrontmatter(content: string): IntuitionMeta | null {
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (!match) return null;

		const yaml = match[1];
		const get = (key: string): string => {
			const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
			return m ? m[1].replace(/^["']|["']$/g, '').trim() : '';
		};

		const id = get('id');
		const trigger = get('trigger');
		const confidence = parseFloat(get('confidence')) || 0;
		const domain = get('domain');

		if (!id || !trigger) return null;
		return { id, trigger, confidence, domain };
	}

	/** Lit toutes les intuitions et les formate pour injection */
	inject(): void {
		if (!existsSync(this.paths.intuitions)) return;

		const files = readdirSync(this.paths.intuitions).filter((f) => f.endsWith('.md'));
		if (files.length === 0) return;

		const intuitions: IntuitionMeta[] = [];

		for (const file of files) {
			const content = readFileSync(join(this.paths.intuitions, file), 'utf-8');
			const meta = this.parseFrontmatter(content);
			if (meta) intuitions.push(meta);
		}

		if (intuitions.length === 0) return;

		// Trier par confiance décroissante
		intuitions.sort((a, b) => b.confidence - a.confidence);

		// Formater en bloc compact pour le contexte
		const lines = intuitions.map(
			(i) => `[${i.confidence.toFixed(1)}] ${i.trigger} → ${i.id} (${i.domain})`
		);

		// Écrire sur stdout → injecté dans le contexte initial de Claude
		console.log(`\n=== Lumiere — ${intuitions.length} intuitions apprises ===`);
		for (const line of lines) {
			console.log(line);
		}
		console.log('');
	}
}

// --- Exports pour les tests ---

export { Setup, IntuitionInjector };

// --- Main (uniquement quand exécuté directement, pas quand importé) ---

const isDirectExecution =
	import.meta.url === Bun.main || process.argv[1]?.endsWith('session-start.ts');
if (isDirectExecution) {
	try {
		const paths = createPaths();
		new Setup(paths).run();
		new IntuitionInjector(paths).inject();
	} catch {
		// Silencieux — un hook SessionStart ne doit jamais bloquer Claude Code
		process.exit(0);
	}
}
