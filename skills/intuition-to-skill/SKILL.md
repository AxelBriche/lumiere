---
name: lm:intuition-to-skill
description: Analyse les intuitions Lumiere et propose des evolutions en skills, commandes ou agents
argument-hint: Ajouter --generate pour creer les fichiers directement
allowed-tools: ["Read", "Write", "Glob"]
---

# Evolve — Faire evoluer les intuitions en structures reutilisables

Lis tous les fichiers .md dans `_lumiere/intuitions/` du projet. Parse le frontmatter YAML de chacun (id, trigger, confidence, domain).

Puis analyse les intuitions pour identifier des **clusters** — des groupes d'intuitions lies qui pourraient devenir des structures plus puissantes.

## Regles d'evolution

### -> Skill (comportement auto-declenche)
Quand des intuitions decrivent des comportements qui devraient s'appliquer **automatiquement** :
- Triggers lies au meme pattern (style de code, gestion d'erreurs)
- 2+ intuitions dans le meme domaine avec des triggers similaires

Exemple :
- `prefer-functional` : "quand on ecrit des fonctions, preferer le style fonctionnel"
- `use-immutable` : "quand on modifie un etat, utiliser des patterns immutables"

-> Cree un skill : **functional-patterns**

### -> Commande (action invoquee par l'utilisateur)
Quand des intuitions decrivent des actions qu'un utilisateur **demanderait explicitement** :
- Intuitions avec des triggers comme "quand on cree un nouveau X"
- Intuitions qui suivent une sequence repetable
- Intuitions du domaine workflow avec confiance >= 0.7

Exemple :
- `new-table-step1` : "quand on ajoute une table, creer la migration"
- `new-table-step2` : "quand on ajoute une table, mettre a jour le schema"
- `new-table-step3` : "quand on ajoute une table, regenerer les types"

-> Cree une commande : **/new-table**

### -> Agent (processus multi-etapes complexe)
Quand des intuitions decrivent un processus **complexe** qui beneficie d'isolation :
- 3+ intuitions lies avec confiance moyenne >= 0.7
- Workflows de debogage, sequences de refactoring, taches de recherche

Exemple :
- `debug-step1` : "quand on debogue, d'abord verifier les logs"
- `debug-step2` : "quand on debogue, isoler le composant defaillant"
- `debug-step3` : "quand on debogue, creer une reproduction minimale"
- `debug-step4` : "quand on debogue, verifier le fix avec un test"

-> Cree un agent : **debugger**

## Ce que tu dois faire

1. Lis toutes les intuitions dans `_lumiere/intuitions/`
2. Groupe-les par domaine et par similarite de triggers
3. Identifie :
   - **Skill candidates** : clusters de 2+ intuitions avec triggers similaires
   - **Command candidates** : intuitions workflow a haute confiance (>= 0.7)
   - **Agent candidates** : clusters de 3+ intuitions avec confiance moyenne >= 0.7
4. Affiche le resultat dans ce format :

```
================================================
  EVOLVE — <N> intuitions analyses
================================================

Intuitions a haute confiance (>= 0.7) : <N>

## SKILL CANDIDATES

1. Cluster : "<nom>"
   Intuitions : <N>
   Confiance moyenne : <X>%
   Domaines : <domaines>
   Intuitions incluses :
     - <id> (confiance)
     - <id> (confiance)

## COMMAND CANDIDATES

  /<nom-commande>
    Depuis : <id intuition>
    Confiance : <X>%

## AGENT CANDIDATES

  <nom>-agent
    Couvre <N> intuitions
    Confiance moyenne : <X>%
```

5. Si l'utilisateur a passe `--generate` dans sa demande, **cree les fichiers directement dans `.claude/`** pour qu'ils soient actifs immediatement :

Pour un **skill** -> `.claude/skills/<nom>/SKILL.md` :
```
---
name: <nom>
description: <description>
evolved_from:
  - <id intuition 1>
  - <id intuition 2>
---

# <Titre>

[Contenu genere a partir des intuitions du cluster — combine les actions et triggers]
```

Pour une **commande** -> `.claude/commands/<nom>.md` :
```
---
description: <description>
evolved_from:
  - <id intuition>
---

# <Titre>

## Steps
1. ...
2. ...
```

Pour un **agent** -> `.claude/agents/<nom>.md` :
```
---
name: <nom>
description: <description>
model: sonnet
evolved_from:
  - <id intuition 1>
  - <id intuition 2>
  - <id intuition 3>
---

# <Titre>

[Processus multi-etapes genere a partir des intuitions]
```

Si aucun cluster n'est trouve, affiche :
```
Pas assez d'intuitions pour detecter des clusters. Continue a travailler et relance /lm:intuition-to-skill plus tard.
```
