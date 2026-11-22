# hen-types

Modèles partagés de Fluff Radio : schémas **Zod v4**, types TypeScript et petites
fonctions client (`fetch` typé, avec la configuration CORS / cache par défaut).

Ce dépôt est inclus comme **sous-module git** dans :

- `admin-panel-backend`, dossier `src/models` (imports `src/models/<fichier>`) ;
- `admin-panel-front`, dossier `lib/hen-types`.

Le projet parent doit installer `zod` en version 4 au moins (`npm install zod`).

## Contenu

| Fichier | Rôle |
|---|---|
| `music.ts` | Catalogue des médias : `MediaCategory`, `MusicTags`, `MusicMetadata`, `Music`, `MusicsList`, fonctions client |
| `schedule.ts` | Planning : récurrence, contenus de créneau, `SLOT_TYPES`, `ScheduleEvent`, `FullSchedule`, `ResolvedSlot`, fonctions client |
| `schedule.test.ts` | Tests du planning |
| `playlist.ts` | Playlists |
| `animator.ts` | Comptes de direct (modes RTMP/SRT, chiffrement SRT, politique de fin de flux) |
| `genres.ts`, `languages.ts` | Listes de genres et de langues |

Détail : [`DOCUMENTATION_TECHNIQUE.md`](DOCUMENTATION_TECHNIQUE.md).

## Travailler sur hen-types

Il n'y a ni `package.json` ni CI ici : on teste depuis un dépôt parent, sous-module pointé
sur le commit voulu.

```sh
# dans admin-panel-backend
git -C src/models checkout <commit-ou-branche>
npx vitest run src/models/
npx tsc --noEmit
```

Après un merge ici, **re-pointer le sous-module** du backend et du front sur le nouveau
commit de `main`, sinon ils continuent d'utiliser l'ancienne version. awoo-queen (Rust)
n'importe pas ce module : il recopie les formats, à mettre à jour à la main.

## Documentation transverse

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) : résumé public de l'architecture et des
  MR ouvertes de ce dépôt (le document complet est dans le dépôt privé `radio-config`).
- [`docs/MERGE-ORDER.md`](docs/MERGE-ORDER.md) : ordre de merge des MR de hen-types et
  procédure de re-pointage des sous-modules.
