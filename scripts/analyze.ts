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

// 3. Construire le prompt DETAILLE (benchmarké : 8/8 patterns, capte optional chaining)
const prompt = `# Détection de patterns — Crée des fichiers intuitions

Analyse ces observations Claude Code. Pour chaque pattern récurrent (3+ fois), **crée un fichier** dans \`${paths.intuitions}/<id>.md\` avec l'outil Write.

## Observations

${recent}

---

## Quoi chercher

### 1. Corrections de l'utilisateur
L'utilisateur **corrige** ce que Claude vient de faire :
- Un Edit est immédiatement suivi d'un autre Edit sur le même fichier qui **annule ou modifie** le premier
- L'input contient des indices de correction : "non", "plutôt", "en fait", "pas comme ça"
- Un undo/redo rapide (même fichier, même zone, changement contradictoire)

**→ Intuition** : "Quand on fait X, **préférer** Y à la place"

### 2. Résolutions d'erreurs
Une **erreur** apparaît puis est **résolue** :
- L'output d'un outil contient un message d'erreur (error, failed, exception, cannot...)
- Les **appels suivants** corrigent le problème (Edit du même fichier, nouvelle commande Bash)
- Le **même type d'erreur** est résolu de la **même façon** plusieurs fois

**→ Intuition** : "Quand on rencontre l'erreur X, **appliquer** la correction Y"

### 3. Workflows répétés
La **même séquence** d'outils revient plusieurs fois :
- Même enchaînement d'outils avec des inputs de structure similaire (ex: Grep → Read → Edit)
- Les **mêmes fichiers** changent ensemble à chaque fois
- Des opérations **groupées dans le temps**

**→ Intuition** : "Pour faire X, **suivre** les étapes Y → Z → W"

### 4. Préférences d'outils
Certains outils sont **systématiquement** choisis :
- Grep est **toujours** utilisé avant Edit (vérification avant modification)
- Read est **préféré** à Bash cat pour lire des fichiers
- Des commandes Bash **spécifiques** sont utilisées pour certaines tâches

**→ Intuition** : "Pour X, **utiliser** l'outil Y plutôt que Z"

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
Une phrase concrète : quoi faire exactement.

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
Exemples : code-style, testing, git, debugging, workflow, sveltekit, drizzle, auth, tooling, typescript...

## Règles

1. **CONSERVATEUR** — 3+ occurrences minimum. Dans le doute, **ne crée rien**. Mieux vaut rater un pattern que d'en inventer un.
2. **TRIGGERS PRÉCIS** — ✅ "quand on crée un endpoint POST sans validation" ❌ "quand on code"
3. **PREUVES TRAÇABLES** — chaque intuition **doit** lister : combien de fois, dans quelle session, à quelle date. Sans preuves, pas d'intuition.
4. **ZÉRO CODE SOURCE** — décrire le **pattern**, pas copier du code.
5. **FUSIONNER LES DOUBLONS** — **lis \`${paths.intuitions}/\` d'abord**. Si une intuition similaire existe, mets-le à jour au lieu d'en créer un nouveau.
6. **UNE INTUITION = UN COMPORTEMENT** — chaque intuition décrit un seul pattern. Pas de fourre-tout.
7. Chaque intuition = **un appel Write**

## Exemple complet

Observations :
\`\`\`
{"event":"tool_complete","tool":"Grep","input":"pattern: useState","session":"abc123"}
{"event":"tool_complete","tool":"Read","input":"src/hooks/useAuth.ts","session":"abc123"}
{"event":"tool_complete","tool":"Edit","input":"src/hooks/useAuth.ts...","session":"abc123"}
\`\`\`
(cette séquence Grep → Read → Edit apparaît **5 fois**)

→ Fichier créé \`grep-read-before-edit.md\` :
\`\`\`
---
id: grep-read-before-edit
trigger: "quand on modifie du code existant"
confidence: 0.5
domain: workflow
source: session-observation
---

# Chercher et lire avant de modifier

## Action
Avant de modifier un fichier avec Edit, toujours chercher le contexte avec Grep puis lire le fichier complet avec Read.

## Evidence
- Observé 5 fois dans la session abc123
- Pattern : séquence Grep → Read → Edit sur le même fichier
- Dernière observation : 2026-03-26
\`\`\``;

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
