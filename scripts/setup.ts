/**
 * Lumiere — Initialisation de _lumiere/ dans le projet
 *
 * Crée la structure de données locale si absente.
 * Appelé automatiquement par le hook SessionStart (session-start.ts).
 * Peut aussi être lancé manuellement : bun scripts/setup.ts
 *
 * En plugin, les hooks et skills sont auto-découverts —
 * ce script ne touche plus à .claude/settings.json ni .claude/commands/.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPaths } from './paths.js';

const paths = createPaths();

// 1. Créer les dossiers
mkdirSync(paths.intuitions, { recursive: true });
mkdirSync(paths.archives, { recursive: true });

// 2. Config — créer avec defaults si absent, merge si existant
const defaults = {
	enabled: true,
	minObservations: 20,
	model: 'sonnet',
	intervalMinutes: 5,
};

if (existsSync(paths.config)) {
	const existing = JSON.parse(readFileSync(paths.config, 'utf-8'));
	const merged = { ...defaults, ...existing };
	writeFileSync(paths.config, JSON.stringify(merged, null, '\t') + '\n');
	console.log('✓ Config mise à jour');
} else {
	writeFileSync(paths.config, JSON.stringify(defaults, null, '\t') + '\n');
	console.log('✓ Config créée');
}

// 3. Ajouter _lumiere/ au .gitignore si absent
const gitignorePath = join(paths.projectDir, '.gitignore');
if (existsSync(gitignorePath)) {
	const content = readFileSync(gitignorePath, 'utf-8');
	if (!content.includes('_lumiere')) {
		writeFileSync(gitignorePath, content.trimEnd() + '\n\n# Lumiere data\n_lumiere/\n');
		console.log('✓ _lumiere/ ajouté au .gitignore');
	}
}

console.log(`✓ Lumiere initialisé dans ${paths.lumiereDir}`);
