/**
 * Lumiere — Observer background
 *
 * Process qui tourne en arrière-plan et analyse automatiquement
 * les observations toutes les 5 minutes.
 *
 * Cycle de vie :
 * 1. Le hook (observe.ts) le lance automatiquement s'il ne tourne pas
 * 2. Il écrit son PID dans un fichier pour que le hook puisse le retrouver
 * 3. Il dort 5 minutes (configurable dans config.json)
 * 4. Au réveil, il vérifie s'il y a assez d'observations (≥ 20)
 * 5. Si oui → lance Claude pour détecter les patterns → crée des intuitions
 * 6. Il archive les observations traitées, puis se rendort
 *
 * Le hook peut aussi le réveiller avant les 5 minutes avec un signal SIGUSR1
 * (toutes les 20 observations) quand il y a beaucoup d'activité.
 *
 * Sécurités :
 * - Jamais 2 analyses en parallèle (flag "analyzing")
 * - Minimum 60 secondes entre 2 analyses (cooldown)
 * - Nettoyage des archives > 30 jours (1x par jour)
 * - Archivage automatique si observations.jsonl > 10 MB
 *
 * Usage : lancé automatiquement par le hook, pas manuellement
 */

import {
	readFileSync,
	writeFileSync,
	appendFileSync,
	renameSync,
	mkdirSync,
	existsSync,
	unlinkSync,
	readdirSync,
	statSync
} from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { createPaths, type Paths } from './paths.js';

interface Config {
	enabled: boolean;
	minObservations: number;
	model: string;
	intervalMinutes: number;
}

class LumiereObserver {
	private readonly paths: Paths;

	/** Empêche 2 analyses en parallèle */
	private analyzing = false;

	/** Timestamp de la dernière analyse — pour le cooldown de 60s */
	private lastAnalysisTime = 0;
	private readonly cooldownMs = 60_000;

	/** Référence vers le timer de sommeil — pour pouvoir le couper avec SIGUSR1 */
	private sleepResolve: (() => void) | null = null;

	constructor() {
		this.paths = createPaths();
	}

	/** Écrire une ligne horodatée dans observer.log */
	private log(message: string): void {
		appendFileSync(this.paths.observerLog, `[${new Date().toISOString()}] ${message}\n`);
	}

	/** Lire la config, avec des valeurs par défaut si le fichier manque */
	private readConfig(): Config {
		const defaults: Config = {
			enabled: true,
			minObservations: 20,
			model: 'sonnet',
			intervalMinutes: 5
		};
		if (!existsSync(this.paths.config)) return defaults;
		return { ...defaults, ...JSON.parse(readFileSync(this.paths.config, 'utf-8')) };
	}

	/** Écrire notre PID pour que le hook puisse nous retrouver */
	private registerPid(): void {
		writeFileSync(this.paths.observerPid, String(process.pid));
	}

	/** Supprimer le PID file à l'arrêt — sinon le hook pensera qu'on tourne encore */
	private unregisterPid(): void {
		try {
			if (
				existsSync(this.paths.observerPid) &&
				readFileSync(this.paths.observerPid, 'utf-8').trim() === String(process.pid)
			) {
				unlinkSync(this.paths.observerPid);
			}
		} catch {}
	}

	/** Dormir N millisecondes — interruptible par SIGUSR1 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => {
			this.sleepResolve = resolve;
			setTimeout(() => {
				this.sleepResolve = null;
				resolve();
			}, ms);
		});
	}

	/** Appelé quand le hook envoie SIGUSR1 — coupe le sommeil en cours */
	private onWakeSignal(): void {
		this.log('Réveillé par SIGUSR1');
		if (this.sleepResolve) {
			this.sleepResolve();
			this.sleepResolve = null;
		}
	}

	/** Supprimer les archives de plus de 30 jours (1x par jour max) */
	private purgeOldArchives(): void {
		if (existsSync(this.paths.purgeMarker)) {
			const markerAge = Date.now() - statSync(this.paths.purgeMarker).mtimeMs;
			if (markerAge < 86_400_000) return; // déjà purgé aujourd'hui
		}

		if (!existsSync(this.paths.archives)) return;

		const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
		for (const file of readdirSync(this.paths.archives)) {
			try {
				if (statSync(join(this.paths.archives, file)).mtimeMs < thirtyDaysAgo) {
					unlinkSync(join(this.paths.archives, file));
				}
			} catch {}
		}

		writeFileSync(this.paths.purgeMarker, new Date().toISOString());
	}

	/** Si observations.jsonl dépasse 10 MB → le déplacer dans les archives */
	private archiveIfTooBig(): void {
		if (!existsSync(this.paths.observations)) return;
		try {
			if (statSync(this.paths.observations).size >= 10 * 1024 * 1024) {
				mkdirSync(this.paths.archives, { recursive: true });
				const name = `observations-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.jsonl`;
				renameSync(this.paths.observations, join(this.paths.archives, name));
			}
		} catch {}
	}

	/** Lancer l'analyse des observations → création d'intuitions */
	private analyze(): void {
		// Garde 1 : pas d'analyse parallèle
		if (this.analyzing) {
			this.log('Analyse déjà en cours, ignoré');
			return;
		}

		// Garde 2 : cooldown de 60 secondes entre 2 analyses
		const elapsed = Math.round((Date.now() - this.lastAnalysisTime) / 1000);
		if (Date.now() - this.lastAnalysisTime < this.cooldownMs) {
			this.log(`Cooldown actif (${elapsed}s/${this.cooldownMs / 1000}s), ignoré`);
			return;
		}

		const config = this.readConfig();
		if (!config.enabled) return;

		// Vérifier qu'il y a assez d'observations
		if (!existsSync(this.paths.observations)) return;
		const lineCount = readFileSync(this.paths.observations, 'utf-8')
			.trim()
			.split('\n')
			.filter(Boolean).length;
		if (lineCount < config.minObservations) {
			this.log(`Pas assez d'observations (${lineCount}/${config.minObservations})`);
			return;
		}

		this.analyzing = true;
		this.lastAnalysisTime = Date.now();
		this.log(`Analyse lancée (${lineCount} observations)`);

		try {
			execSync(`bun ${JSON.stringify(this.paths.analyzeScript)}`, {
				stdio: 'ignore',
				timeout: 180_000,
				env: { ...process.env, ECC_SKIP_OBSERVE: '1', ECC_HOOK_PROFILE: 'minimal' }
			});
			this.log('Analyse terminée');
		} catch {
			this.log('Analyse échouée');
		}

		this.analyzing = false;
	}

	/** Boucle principale — tourne indéfiniment */
	async run(): Promise<void> {
		this.registerPid();
		this.log(`Observer démarré (PID ${process.pid})`);

		// Se terminer proprement sur SIGTERM/SIGINT
		process.on('SIGTERM', () => {
			this.unregisterPid();
			process.exit(0);
		});
		process.on('SIGINT', () => {
			this.unregisterPid();
			process.exit(0);
		});

		// Se réveiller quand le hook envoie SIGUSR1
		process.on('SIGUSR1', () => this.onWakeSignal());

		// Nettoyage initial
		this.purgeOldArchives();

		// Boucle : dormir → analyser → dormir → ...
		const config = this.readConfig();
		const intervalMs = config.intervalMinutes * 60_000;

		while (true) {
			await this.sleep(intervalMs);
			this.archiveIfTooBig();
			this.purgeOldArchives();
			this.analyze();
		}
	}
}

// Lancer l'observer
new LumiereObserver().run();
