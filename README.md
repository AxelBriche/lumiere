# Lumiere

Systeme d'apprentissage par intuitions pour [Claude Code](https://claude.ai/code).

Lumiere observe ce que Claude Code fait pendant les sessions de developpement, detecte les patterns qui se repetent, et les transforme en **intuitions** -- des comportements appris reutilisables.

## Comment ca marche

```
Tu travailles avec Claude Code
  | chaque action est capturee (hook PostToolUse)
  | un observer background analyse toutes les 5 min
  | les patterns recurrents deviennent des intuitions
  | les intuitions peuvent evoluer en skills/agents
```

**Exemple concret :** Vous corrigez 3 fois le meme probleme de securite dans vos endpoints -- une mutation (update, delete) sans verifier que la ressource appartient a l'utilisateur. Lumiere detecte ce pattern et cree cette intuition :

```markdown
---
id: ownership-check-before-mutation
trigger: "quand on cree un endpoint qui modifie ou supprime une ressource"
confidence: 0.7
domain: security
source: session-observation
---

# Verifier la propriete de la ressource avant toute mutation

## Action
Avant tout update ou delete, verifier que la ressource appartient a l'utilisateur
authentifie. Charger la ressource, comparer son ownerId avec locals.user.id,
et retourner 403 si ce n'est pas le cas -- jamais un message d'erreur qui
revele l'existence de la ressource (utiliser 404, pas 403, pour les
ressources sensibles).

## Evidence
- Observe 3 fois (endpoints dishes, categories, reservations)
- Pattern : Write(endpoint update/delete) -> test -> correction ownership check
- Derniere observation : 2026-03-28
```

Resultat : la prochaine fois que vous creez un endpoint de mutation, Claude verifie automatiquement la propriete de la ressource, utilise le bon code d'erreur, et ne fuite pas d'information sur l'existence des ressources d'autres utilisateurs.

## Installation

```bash
# Ajouter le plugin depuis le marketplace
claude plugin marketplace add https://github.com/AxelBriche/lumiere

# Installer le plugin
claude plugin install lumiere@lumiere
```

Relancer Claude Code. Les hooks et skills sont decouverts automatiquement.

## Commandes

| Commande | Description |
|----------|-------------|
| `/lm:intuition-list` | Afficher les intuitions apprises |
| `/lm:intuition-create` | Analyser les observations et creer des intuitions |
| `/lm:intuition-to-skill` | Grouper les intuitions en skills/agents |

## Observer background

L'observer se lance automatiquement apres 20 observations. Il tourne en arriere-plan et analyse toutes les 5 minutes.

Configurable dans `_lumiere/config.json` :

```json
{
  "enabled": true,
  "minObservations": 20,
  "model": "sonnet",
  "intervalMinutes": 5
}
```

Logs dans `_lumiere/observer.log`.

## Dashboard

Interface web pour suivre Lumiere en temps reel : statut de l'observer, intuitions, logs, configuration.

```bash
# Depuis la racine du projet utilisateur
cd <chemin-vers-le-plugin>/dashboard
npm install
LUMIERE_DIR=<chemin-projet>/_lumiere npm run dev -- -p 3100
```

Ouvrir http://localhost:3100

Le dashboard affiche 4 onglets :
- **Statut** -- observer actif/arrete, nombre d'observations et d'intuitions, forcer une analyse
- **Intuitions** -- liste complete avec recherche, edition en markdown, suppression
- **Journaux** -- logs de l'observer en temps reel (SSE)
- **Config** -- modifier les parametres (modele, intervalle, seuil) a chaud

Construit avec Next.js + shadcn/ui. Outil local, pas deploye.

## Architecture

```
.claude/skills/lumiere/              <- le code (ce repo)
|-- .claude-plugin/                  <- manifeste plugin + marketplace
|-- hooks/
|   +-- hooks.json                   <- SessionStart + PostToolUse (auto-decouverte)
|-- skills/                          <- skills decouverts automatiquement
|   |-- lumiere/SKILL.md
|   |-- intuition-list/SKILL.md
|   |-- intuition-create/SKILL.md
|   +-- intuition-to-skill/SKILL.md
|-- scripts/                         <- le moteur d'apprentissage
|   |-- paths.ts                     <- resolution centralisee des chemins
|   |-- session-start.ts             <- hook SessionStart (Setup + IntuitionInjector)
|   |-- setup.ts                     <- init manuelle _lumiere/
|   |-- analyze.ts                   <- observations -> intuitions (prompt Claude)
|   |-- observer.ts                  <- process background (boucle 5 min)
|   +-- hooks/
|       |-- observe.ts               <- hook PostToolUse (capture les actions)
|       +-- notify.ts                <- gestionnaire observer (classe Observer)
+-- dashboard/                       <- interface web (Next.js + shadcn/ui)
    |-- package.json
    +-- src/
        |-- app/                     <- page unique + API routes
        |-- components/              <- tabs shadcn/ui
        +-- lib/                     <- acces aux fichiers _lumiere/

_lumiere/                            <- donnees locales (gitignored)
|-- config.json
|-- observations.jsonl
|-- observer.log
|-- archives/
+-- intuitions/
```

## Prerequis

- [Claude Code](https://claude.ai/code) (CLI)
- [Bun](https://bun.sh) (pour les scripts)
- [Node.js](https://nodejs.org) (pour le dashboard)

## Licence

MIT
