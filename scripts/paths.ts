/**
 * Lumiere — Résolution centralisée des chemins
 *
 * Tous les scripts importent ce module au lieu de calculer
 * les chemins eux-mêmes avec des ../../../.. fragiles.
 *
 * Deux types de chemins :
 * - Plugin : où vit le code (${CLAUDE_PLUGIN_ROOT} ou import.meta.dirname)
 * - Projet : où vivent les données (_lumiere/ dans $CLAUDE_PROJECT_DIR)
 */

import { join, dirname } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

/** Racine du plugin = parent du dossier scripts/ */
const PLUGIN_ROOT = join(dirname(new URL(import.meta.url).pathname), '..');

/**
 * Résout le répertoire du projet utilisateur.
 *
 * Priorité :
 * 1. $CLAUDE_PROJECT_DIR (env var fournie par Claude Code dans les hooks)
 * 2. Fichier .project-dir persisté dans _lumiere/ (fallback pour processus détachés)
 * 3. cwd du hook (passé en paramètre depuis le JSON stdin)
 */
function resolveProjectDir(hookCwd?: string): string {
	// 1. Env var (disponible dans hooks et processus enfants)
	if (process.env.CLAUDE_PROJECT_DIR) {
		return process.env.CLAUDE_PROJECT_DIR;
	}

	// 2. Fichier persisté (pour l'observer détaché qui hérite pas toujours l'env)
	const markerPath = join(PLUGIN_ROOT, '..', '..', '_lumiere', '.project-dir');
	if (existsSync(markerPath)) {
		const dir = readFileSync(markerPath, 'utf-8').trim();
		if (dir && existsSync(dir)) return dir;
	}

	// 3. cwd du hook (champ `cwd` du JSON stdin)
	if (hookCwd) return hookCwd;

	throw new Error(
		'Cannot determine project directory. ' +
		'Ensure CLAUDE_PROJECT_DIR is set or run from a Claude Code hook.'
	);
}

/**
 * Crée un objet Paths pour un projet donné.
 * Appelé une fois au démarrage de chaque script.
 */
export function createPaths(hookCwd?: string) {
	const projectDir = resolveProjectDir(hookCwd);
	const lumiereDir = join(projectDir, '_lumiere');

	return {
		/** Racine du plugin (code) */
		pluginRoot: PLUGIN_ROOT,

		/** Racine du projet utilisateur */
		projectDir,

		/** Dossier _lumiere/ dans le projet */
		lumiereDir,

		/** Journal brut des observations */
		observations: join(lumiereDir, 'observations.jsonl'),

		/** Dossier des intuitions (.md) */
		intuitions: join(lumiereDir, 'intuitions'),

		/** Dossier des archives */
		archives: join(lumiereDir, 'archives'),

		/** Configuration Lumiere */
		config: join(lumiereDir, 'config.json'),

		/** PID de l'observer background */
		observerPid: join(lumiereDir, '.observer.pid'),

		/** Log de l'observer */
		observerLog: join(lumiereDir, 'observer.log'),

		/** Compteur d'observations (pour throttler les signaux) */
		observerCounter: join(lumiereDir, '.observer-counter'),

		/** Marqueur de dernière purge des archives */
		purgeMarker: join(lumiereDir, '.last-purge'),

		/** Chemin du projet persisté (fallback pour processus détachés) */
		projectDirMarker: join(lumiereDir, '.project-dir'),

		/** Script d'analyse */
		analyzeScript: join(PLUGIN_ROOT, 'scripts', 'analyze.ts'),

		/** Script de l'observer background */
		observerScript: join(PLUGIN_ROOT, 'scripts', 'observer.ts'),
	};
}

/** Type retourné par createPaths */
export type Paths = ReturnType<typeof createPaths>;
