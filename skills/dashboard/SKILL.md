---
name: lm:dashboard
description: Lance le dashboard web Lumiere pour visualiser les intuitions, observations et configuration
allowed-tools: ["Bash"]
---

Lance le dashboard Next.js de Lumiere.

Execute cette commande :
```bash
cd "${CLAUDE_PLUGIN_ROOT}/dashboard" && LUMIERE_DIR="${CLAUDE_PROJECT_DIR}/_lumiere" npx next dev --port 3100
```

Le dashboard sera accessible sur http://localhost:3100.
