/**
 * Lumiere — Gestionnaire de l'observer background
 *
 * Fait le lien entre le hook (qui capture les observations)
 * et l'observer (qui les analyse en arrière-plan).
 *
 * Toutes les 20 observations :
 * - Si l'observer tourne → le réveille avec un signal SIGUSR1
 * - Si l'observer est mort → le relance en arrière-plan
 *
 * Le seuil de 20 évite de surcharger l'observer
 * à chaque action de Claude Code (bug #521 d'ECC).
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import type { Paths } from '../paths.js';

export class Observer {
	/** Toutes les combien d'observations on contacte l'observer */
	private readonly signalEveryN = 20;

	/** Chemins résolus par le module paths */
	private readonly paths: Paths;

	constructor(paths: Paths) {
		this.paths = paths;
	}

	/**
	 * À appeler après chaque observation enregistrée.
	 * Incrémente un compteur et, toutes les 20 observations,
	 * réveille ou lance l'observer.
	 */
	notify(): void {
		const counter = this.incrementCounter();
		if (counter < this.signalEveryN) return;

		this.resetCounter();

		if (this.isRunning()) {
			this.wake();
		} else {
			this.start();
		}
	}

	/** Vérifie si l'observer est en vie via son fichier PID */
	private isRunning(): boolean {
		if (!existsSync(this.paths.observerPid)) return false;

		const pid = parseInt(readFileSync(this.paths.observerPid, 'utf-8'));
		try {
			// kill(pid, 0) ne tue pas — il vérifie juste que le process existe
			process.kill(pid, 0);
			return true;
		} catch {
			// Le process est mort mais le fichier PID traîne → on nettoie
			try {
				unlinkSync(this.paths.observerPid);
			} catch {}
			return false;
		}
	}

	/** Réveille l'observer avec SIGUSR1 pour qu'il analyse maintenant */
	private wake(): void {
		const pid = parseInt(readFileSync(this.paths.observerPid, 'utf-8'));
		try {
			process.kill(pid, 'SIGUSR1');
		} catch {}
	}

	/** Lance l'observer en arrière-plan (detached, silencieux) */
	private start(): void {
		const child = spawn('bun', [this.paths.observerScript], {
			detached: true, // survit à la fin du hook
			stdio: 'ignore' // tourne en silence
		});
		child.unref(); // le hook n'attend pas la fin de l'observer
	}

	/** Incrémente le compteur et retourne la nouvelle valeur */
	private incrementCounter(): number {
		let counter = 1;
		try {
			counter = parseInt(readFileSync(this.paths.observerCounter, 'utf-8')) + 1;
		} catch {}
		writeFileSync(this.paths.observerCounter, String(counter));
		return counter;
	}

	/** Remet le compteur à zéro */
	private resetCounter(): void {
		writeFileSync(this.paths.observerCounter, '0');
	}
}
