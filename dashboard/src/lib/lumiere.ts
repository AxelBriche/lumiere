/**
 * Accès aux fichiers de Lumiere depuis le dashboard Next.js.
 * Toutes les fonctions lisent/écrivent dans le dossier _lumiere/.
 * Par défaut : process.cwd()/_lumiere (l'utilisateur lance le dashboard depuis la racine du projet).
 * Override : LUMIERE_DIR=/chemin/vers/_lumiere npm run dev
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { LumiereConfig, LumiereStatus, Intuition } from "./types";

const LUMIERE_DIR = process.env.LUMIERE_DIR ?? path.join(process.cwd(), '_lumiere');

const PATHS = {
	config: path.join(LUMIERE_DIR, "config.json"),
	observations: path.join(LUMIERE_DIR, "observations.jsonl"),
	observerPid: path.join(LUMIERE_DIR, ".observer.pid"),
	observerLog: path.join(LUMIERE_DIR, "observer.log"),
	intuitions: path.join(LUMIERE_DIR, "intuitions"),
	archives: path.join(LUMIERE_DIR, "archives"),
};

const CONFIG_DEFAULTS: LumiereConfig = {
	enabled: true,
	minObservations: 20,
	model: "sonnet",
	intervalMinutes: 5,
};

// --- Config ---

export function readConfig(): LumiereConfig {
	if (!fs.existsSync(PATHS.config)) return { ...CONFIG_DEFAULTS };
	const raw = JSON.parse(fs.readFileSync(PATHS.config, "utf-8"));
	return { ...CONFIG_DEFAULTS, ...raw };
}

export function writeConfig(config: LumiereConfig): void {
	fs.writeFileSync(PATHS.config, JSON.stringify(config, null, "\t") + "\n");
}

// --- Observer status ---

export function getObserverStatus(): LumiereStatus {
	const config = readConfig();

	let running = false;
	let pid: number | null = null;

	if (fs.existsSync(PATHS.observerPid)) {
		pid = parseInt(fs.readFileSync(PATHS.observerPid, "utf-8").trim());
		try {
			process.kill(pid, 0);
			running = true;
		} catch {
			pid = null;
		}
	}

	let pendingObservations = 0;
	if (fs.existsSync(PATHS.observations)) {
		const content = fs.readFileSync(PATHS.observations, "utf-8").trim();
		pendingObservations = content ? content.split("\n").length : 0;
	}

	let totalIntuitions = 0;
	if (fs.existsSync(PATHS.intuitions)) {
		totalIntuitions = fs
			.readdirSync(PATHS.intuitions)
			.filter((f) => f.endsWith(".md")).length;
	}

	// Trouver la dernière analyse dans le log
	let lastAnalysis: string | null = null;
	if (fs.existsSync(PATHS.observerLog)) {
		const logContent = fs.readFileSync(PATHS.observerLog, "utf-8").trim();
		const lines = logContent.split("\n").reverse();
		for (const line of lines) {
			if (line.includes("Analyse lancée") || line.includes("Analyse terminée")) {
				const match = line.match(/\[(.*?)\]/);
				if (match) { lastAnalysis = match[1]; break; }
			}
		}
	}

	return {
		running,
		pid,
		pendingObservations,
		totalIntuitions,
		enabled: config.enabled,
		intervalMinutes: config.intervalMinutes,
		lastAnalysis,
	};
}

// --- Observer control ---

export function signalObserver(signal: "SIGUSR1" | "SIGTERM"): boolean {
	if (!fs.existsSync(PATHS.observerPid)) return false;
	const pid = parseInt(fs.readFileSync(PATHS.observerPid, "utf-8").trim());
	try {
		process.kill(pid, signal);
		return true;
	} catch {
		return false;
	}
}

// --- Logs ---

export function readLogLines(n: number): string[] {
	if (!fs.existsSync(PATHS.observerLog)) return [];
	const content = fs.readFileSync(PATHS.observerLog, "utf-8").trim();
	if (!content) return [];
	const lines = content.split("\n");
	return lines.slice(-n);
}

export function getLogFilePath(): string {
	return PATHS.observerLog;
}

// --- Intuitions ---

export function listIntuitions(): Intuition[] {
	if (!fs.existsSync(PATHS.intuitions)) return [];

	return fs
		.readdirSync(PATHS.intuitions)
		.filter((f) => f.endsWith(".md"))
		.map((filename) => {
			const filepath = path.join(PATHS.intuitions, filename);
			const raw = fs.readFileSync(filepath, "utf-8");
			const stat = fs.statSync(filepath);
			const { data, content } = matter(raw);
			return {
				id: data.id ?? filename.replace(".md", ""),
				trigger: data.trigger ?? "",
				confidence: data.confidence ?? 0,
				domain: data.domain ?? "",
				source: data.source ?? "",
				filename,
				content: content.trim(),
				createdAt: stat.birthtime.toISOString(),
			};
		});
}

export function readIntuition(
	filename: string
): { raw: string; parsed: Intuition } | null {
	const filepath = path.join(PATHS.intuitions, filename);
	if (!fs.existsSync(filepath)) return null;
	const raw = fs.readFileSync(filepath, "utf-8");
	const stat = fs.statSync(filepath);
	const { data, content } = matter(raw);
	return {
		raw,
		parsed: {
			id: data.id ?? filename.replace(".md", ""),
			trigger: data.trigger ?? "",
			confidence: data.confidence ?? 0,
			domain: data.domain ?? "",
			source: data.source ?? "",
			filename,
			content: content.trim(),
			createdAt: stat.birthtime.toISOString(),
		},
	};
}

export function writeIntuition(filename: string, content: string): void {
	const filepath = path.join(PATHS.intuitions, filename);
	fs.writeFileSync(filepath, content);
}

export function deleteIntuition(filename: string): boolean {
	const filepath = path.join(PATHS.intuitions, filename);
	if (!fs.existsSync(filepath)) return false;
	fs.unlinkSync(filepath);
	return true;
}
