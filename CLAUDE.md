# CLAUDE.md -- Lumiere Plugin

## Description

Plugin Claude Code pour l'apprentissage par intuitions. Observe les sessions, detecte les patterns recurrents, et les transforme en intuitions reutilisables.

## Architecture

```
.claude-plugin/          <- plugin manifest + marketplace
hooks/hooks.json         <- SessionStart + PostToolUse (auto-charge)
skills/                  <- 4 skills (lumiere, intuition-list, intuition-create, intuition-to-skill)
scripts/
  paths.ts               <- resolution centralisee des chemins
  session-start.ts       <- hook SessionStart (Setup + IntuitionInjector)
  setup.ts               <- init manuelle _lumiere/
  analyze.ts             <- observations -> intuitions via Claude
  observer.ts            <- process background (boucle 5 min)
  hooks/
    observe.ts           <- hook PostToolUse (capture actions)
    notify.ts            <- gestionnaire observer (classe Observer)
dashboard/               <- app Next.js (interface web)
```

## Commandes

```bash
# Tests
bun test

# Dashboard (depuis la racine du projet utilisateur)
cd <chemin-plugin>/dashboard && npm run dev
```

## Principes de code

- **SRP** : une classe/module = une responsabilite
- **DRY** : chemins centralises dans paths.ts
- **Classes** quand il y a de l'etat (Observer, LumiereObserver) ; fonctions pures sinon
- **Pas de global** : tout est scope au projet ($CLAUDE_PROJECT_DIR/_lumiere/)

## Prerequis

- [Bun](https://bun.sh) (scripts TypeScript)
- [Node.js](https://nodejs.org) (dashboard Next.js)
