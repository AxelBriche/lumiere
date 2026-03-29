---
name: lumiere
description: This skill should be used when the user asks about "learned patterns", "intuitions", "what has Lumiere learned", "observation system", or when Claude Code needs context about recurring development patterns detected in this project. Provides auto-activated context about the Lumiere learning system.
version: 1.0.0
---

# Lumiere — Apprentissage par intuitions

Lumiere observe ce que Claude Code fait pendant les sessions de développement, detecte les patterns qui se repetent, et les transforme en **intuitions** — des comportements appris reutilisables.

## Architecture

```
hooks/hooks.json                 <- auto-charge par Claude Code
  SessionStart -> session-start.ts   (init lazy + injection intuitions)
  PostToolUse  -> observe.ts         (capture chaque action)

scripts/
  session-start.ts               <- init _lumiere/ + injecte les intuitions
  hooks/observe.ts               <- hook PostToolUse, capture chaque action
  hooks/notify.ts                <- gestionnaire de l'observer background
  observer.ts                    <- process background (boucle 5 min)
  analyze.ts                     <- observations -> intuitions via Claude
  paths.ts                       <- resolution centralisee des chemins

$CLAUDE_PROJECT_DIR/_lumiere/    <- donnees locales (gitignored)
  config.json                    <- enabled, minObservations, model
  observations.jsonl             <- journal brut des actions
  archives/                      <- observations traitees
  intuitions/                    <- patterns detectes (.md avec frontmatter)
```

## Skills utilisateur

- `/lm:intuition-list` — afficher les intuitions apprises
- `/lm:intuition-create` — analyser les observations et creer des intuitions
- `/lm:intuition-to-skill` — grouper les intuitions en skills/commandes/agents

## Comment ca marche

1. **Observer** — le hook capture chaque action de Claude Code dans `_lumiere/observations.jsonl`
2. **Distiller** — l'observer background (ou `/lm:intuition-create`) lance l'analyseur qui detecte les patterns recurrents (3+ occurrences)
3. **Injecter** — au demarrage de session, toutes les intuitions sont injectees dans le contexte de Claude
4. **Evoluer** — `/lm:intuition-to-skill` regroupe les intuitions similaires en skills, commandes ou agents

## Format des intuitions

```markdown
---
id: nom-en-kebab-case
trigger: "quand <condition precise>"
confidence: 0.3-0.9
domain: "<string libre>"
source: session-observation
---

# Titre

## Action
Quoi faire exactement.

## Evidence
- Observe N fois
- Pattern : description
- Derniere observation : date
```

## Bareme de confiance

| Score | Comportement |
|-------|-------------|
| 0.3 | Suggere mais pas force |
| 0.5 | Applique quand pertinent |
| 0.7 | Auto-approuve |
| 0.9 | Comportement core |
