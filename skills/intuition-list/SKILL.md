---
name: lm:intuition-list
description: Affiche les intuitions Lumiere apprises pour ce projet
argument-hint: Optionnel - filtrer par domaine
allowed-tools: ["Read", "Glob"]
---

Lis tous les fichiers .md dans `_lumiere/intuitions/` du projet.

Pour chaque fichier :
1. Parse le frontmatter YAML (entre les marqueurs `---`)
2. Extrais : id, trigger, confidence, domain

Affiche les resultats groupes par **domain**, tries par confiance decroissante.

Format d'affichage pour chaque intuition :
```
<barre de confiance sur 10 blocs>  <confidence>  <id>
  trigger: <trigger>
```

Exemple de sortie :
```
=== LUMIERE — 5 intuitions ===

WORKFLOW (2)
  ██████████░░  0.7  grep-read-before-edit
    trigger: quand on modifie du code existant
  ██████░░░░░░  0.5  server-svelte-data-sync
    trigger: quand on ajoute une donnee a une fonction load

TYPESCRIPT (1)
  ██████░░░░░░  0.5  ts-check-fix-loop
    trigger: quand TypeScript signale une erreur de type
```

Si le dossier `_lumiere/intuitions/` est vide ou n'existe pas, affiche :
```
Aucune intuition apprise. Lance `/lm:intuition-create` apres avoir accumule des observations.
```
