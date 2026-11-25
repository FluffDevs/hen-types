# hen-types — Ordre de merge (partie publique)

> L'ordre de merge **global**, les conflits résolus et la checklist de déploiement sont
> dans le dépôt privé `FluffDevs/radio-config`, fichier `docs/MERGE-ORDER.md` (recopié
> dans `admin-panel-backend`, `admin-panel-front` et `awoo-queen`). Ce fichier n'en garde
> que le résumé, sans détail d'infrastructure. Mis à jour le 2026-11-22 après le
> regroupement des MR en une MR d'intégration par dépôt, puis le 2026-11-25 pour les
> corrections de review.

## 1. Les MR d'intégration de novembre 2026

Les MR ouvertes des cinq dépôts ont été regroupées en **une MR d'intégration par dépôt**
(branche `integration/novembre-2026`, chaque branche d'origine fusionnée en `--no-ff`).
Les MR d'origine sont fermées (non supprimées, branches conservées).

| Ordre | Dépôt | MR d'intégration |
|---|---|---|
| 1 | `hen-types` (ce dépôt) | https://github.com/FluffDevs/hen-types/pull/7 |
| 2 | `radio-config` | https://github.com/FluffDevs/radio-config/pull/8 |
| 3 | `admin-panel-backend` | https://github.com/FluffDevs/admin-panel-backend/pull/17 |
| 3 | `awoo-queen` | https://github.com/FluffDevs/awoo-queen/pull/14 |
| 4 | `admin-panel-front` | https://github.com/MatheoCASSY/admin-panel-front/pull/19 |

Ordre de merge et de déploiement :

1. **hen-types #7 en premier**, puis re-pointer les sous-modules du backend
   (`src/models`) et du front (`lib/hen-types`) sur le commit obtenu sur `main` de
   hen-types.
2. radio-config #8 (configuration du serveur de diffusion).
3. admin-panel-backend #17 et awoo-queen #14 **ensemble** : avec le fuseau horaire, les
   créneaux récurrents passent 1 h plus tôt qu'aujourd'hui (donc à l'heure affichée dans
   l'éditeur).
4. admin-panel-front #19, après le backend.

## 2. Contenu de hen-types #7

| MR d'origine (fermée) | Contenu |
|---|---|
| https://github.com/FluffDevs/hen-types/pull/2 | `FullSchedule.timezone` (`Europe/Paris` par défaut), heures récurrentes en heure murale, `expandEventOccurrences` |
| https://github.com/FluffDevs/hen-types/pull/3 | `explicit_restriction` (plage sans titres explicites) et helpers |
| https://github.com/FluffDevs/hen-types/pull/4 | `lufs` et `true_peak` sur `MusicMetadata` |
| https://github.com/FluffDevs/hen-types/pull/5 | `permissions.ts` : catalogue des droits et helpers |
| https://github.com/FluffDevs/hen-types/pull/6 | Documentation |
| (commit d'intégration) | Directive eslint placée sur la ligne du `type Json` (elle faisait échouer la CI du front) |
| (commit d'intégration) | Corrections de review : `first_occurence` = date d'ancrage (date murale comparée à sa date UTC), occurrences longues en cours gardées et fenêtre non bornée refusée dans `expandEventOccurrences`, fuseaux IANA canoniques seulement, `duration` sans années / mois / virgule, `explicit_restriction` `from === to` accepté si désactivée, silence mesuré (`lufs` -70) distinct de « non mesuré », `dashboard:read` pour tous les anciens groupes et `monitoring:*` pour `ProgrammeursRadio` |

Aucun conflit à la fusion.

## 3. Re-pointer les sous-modules après le merge

Les MR d'intégration du backend et du front pointent aujourd'hui sur `ed2a13d` (branche
`integration/novembre-2026` de hen-types), qui ne contient pas encore les corrections de
review : une fois celles-ci commitées sur la branche, re-pointer les deux sous-modules sur
ce nouveau commit avant la review finale. Après le merge de hen-types #7 :

```sh
git -C src/models fetch && git -C src/models checkout <commit main>      # admin-panel-backend
git -C lib/hen-types fetch && git -C lib/hen-types checkout <commit main>  # admin-panel-front
git add src/models   # ou lib/hen-types
git commit -m "chore: pointe hen-types sur main"
```

awoo-queen (Rust) n'importe pas ce module : il recopie les formats, déjà mis à jour dans
sa MR d'intégration.

## 4. Tests

Ce dépôt n'a pas d'outillage propre : les tests de `schedule.test.ts` et
`permissions.test.ts` tournent depuis le backend, sous-module pointé sur le commit à
tester : `npx vitest run src/models/`.

## 5. Après un ajout de page dans le catalogue des droits

Modifier à la fois le type `Permission` et `PERMISSION_PAGES` (un test vérifie la
cohérence), re-pointer les parents, puis lancer « Synchroniser le catalogue » dans le
panel.
