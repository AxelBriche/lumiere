---
name: lm:intuition-create
description: Analyse les observations Lumiere et cree des intuitions (patterns appris)
allowed-tools: ["Bash", "Read", "Write"]
---

Lance l'analyseur Lumiere qui transforme les observations brutes en intuitions.

Execute cette commande :
```bash
bun "${CLAUDE_PLUGIN_ROOT}/scripts/analyze.ts"
```

Si le script dit "Pas assez d'observations", continue a travailler et relance plus tard.
Apres l'analyse, les intuitions sont dans `_lumiere/intuitions/` et les observations sont archivees.
