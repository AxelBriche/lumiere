/**
 * Lumiere — Analyseur d'observations
 *
 * Lit le journal des observations (ce que Claude a fait),
 * envoie les données à Claude pour détecter des patterns récurrents,
 * et génère des intuitions — des patterns appris réutilisables.
 *
 * Usage : bun .claude/skills/lumiere/scripts/analyze.ts
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createPaths } from './paths.js';

const paths = createPaths();

// Lire la config
interface Config {
	enabled: boolean;
	minObservations: number;
	model: string;
}
const config: Config = JSON.parse(readFileSync(paths.config, 'utf-8'));

if (!config.enabled) {
	console.log('Lumiere est désactivé (config.json → enabled: false)');
	process.exit(0);
}

// 1. Lire les observations
if (!existsSync(paths.observations)) {
	console.log('Aucune observation trouvée. Utilise Claude Code pour en générer.');
	process.exit(0);
}

const lines = readFileSync(paths.observations, 'utf-8').trim().split('\n').filter(Boolean);
if (lines.length < config.minObservations) {
	console.log(
		`Pas assez d'observations (${lines.length}/${config.minObservations}). Continue à travailler.`
	);
	process.exit(0);
}

// 2. Prendre les 200 dernières (le prompt + observations doivent tenir dans la fenêtre de contexte)
const recent = lines.slice(-200).join('\n');

// 3. Construire le prompt — UNIQUEMENT des patterns projet à haute valeur
const prompt = `# Détection de patterns PROJET — Crée des fichiers intuitions

Analyse ces observations Claude Code. Cherche UNIQUEMENT des patterns spécifiques au projet — des pièges, des conventions, des erreurs résolues qui éviteront de refaire les mêmes erreurs.

**NE CRÉE RIEN** si tu ne trouves pas de pattern à haute valeur. Zéro intuition vaut mieux que du bruit.

## Observations

${recent}

---

## Quoi chercher (UNIQUEMENT ces 3 catégories)

### 1. Pièges et erreurs non évidentes
Une **erreur surprenante** apparaît puis est **résolue** :
- L'erreur n'est PAS évidente (ex: un 429 qui est en fait un modèle incompatible, pas un rate limit)
- La cause racine est contre-intuitive ou mal documentée
- Le fix n'est pas googlable facilement

**→ Intuition** : "Quand on rencontre X, la vraie cause est Y, appliquer Z"

**EXCLURE** : erreurs de syntaxe, imports manquants, typos — ce sont des erreurs triviales, pas des pièges.

### 2. Conventions et décisions spécifiques au projet
Le projet a adopté une **convention non standard** ou fait un **choix d'architecture** :
- Un pattern framework utilisé d'une façon spécifique au projet (ex: auth via beforeLoad, pas middleware)
- Une bibliothèque qui a un comportement inattendu dans ce contexte (ex: base-ui render prop vs asChild)
- Un workaround pour une limitation de la stack (Cloudflare Workers, D1, TanStack Start)

**→ Intuition** : "Dans ce projet, pour X, toujours faire Y parce que Z"

**EXCLURE** : conventions universelles (immutabilité, DRY, nommage) — elles sont dans les règles globales.

### 3. Corrections utilisateur
L'utilisateur **corrige** explicitement ce que Claude vient de faire :
- Un Edit est immédiatement annulé/modifié avec des indices ("non", "plutôt", "pas comme ça")
- La correction révèle une **préférence projet** (pas juste un bug de Claude)

**→ Intuition** : "Pour ce projet, préférer Y au lieu de X parce que Z"

**EXCLURE** : corrections de bugs de Claude (mauvais fichier, mauvaise ligne) — ce sont des erreurs ponctuelles, pas des patterns.

## LISTE NOIRE — NE JAMAIS créer d'intuition sur :

- **Utilisation d'outils Claude Code** : "utiliser Glob au lieu de ls", "lire avant d'éditer", "Read avec offset" — Claude connaît déjà ses outils.
- **Workflows génériques** : "Grep → Read → Edit", "rechercher avant d'implémenter", "lire la doc avant de coder" — ce sont des évidences.
- **Patterns multi-agents** : "envoyer un message à un agent", "shutdown sequence" — c'est de la mécanique Claude Code, pas du savoir projet.
- **Habitudes git** : "micro-commit", "amend après cosmétique" — ce sont des préférences utilisateur documentées ailleurs.
- **Patterns de lecture** : "lire en parallèle", "lire partiellement" — optimisation d'outils, pas de valeur projet.

## Format de chaque fichier (OBLIGATOIRE)

Pour **chaque pattern**, crée un fichier dans \`${paths.intuitions}/\` nommé \`<id>.md\` **avec l'outil Write**.

\`\`\`
---
id: nom-en-kebab-case
trigger: "quand <condition précise et étroite>"
confidence: <voir barème ci-dessous>
domain: "<string libre — choisis ce qui décrit le mieux le contexte>"
source: session-observation
---

# Titre clair et descriptif

## Action
Une phrase concrète : quoi faire exactement. Inclure le POURQUOI (la cause racine).

## Evidence
- Observé N fois dans la session <id>
- Pattern : description précise du comportement détecté
- Dernière observation : <date>
\`\`\`

### Barème de confiance

| Occurrences | Confiance | Signification |
|-------------|-----------|---------------|
| 1-2 fois | **0.3** | Tentative — trop peu de données pour être sûr |
| 3-5 fois | **0.5** | Modéré — pattern probable |
| 6-10 fois | **0.7** | Fort — pattern confirmé |
| 11+ fois | **0.85** | Très fort — comportement systématique |

### Domaine

Le domaine est une **string libre**. Choisis le mot qui décrit le mieux le contexte du pattern.
Exemples : drizzle, auth, tanstack-router, mistral, cloudflare, shadcn, better-auth, d1, typescript...

## Règles

1. **ULTRA-CONSERVATEUR** — 3+ occurrences minimum. Dans le doute, **ne crée rien**. Mieux vaut 0 intuitions que 1 intuition générique.
2. **TEST DU PROJET** — Avant de créer, demande-toi : "est-ce spécifique à CE projet ou à TOUT projet ?" Si c'est universel → ne crée pas.
3. **TEST DE LA SURPRISE** — "Un dev senior serait-il surpris par ce comportement ?" Si non → ne crée pas.
4. **TRIGGERS PRÉCIS** — ✅ "quand Mistral retourne 429 sur des images base64" ❌ "quand on appelle une API"
5. **PREUVES TRAÇABLES** — chaque intuition **doit** lister : combien de fois, dans quelle session, à quelle date.
6. **FUSIONNER LES DOUBLONS** — **lis \`${paths.intuitions}/\` d'abord**. Si une intuition similaire existe, mets-le à jour au lieu d'en créer un nouveau.
7. **UNE INTUITION = UN COMPORTEMENT** — chaque intuition décrit un seul pattern.
8. **ZÉRO CODE SOURCE** — décrire le pattern, pas copier du code.
9. Chaque intuition = **un appel Write**`;

// 4. Écrire le prompt dans un fichier temp (évite les problèmes d'échappement shell)
const promptPath = join(tmpdir(), `lumiere-prompt-${Date.now()}.txt`);
writeFileSync(promptPath, prompt);
console.log(`Analyse de ${lines.length} observations avec ${config.model}...`);

try {
	execSync(
		`cat ${JSON.stringify(promptPath)} | claude --model ${config.model} --max-turns 15 --print --permission-mode acceptEdits --allowedTools "Read,Write" -p -`,
		{ stdio: 'inherit', timeout: 180_000 }
	);
} catch {
	console.error("Erreur pendant l'analyse.");
	process.exit(1);
} finally {
	try {
		require('node:fs').unlinkSync(promptPath);
	} catch {}
}

// 5. Archiver les observations traitées
mkdirSync(paths.archives, { recursive: true });
const archiveName = `observations-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.jsonl`;
renameSync(paths.observations, join(paths.archives, archiveName));
console.log(`✓ Observations archivées → ${archiveName}`);
