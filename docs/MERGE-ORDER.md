# hen-types — Ordre de merge (partie publique)

> L'ordre de merge **global** des 38 MR ouvertes des cinq dépôts, les conflits connus et
> la checklist de déploiement sont dans le dépôt privé `FluffDevs/radio-config`, fichier
> `docs/MERGE-ORDER.md` (recopié dans `admin-panel-backend`, `admin-panel-front` et
> `awoo-queen`). Ce fichier ne garde que ce qui concerne hen-types. Établi le 2026-11-22.

## 1. Merger les quatre MR de hen-types en premier

1. [#2](https://github.com/FluffDevs/hen-types/pull/2) fuseau horaire
2. [#3](https://github.com/FluffDevs/hen-types/pull/3) plage explicite (empilée sur #2 :
   GitHub la rebascule sur `main` après le merge de #2)
3. [#4](https://github.com/FluffDevs/hen-types/pull/4) `lufs` / `true_peak`
4. [#5](https://github.com/FluffDevs/hen-types/pull/5) catalogue des droits

Elles touchent des fichiers différents (sauf #2 et #3, empilées) : pas de conflit attendu
d'après les merges d'essai de leurs auteurs. Elles n'ont aucun effet tant que les dépôts
parents ne pointent pas dessus. Noter le commit obtenu sur `main` : on l'appelle `H`.

## 2. Re-pointer les sous-modules des dépôts parents sur `H`

Aujourd'hui, les MR parentes pointent sur des commits de **branches** de hen-types :

| Branche de hen-types | Commit | MR parentes |
|---|---|---|
| `feat/schedule-timezone` | `5185272` | backend #7, front #6 |
| `feat/explicit-hours` | `1096e77` | backend #9, front #9 |
| `feat/track-loudness` | `573cfad` | backend #11, front #11 |
| `feat/permissions` | `fee3ae4` | backend #12, #13, #14 ; front #12, #13, #14, #16 |

Avant le merge de chacune, re-pointer son sous-module sur `H` :

```sh
git -C src/models fetch && git -C src/models checkout H      # admin-panel-backend
git -C lib/hen-types fetch && git -C lib/hen-types checkout H  # admin-panel-front
git add src/models   # ou lib/hen-types
git commit -m "chore: pointe hen-types sur main"
```

Toutes les MR pointant alors sur le même commit, le pointeur ne crée plus de conflit
entre elles.

## 3. Tests

Ce dépôt n'a pas d'outillage propre : les tests de `schedule.test.ts` (et ceux de
`permissions.ts` dans #5) tournent depuis le backend, sous-module pointé sur le commit à
tester : `npx vitest run src/models/`.

## 4. Après un ajout de page dans le catalogue des droits (#5 mergée)

Modifier à la fois le type `Permission` et `PERMISSION_PAGES` (un test vérifie la
cohérence), re-pointer les parents, puis lancer « Synchroniser le catalogue » dans le
panel.
