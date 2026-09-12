# hen-types — Documentation technique

> Module TypeScript partagé (schémas Zod + fonctions client) entre `admin-panel-backend` et `admin-panel-front`, monté comme **submodule git** dans les deux dépôts. C'est la « source de vérité » des formes de données de tout FluffRadio.

## Sommaire

1. [Rôle et consommateurs](#1-rôle-et-consommateurs)
2. [Comment ce module est consommé](#2-comment-ce-module-est-consommé)
3. [`music.ts` — catalogue média](#3-musicts--catalogue-média)
4. [`schedule.ts` — planning de diffusion](#4-schedulets--planning-de-diffusion)
5. [`genres.ts` — genres musicaux](#5-genrests--genres-musicaux)
6. [`languages.ts` — langues](#6-languagests--langues)
7. [`animator.ts` — comptes de direct](#7-animatorts--comptes-de-direct)
8. [`playlist.ts` — playlists](#8-playlistts--playlists)
9. [Garanties testées](#9-garanties-testées)
10. [Couplage avec zod v4](#10-couplage-avec-zod-v4)
11. [Bonnes pratiques pour faire évoluer ce module](#11-bonnes-pratiques-pour-faire-évoluer-ce-module)

---

## 1. Rôle et consommateurs

`hen-types` n'est **pas un paquet npm publié** : c'est un dossier de code source pur (aucun `package.json`, aucune étape de build), partagé via **submodule git** entre :

- `admin-panel-backend/src/models` (remote SSH `git@github.com:FluffDevs/hen-types.git`) ;
- `admin-panel-front/lib/hen-types` (remote HTTPS `https://github.com/FluffDevs/hen-types.git`).

Chaque fichier définit des schémas **Zod** (validation à l'exécution) et les types TypeScript qui en découlent (`z.infer<typeof X>`), qui servent de **source de vérité unique** pour la forme de chaque donnée échangée dans tout le projet — planning, catalogue média, playlists, comptes animateurs. Certains fichiers exportent en plus des fonctions `async` prêtes à l'emploi qui encapsulent `fetch` et valident la requête/réponse avec ces mêmes schémas.

Le `README.md` du module (4 lignes) résume l'intention :
> Ce dossier est synchronisé via `git submodule`. Il est partagé entre le front et le back. Il nécessite que le projet parent installe `zod` en v4 minimum. Les modèles exportent un objet Zod, un type TypeScript, et des fonctions async pour interroger l'API avec un typage automatique et une configuration par défaut (CORS, cache, etc.).

**Dépendance unique : zod v4** — le module utilise des API propres à la v4 (`z.iso.datetime()`, `z.iso.duration()`, `z.iso.time()`, `z.templateLiteral()`, `.meta()`). Chaque dépôt parent doit avoir `zod ^4` dans ses propres dépendances.

---

## 2. Comment ce module est consommé

### Côté backend

Import par **chemin brut, non aliasé** : `src/models/<fichier>`, par exemple :
```ts
import { ResolvedSlot } from "src/models/schedule";
import { MediaCategory, MusicMetadata } from "src/models/music";
```
Le `tsconfig.json` du backend définit bien un alias `@models/*`, mais celui-ci pointe vers un dossier **legacy distinct** (`src/models-old/*`), sans rapport avec ce submodule — ne pas confondre.

### Côté front

Import via l'alias tsconfig `"#/*": ["./lib/*"]`, donc **`#/hen-types/<fichier>`** :
```ts
import { MediaCategory } from '#/hen-types/music';
import { SLOT_TYPES } from '#/hen-types/schedule';
```

### Cycle de mise à jour

1. Le changement est fait et committé **dans le dépôt hen-types lui-même** (pas directement « depuis » un des deux parents — même si en pratique on édite les fichiers via le checkout submodule d'un des deux parents, il faut ensuite pousser ce commit vers `FluffDevs/hen-types`).
2. Chaque dépôt parent doit ensuite **avancer le pointeur de son submodule** vers le nouveau commit et committer ce changement de pointeur (une ligne dans son propre historique git, typiquement un commit `chore: bump hen-types (...)`).
3. La CI des deux dépôts parents fait un checkout avec `submodules: recursive`, puis lance lint/typecheck/test sur le contenu du submodule **avec les outils du dépôt parent** (biome+vitest+tsc côté backend, eslint+vitest+tsc côté front) — hen-types n'a pas sa propre CI ni son propre outillage.
4. Comme les deux parents peuvent avancer indépendamment, il faut veiller à ce qu'ils pointent vers un commit hen-types cohérent (idéalement le même) après chaque changement de schéma partagé, pour éviter une divergence de contrat de données entre front et back.

---

## 3. `music.ts` — catalogue média

### `MediaCategory`

```ts
export const MediaCategory = z.enum(["musics", "jingles", "podcasts", "ads", "vod", "others"]);
```

C'est la **taxonomie complète** de tout ce qui peut être stocké dans la médiathèque :
- `musics` — pistes musicales ;
- `jingles` — jingles/habillage antenne ;
- `podcasts` — émissions préenregistrées ;
- `ads` — publicités/promotions ;
- `vod` — VOD/rediffusions ;
- `others` — catch-all.

Cette valeur détermine notamment le préfixe de stockage S3 (`<category>/<id>`) côté backend et les routes `/media/:category/*`.

### `MusicTags`

Stocké dans les **tags S3** de l'objet (maximum 10 paires, 256 octets/valeur, UTF-16) :

| Champ | Type | Rôle |
|---|---|---|
| `hint` | `string` | Titre-artiste lisible par un humain, visible directement dans la console S3 |
| `page` | `string?` | Référence/URL source optionnelle |
| `validated_admin` | `boolean` (défaut `false`) | Drapeau de modération |

### `MusicMetadata`

Stocké dans une **annotation S3** (extension non standard, jusqu'à 1 Mo, JSON UTF-8) :

| Champ | Type | Rôle |
|---|---|---|
| `title` | `string` | Titre |
| `artist` | `string` | Artiste |
| `album` | `string?` | Album |
| `genre` | `string?` | Chaîne de genres séparés par virgule (voir `genres.ts`) |
| `duration` | `iso.duration()?` | Durée ISO-8601 |
| `year` | `number?` (coercé) | Année |
| `explicit` | `boolean` (défaut `false`) | Contenu explicite |
| `lang` | `string?` | Langue (voir `languages.ts`) |
| `furry` | `boolean` (défaut `false`) | Drapeau de contenu spécifique au site |
| `cue_in` | `number?` (coercé) | Point de départ de lecture (secondes) |
| `cue_out` | `number?` (coercé) | Point de fin de lecture (secondes) |
| `sacem_registry` | `string?` | Référence SACEM |

### `Music`

```ts
Music = MusicMetadata.extend({ id: string }).extend(MusicTags.omit({ hint: true }).shape)
```
Fusion complète : tous les champs de métadonnées + `id` + `page` + `validated_admin` (le champ `hint`, interne à S3, est délibérément exclu).

### `MusicsList`

Enveloppe de liste paginée : `{ musics: Music[], metadata: { page, total_pages, per_page } }`.

### Fonctions client (style « backend » : URL absolue, CORS+credentials, Bearer)

| Fonction | Appel | Rôle |
|---|---|---|
| `listMusics(token, page=0)` | `GET /media/musics?page=${page}` | Liste paginée |
| `getMusicData(token, id)` | `GET /media/musics/${id}` | Détail complet |
| `downloadMusic(token, id)` | `GET /media/musics/${id}/download` | Téléchargement binaire (Blob) |
| `deleteMusic(token, id)` | `DELETE /media/musics/${id}` | Suppression |
| `patchMusic(token, id, data)` | `PATCH /media/musics/${id}` | Mise à jour partielle |

> Note : l'upload n'est délibérément **pas** couvert ici (commentaire du code : *"uploadMusic require file management, not handled here"*) — chaque application implémente son propre flux d'upload (multipart direct-vers-S3 côté backend/frontend).

---

## 4. `schedule.ts` — planning de diffusion

C'est le fichier le plus volumineux et le plus central du module.

### Primitives de récurrence

- `WEEKDAYS` — tableau ordonné `["MONDAY", ..., "SUNDAY"]` ; `Weekday = z.enum(WEEKDAYS)`.
- `weekdayToIso(day)` — renvoie 1 (lundi) à 7 (dimanche).
- `DayOccurence = z.templateLiteral([Weekday, ":", z.iso.time({precision:0})])` — chaîne typée comme `"MONDAY:14:00:00"`.
- `parseDayOccurence(occ)` — découpe sur le **premier** `:`, valide le jour et l'heure, renvoie `{day, isoDay, time}`.

### `ScheduleContent` (union discriminée sur `kind`)

| `kind` | Champs | Sens |
|---|---|---|
| `live` | `animator_id`, `animator_label` | Créneau en direct animé |
| `playlist` | `playlist_id`, `random` (défaut false), `max_loop?` | Lecture d'une playlist |
| `media` | `medias: [{category: MediaCategory, media_id}]` (min 1), `random`, `max_loop?` | Pistes préenregistrées de la médiathèque |
| `alternate` | `sources: AlternateSource[]` (min 2) | Rotation entre plusieurs sources |

**`AlternateSource`** = union discriminée de `PlaylistContent`/`MediaContent`, chacun étendu d'un champ `take: number.int().min(1)` (défaut 1, nombre d'éléments joués d'affilée avant de passer à la source suivante).

Conçu **volontairement non récursif** : une alternance ne peut pas contenir une autre alternance, et une source live ne peut pas faire partie d'une alternance — pour éviter toute ambiguïté d'imbrication au niveau du modèle, de l'éditeur et du serveur de diffusion.

Sémantique de `alternate` (commentaire du code) : joue un tour de chaque source en boucle (ex. musique, jingle, musique, jingle) ; chaque source garde sa propre position et son propre budget de boucles, donc l'épuisement de l'une ne stoppe pas les autres — elle sort simplement de la rotation ; quand toutes sont épuisées, le créneau rend l'antenne à la priorité inférieure. Une alternance ne compte comme « travail terminé » (donc rattrapable si elle démarre en retard) que si **toutes** ses sources ont un `max_loop` — une seule source sans limite et la rotation ne s'arrête jamais.

### `SlotType` et la table `SLOT_TYPES`

```ts
SlotType = z.enum(["playlist", "playlist_alternee", "emission_live", "emission_rec", "habillage", "promo", "vod"])
```

Ce sont les types de créneau proposés dans l'éditeur ; chacun détermine `content.kind` et pré-remplit une priorité par défaut (modifiable) ; pour les types « media », `category` pré-filtre la recherche de médiathèque.

| `SlotType` | `label` | `content_kind` | `category` | `default_priority` |
|---|---|---|---|---|
| `playlist` | Playlist | `playlist` | `musics` | 1 |
| `playlist_alternee` | Playlist alternée | `alternate` | `musics` | 1 |
| `emission_live` | Émission — direct | `live` | — | 50 |
| `emission_rec` | Émission — préenregistrée | `media` | `podcasts` | 50 |
| `habillage` | Habillage / virgule | `media` | `jingles` | 25 |
| `promo` | Promotion | `media` | `ads` | 75 |
| `vod` | VOD / Rediffusion | `media` | `vod` | 50 |

Cette table est verrouillée par un test dédié (voir §9).

### `ScheduleEvent`

> **Toutes les dates/heures du document sont interprétées en UTC** par le serveur ; c'est au front/client de convertir vers/depuis UTC.

- `timing` : union de deux formes —
  - récurrent : `{first_occurence, last_occurence?, repeat_every_weeks: number.int().min(1), days: DayOccurence[].min(1)}` ;
  - ponctuel : `{date}`.
- `event_id`, `enabled` (défaut true), `title`, `description` (défaut ""), `slot_type`, `duration` (durée ISO 8601, ex. `PT1H`), `priority` (0-100, défaut 1), `content`, `created_by/at`, `updated_by/at`.

### `FullSchedule` / `ScheduleWithMetadata`

- `FullSchedule = {events: ScheduleEvent[], default_playlist_id?}` — le document éditable (ce qu'on envoie en `PUT`).
- `ScheduleWithMetadata = FullSchedule.extend({version, updated_by, updated_at})` — ajoute le verrouillage optimiste et les champs d'audit ; c'est ce que renvoie `GET`.

### `ResolvedSlot`

Un créneau résolu à un instant donné, renvoyé par `/now` et `/after`. `content` porte toutes les informations selon `content.kind`.

`{event_id, title, description, slot_type, startAt, endAt, priority, source: enum(["recurring","one_off","default"]), content}`.

### Fonctions client (style « frontend » : chemins relatifs `/api/...`, `cache: "no-store"`)

| Fonction | Appel | Rôle |
|---|---|---|
| `getSchedule()` | `GET /api/programmations` | Lit le planning complet, jette une erreur si non-OK |
| `putSchedule(token, doc, baseVersion)` | `PUT /api/programmations` | Écrit avec verrou optimiste ; retourne `{ok:true, saved}` ou `{ok:false, status, error, issues?, currentVersion?}` (ne jette pas — laisse l'appelant gérer le conflit) |
| `getResolvedNow()` | `GET /api/programmations/now` | Renvoie `null` si absent/erreur |
| `getResolvedAfter()` | `GET /api/programmations/after` | Idem pour le créneau suivant |

---

## 5. `genres.ts` — genres musicaux

- `MUSIC_GENRES` — liste constante de **143 genres** normalisés (familles Pop, Rock, Metal, Punk, Rap/Hip-Hop, RnB/Soul/Funk/Gospel, Blues/Jazz, Electro/EDM/House/Techno/Trance, Drum&Bass/Dubstep, Ambient/Expérimental/Industriel, Reggae/Ska/Dub, World/Latin/Afro, Folk/Country/Chanson française, musiques régionales, pop asiatique (K-Pop/J-Pop/Vocaloid/OST anime), classique, bandes originales, spoken word/comédie/ASMR/podcast, mix/mashup/remix, et un genre « Autre » générique), plus 3 genres « habillage antenne » ajoutés en fin de liste : `"Jingle / Habillage"`, `"Emission preenregistree"`, `"Promo / Publicite"`.
- `parseGenres(genre)` — découpe la chaîne stockée (séparée par virgules) en tableau, sans doublons ni vides, en préservant l'ordre.
- `serializeGenres(genres)` — reconstruit la chaîne à stocker à partir d'une liste (re-passe par `parseGenres` pour dédupliquer/normaliser).
- `isKnownGenre(genre)` — indique si un genre fait partie de la liste normalisée (sinon c'est une saisie libre, catégorisée « Autre » côté UI).

---

## 6. `languages.ts` — langues

Objectif : éviter la fragmentation d'un champ langue en texte libre (`"fr"` / `"FR"` / `"français"`).

- `MUSIC_LANGUAGES` — 19 codes : ISO 639-1 en minuscules (`fr, en, es, de, it, pt, nl, ru, ja, ko, zh, ar, pl, sv, fi, tr`) + valeurs utilitaires radio (`multi` — plusieurs langues dans un même titre, `instrumental` — sans parole, `autre` — personnalisé/non listé).
- `MUSIC_LANGUAGE_LABELS` — libellés d'affichage en français pour un `<select>`.
- `langSelectValue(lang?)` — normalise (trim + minuscule) et renvoie la valeur si connue, sinon `"autre"`, sinon `""` si vide. Sert à choisir la bonne option du `<select>`.
- `langCustomValue(lang?)` — renvoie le texte personnalisé uniquement si la valeur (normalisée) n'est **pas** une langue connue. Sert à peupler un champ « langue personnalisée » à côté du select.

Aucun schéma Zod `Language` n'est exporté ici — ce fichier est uniquement constantes/helpers.

---

## 7. `animator.ts` — comptes de direct

Représente un animateur pouvant démarrer une diffusion en direct.

**Constantes exportées :**
- `END_OF_STREAM_POLICIES` — `["CUT_STRICT_END", "CUT_AFTER_15min", "CUT_AFTER_5min", "NO_FORCE_CUT"]`.
- `STREAM_MODES` — `["RTMP", "SRT"]`.
- `SRT_ENCRYPTION_LEVELS` — `{ None: 0, "AES-128": 16, "AES-192": 24, "AES-256": 32 }` (libellé → taille de clé en octets).
- `DEFAULT_SECRET_SIZE = 56`.

**Schéma `Animator`** (seul fichier du module sans type `z.infer` exporté séparément) :

| Champ | Type | Rôle |
|---|---|---|
| `username` | regex `^[A-Za-z0-9_-]+$` | Sert d'identifiant de base de données |
| `allowed_modes` | `enum(STREAM_MODES)[]`, défaut `["SRT"]` | Modes de diffusion autorisés |
| `disabled_account` | `boolean`, défaut `false` | Compte désactivé |
| `allow_stream_outside_schedule` | `boolean`, défaut `false` | Peut diffuser même hors planning |
| `end_of_stream_policy` | `enum(...)`, défaut `"CUT_AFTER_5min"` | Comportement en fin de créneau |
| `srt_secret` / `rtmp_secret` | `string` 32-79 car., `.meta({sensitive:true})` | Secrets de connexion |
| `secret_last_rotated` | `iso.datetime()` | Dernière rotation |
| `last_streamed_at` | `iso.datetime()?` | Dernière diffusion |
| `srt_encryption_mode` | `enum(Object.keys(SRT_ENCRYPTION_LEVELS))` | Niveau de chiffrement SRT |
| `stream_title` | `string?` | Titre de flux |
| `created_at/updated_at`, `created_by/updated_by` | `?` | Audit |

Aucune fonction client dans ce fichier.

---

## 8. `playlist.ts` — playlists

- `PlaylistEditable` — `{name: string, musics: string[] (défaut [])}` — forme du payload de création/mise à jour (ids de musiques uniquement).
- `PlaylistBase` — `{id, name, author, updatedAt}` — métadonnées de vue liste.
- `FullPlaylist = PlaylistBase.extend({musics: {id, title, artist}[]})` — vue détail avec pistes dénormalisées.

**Fonctions client** (style front, `${API_BASE}/playlists...`) :

| Fonction | Appel | Particularité |
|---|---|---|
| `listPlaylists(token)` | `GET /playlists` | Chaque élément est validé individuellement contre `PlaylistBase.parse` ; un élément invalide est logué et silencieusement écarté plutôt que de faire échouer toute la liste |
| `getPlaylist(token, id)` | `GET /playlists/${id}` | — |
| `createPlaylist(token, data)` | `POST /playlists` | — |
| `patchPlaylist(token, id, data)` | `PATCH /playlists/${id}` | — |
| `deletePlaylist(token, id)` | `DELETE /playlists/${id}` | — |

---

## 9. Garanties testées

Seul fichier de test du module : `schedule.test.ts` (vitest). Deux suites :

**« contenu alternate »**
- Accepte une alternance mixant une source `playlist` et une source `media`.
- `take` vaut `1` par défaut si omis ; une valeur explicite (ex. `3`) est respectée.
- `take: 0` est refusé (`min(1)`) — une source qui ne prend jamais son tour bloquerait la rotation.
- Une alternance de moins de 2 sources est refusée (0 ou 1 source).
- Une alternance imbriquée (une source de type `alternate`) est refusée — impose la non-récursivité.
- Une source `live` dans une alternance est refusée.
- Les autres `kind` (ex. `playlist` simple) ne sont pas affectés par le champ `take`.

**« categorie VOD / Rediffusion »**
- `MediaCategory.options` contient `"vod"`.
- `SlotType.options` contient `"vod"`, et `SLOT_TYPES.vod` est **exactement** `{label: "VOD / Rediffusion", content_kind: "media", category: "vod", default_priority: 50}` — verrouille cette ligne de table contre toute dérive accidentelle.
- Un contenu `media` avec une piste de catégorie `vod` se parse correctement.

Aucun fichier de test n'existe pour `music.ts`, `playlist.ts`, `animator.ts`, `genres.ts` ou `languages.ts` **dans le module lui-même** — certains comportements (labels de catégorie, etc.) sont testés côté application consommatrice (ex. `admin-panel-front/src/lib/mediaCategoryLabels.test.ts`).

---

## 10. Couplage avec zod v4

Le module utilise des API introduites en Zod v4 : `z.iso.datetime()`, `z.iso.duration()`, `z.iso.time()`, `z.templateLiteral()`, `.meta()`. **Chaque dépôt parent doit avoir `zod ^4`** dans ses propres dépendances pour que ce code compile et s'exécute. Une évolution future de hen-types qui utiliserait une fonctionnalité encore plus récente de zod obligerait à faire monter la version de zod dans **les deux** dépôts parents simultanément — point de couplage à garder à l'esprit avant toute montée de version.

---

## 11. Bonnes pratiques pour faire évoluer ce module

1. **Toujours ajouter un test** dans `schedule.test.ts` (ou un futur fichier de test dédié) quand on ajoute une valeur d'enum ou une entrée de table (`SLOT_TYPES`, `MediaCategory`, etc.) — c'est ce qui a permis d'attraper toute dérive lors de l'ajout de la catégorie `vod`.
2. **Garder le module sans dépendance de build** : pas de `package.json`, pas d'étape de compilation — le code doit rester directement consommable tel quel par les deux parents.
3. **Vérifier la cohérence des deux pointeurs submodule** après un changement de schéma partagé : idéalement, front et backend doivent pointer vers le même commit hen-types peu de temps après un changement, pour éviter un contrat de données divergent entre les deux applications.
4. **Ne jamais renommer un champ sans grep exhaustif** dans les deux dépôts parents (l'import se fait par chemin, pas par un paquet versionné — aucun avertissement de dépréciation n'existera).
5. Toute nouvelle fonctionnalité touchant une **catégorie de média** ou un **type de créneau** doit toucher à la fois `music.ts`/`schedule.ts` ici, puis être répercutée dans les deux applications consommatrices (le reste du système est généralement déjà générique sur ces enums, comme observé lors de l'ajout de `vod`).
