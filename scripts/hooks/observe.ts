/**
 * Lumiere — Hook d'observation (PostToolUse)
 *
 * Après chaque action de Claude Code (Edit, Read, Bash, Grep...),
 * Claude Code lance ce script et lui envoie les détails de l'action
 * sous forme de JSON (quel outil, quels paramètres, quel résultat).
 *
 * Ce script fait 2 choses :
 * 1. Enregistre l'action dans observations.jsonl (le journal brut)
 * 2. Prévient l'observer background qu'il y a du nouveau (toutes les 20 observations)
 */

import { appendFile, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { Observer } from './notify.js';
import { createPaths } from '../paths.js';

/**
 * Remplace les valeurs sensibles par [REDACTED].
 * Détecte : api_key="xxx", token: xxx, password=xxx, authorization: Bearer xxx
 */
const SECRET_RE =
	/(api[_-]?key|token|secret|password|authorization|credentials?|auth)(["'\s:=]+)(?:[A-Za-z]+\s+)?([A-Za-z0-9_\-/.+=]{8,})/gi;

function scrub(value: string): string {
	return value.replace(SECRET_RE, '$1$2[REDACTED]');
}

/** Convertit en string et coupe à `max` caractères pour éviter des observations géantes. */
function truncate(value: unknown, max = 3000): string {
	if (typeof value === 'string') return value.length > max ? value.slice(0, max) : value;
	const str = JSON.stringify(value ?? '', (_key, val) =>
		typeof val === 'string' && val.length > max ? val.slice(0, max) : val
	);
	return str.length > max ? str.slice(0, max) : str;
}

async function main() {
	// 1. Lire les données envoyées par Claude Code (via le "tuyau d'entrée" du script)
	//    Timeout de 3 secondes — un hook ne doit jamais bloquer Claude Code
	const raw = await new Promise<string>((resolve) => {
		const timer = setTimeout(() => resolve(''), 3000);
		let data = '';
		process.stdin.on('data', (chunk) => (data += chunk));
		process.stdin.on('error', () => {
			clearTimeout(timer);
			resolve('');
		});
		process.stdin.on('end', () => {
			clearTimeout(timer);
			resolve(data.trim());
		});
	});
	if (!raw) process.exit(0);

	// 2. Parser le JSON — si invalide, on sort silencieusement
	let data: Record<string, unknown>;
	try {
		data = JSON.parse(raw);
	} catch {
		process.exit(0);
	}

	// 3. Résoudre les chemins (après parsing pour avoir data.cwd comme fallback)
	const paths = createPaths(data.cwd as string | undefined);

	// Créer le dossier une seule fois au démarrage si besoin
	if (!existsSync(paths.lumiereDir)) mkdirSync(paths.lumiereDir, { recursive: true });

	// Persister le répertoire projet pour les processus détachés
	writeFileSync(paths.projectDirMarker, paths.projectDir);

	// L'observer gère le process background qui analyse les observations
	const observer = new Observer(paths);

	// 4. Extraire les champs utiles (Claude Code utilise des noms variés selon les versions)
	const toolName = (data.tool_name ?? data.tool ?? 'unknown') as string;
	const toolInput = data.tool_input ?? data.input ?? '';
	const toolOutput = data.tool_response ?? data.tool_output ?? data.output ?? '';
	const sessionId = (data.session_id ?? 'unknown') as string;

	// 5. Construire l'observation : tronquer puis redacter les secrets
	const observation = {
		timestamp: new Date().toISOString(),
		event: 'tool_complete',
		tool: toolName,
		input: scrub(truncate(toolInput)),
		output: scrub(truncate(toolOutput)),
		session: sessionId
	};

	// 6. Enregistrer l'observation
	appendFile(paths.observations, JSON.stringify(observation) + '\n', () => {});

	// 7. Prévenir l'observer background
	observer.notify();
}

// Si quoi que ce soit plante, on sort silencieusement (un hook ne doit jamais bloquer Claude Code)
main().catch(() => process.exit(0));
