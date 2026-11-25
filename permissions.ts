/**
 * Catalogue des droits Fluff Radio (groupes Cognito) et helpers purs.
 *
 * Regles (specification validee par le responsable) :
 * - un groupe Cognito = un droit, au format `page:action` (ou
 *   `page:action:categorie` pour les medias) ;
 * - les droits sont totalement independants : aucun n'en implique un autre
 *   (avoir `uploads:delete:musics` ne donne PAS `uploads:read:musics`) ;
 * - `admin:all` donne tout, pages presentes et futures ;
 * - les groupes `team:*` ne donnent aucun droit (appartenance seulement) ;
 * - pendant la transition, les anciens groupes (`admins`, `StaffRadio`...)
 *   restent acceptes via `LEGACY_GROUP_MIGRATION` (option `legacyAliases`).
 *
 * Ce module est partage par le backend (`src/models/permissions`) et le front
 * (`#/hen-types/permissions`). Il ne fait aucun appel reseau.
 */
import { MediaCategory } from "./music";

/** Acces total, toutes pages et actions, presentes et futures. */
export const ADMIN_ALL = "admin:all" as const;
export type AdminAll = typeof ADMIN_ALL;

export const MEDIA_CATEGORIES = MediaCategory.options;

/** Libelles FR des categories, alignes sur le front (`mediaCategoryLabels`). */
export const MEDIA_CATEGORY_LABELS: Record<MediaCategory, string> = {
	musics: "Musiques",
	jingles: "Jingles / habillage",
	podcasts: "Podcasts / préenregistrés",
	ads: "Promos / publicités",
	vod: "VOD / Rediffusions",
	others: "Autres",
};

export type PermissionAction = "read" | "create" | "update" | "delete";

export const ACTION_LABELS: Record<PermissionAction, string> = {
	read: "Lire",
	create: "Créer",
	update: "Modifier",
	delete: "Supprimer",
};

const CRUD = ["read", "create", "update", "delete"] as const;
type Crud = (typeof CRUD)[number];

/** Tous les droits du catalogue, sous forme de type litteral. */
export type Permission =
	| "dashboard:read"
	| `library:read:${MediaCategory}`
	| `uploads:${Crud}:${MediaCategory}`
	| `playlists:${Crud}`
	| `schedule:${Crud}`
	| `branding:${Crud}`
	| `music-validation:${"read" | "update"}`
	| `streamers:${Crud}`
	| `my-live:${"read" | "update"}`
	| "live-stats:read"
	| "play-history:read"
	| `monitoring:${"read" | "update"}`
	| `audio-console:${"read" | "update"}`
	| "debug-api:read"
	| `cache:${"read" | "delete"}`;

export type PageSlug =
	| "dashboard"
	| "library"
	| "uploads"
	| "playlists"
	| "schedule"
	| "branding"
	| "music-validation"
	| "streamers"
	| "my-live"
	| "live-stats"
	| "play-history"
	| "monitoring"
	| "audio-console"
	| "debug-api"
	| "cache";

export type PageDefinition = {
	slug: PageSlug;
	/** Libelle FR affiche dans la page Gestion des droits. */
	label: string;
	description: string;
	actions: readonly PermissionAction[];
	/** Vrai : un 3e segment `:categorie` par categorie de media. */
	byCategory: boolean;
};

/** Le catalogue, dans l'ordre d'affichage. */
export const PERMISSION_PAGES: readonly PageDefinition[] = [
	{
		slug: "dashboard",
		label: "Accueil",
		description: "Page d'accueil du panel.",
		actions: ["read"],
		byCategory: false,
	},
	{
		slug: "library",
		label: "Médiathèque",
		description: "Écouter, chercher et télécharger les médias.",
		actions: ["read"],
		byCategory: true,
	},
	{
		slug: "uploads",
		label: "Fichiers audio",
		description: "Envoyer, modifier et supprimer des fichiers, par catégorie.",
		actions: CRUD,
		byCategory: true,
	},
	{
		slug: "playlists",
		label: "Playlists",
		description: "Playlists de diffusion.",
		actions: CRUD,
		byCategory: false,
	},
	{
		slug: "schedule",
		label: "Programmations",
		description:
			"Planning de diffusion (la restauration d'une sauvegarde est une modification).",
		actions: CRUD,
		byCategory: false,
	},
	{
		slug: "branding",
		label: "Habillage d'antenne",
		description:
			"Jingles / habillage (la lecture inclut l'écoute et le téléchargement).",
		actions: CRUD,
		byCategory: false,
	},
	{
		slug: "music-validation",
		label: "Validation musiques",
		description: "Compléter et valider les fiches des titres envoyés.",
		actions: ["read", "update"],
		byCategory: false,
	},
	{
		slug: "streamers",
		label: "Streamers",
		description: "Toutes les fiches animateurs et leurs lives.",
		actions: CRUD,
		byCategory: false,
	},
	{
		slug: "my-live",
		label: "Mon live",
		description:
			"Sa propre fiche, son lien de stream, le titre Twitch pendant son créneau, ses stats.",
		actions: ["read", "update"],
		byCategory: false,
	},
	{
		slug: "live-stats",
		label: "Statistiques des lives",
		description: "Statistiques des lives de tous les streamers.",
		actions: ["read"],
		byCategory: false,
	},
	{
		slug: "play-history",
		label: "Historique de diffusion",
		description: "Historique de diffusion et exports SACEM.",
		actions: ["read"],
		byCategory: false,
	},
	{
		slug: "monitoring",
		label: "Supervision",
		description:
			"Statut awoo-queen, métriques (lecture) et contrôles comme le skip (modification).",
		actions: ["read", "update"],
		byCategory: false,
	},
	{
		slug: "audio-console",
		label: "Réglage du son",
		description: "Console de réglage audio.",
		actions: ["read", "update"],
		byCategory: false,
	},
	{
		slug: "debug-api",
		label: "Debug API",
		description: "Console de test des routes du backend.",
		actions: ["read"],
		byCategory: false,
	},
	{
		slug: "cache",
		label: "Cache S3",
		description: "Données brutes du cache des médias.",
		actions: ["read", "delete"],
		byCategory: false,
	},
];

export type TeamGroup =
	| "team:radiovolunteer"
	| "team:associate"
	| "team:streamer";

/** Groupes d'appartenance : AUCUN droit, ils identifient les personnes. */
export const TEAM_GROUPS: readonly {
	name: TeamGroup;
	label: string;
	description: string;
}[] = [
	{
		name: "team:radiovolunteer",
		label: "Bénévoles de la radio",
		description: "Bénévoles de la radio (aucun droit).",
	},
	{
		name: "team:associate",
		label: "Membres de l'association",
		description: "Membres de l'association (aucun droit).",
	},
	{
		name: "team:streamer",
		label: "Streamers",
		description:
			"Personnes qui streament ; proposées à la création d'une fiche animateur (aucun droit).",
	},
];

/** Groupes connus hors refonte : affiches, jamais modifies par le panel. */
export const EXTERNAL_GROUPS: readonly { name: string; label: string }[] = [
	{ name: "gestionconvsfur", label: "Gestion des conventions (externe)" },
];

/** Tout groupe gere par le catalogue (droits + admin:all + team). */
export type CatalogGroup = AdminAll | Permission | TeamGroup;

export type LegacyGroup =
	| "admins"
	| "StaffRadio"
	| "AccesMediatheque"
	| "UploaderRadio"
	| "GestionPlaylist"
	| "ProgrammeursRadio"
	| "AccesAuxStatus"
	| "Streamers";

const categoryPermissions = <P extends string>(
	prefix: P,
): `${P}:${MediaCategory}`[] =>
	MEDIA_CATEGORIES.map((c) => `${prefix}:${c}` as const);

/**
 * Correspondances validees anciens -> nouveaux groupes. Sert a la fois :
 * - d'alias pendant la transition (un ancien groupe donne les nouveaux droits) ;
 * - de plan de migration (ajout des membres dans les nouveaux groupes).
 *
 * Avant la refonte, la page Accueil etait ouverte a tous les anciens groupes
 * (`ALL_STAFF_GROUPS` du front) : chacun donne donc `dashboard:read`.
 * `admins` n'en a pas besoin, `admin:all` donne tout.
 */
export const LEGACY_GROUP_MIGRATION: Readonly<
	Record<LegacyGroup, readonly CatalogGroup[]>
> = {
	admins: [ADMIN_ALL],
	StaffRadio: ["dashboard:read", "team:radiovolunteer"],
	AccesMediatheque: ["dashboard:read", ...categoryPermissions("library:read")],
	UploaderRadio: [
		"dashboard:read",
		"uploads:read:musics",
		"uploads:create:musics",
	],
	GestionPlaylist: [
		"dashboard:read",
		"playlists:read",
		"playlists:create",
		"playlists:update",
		"playlists:delete",
	],
	ProgrammeursRadio: [
		"dashboard:read",
		"schedule:read",
		"schedule:create",
		"schedule:update",
		"schedule:delete",
		"branding:read",
		"branding:create",
		"branding:update",
		"branding:delete",
		// `/api/streaming/awoo-control` (skip...) etait ouvert a ProgrammeursRadio.
		"monitoring:read",
		"monitoring:update",
	],
	AccesAuxStatus: ["dashboard:read", "monitoring:read"],
	Streamers: [
		"dashboard:read",
		"my-live:read",
		"my-live:update",
		"branding:read",
		"team:streamer",
	],
};

export const LEGACY_GROUPS = Object.keys(
	LEGACY_GROUP_MIGRATION,
) as LegacyGroup[];

export type PermissionOptions = {
	/**
	 * Accepter les anciens groupes comme alias (periode de transition).
	 * Defaut : true. A passer a false une fois les anciens groupes supprimes.
	 */
	legacyAliases?: boolean;
};

function buildCatalog(): Permission[] {
	const out: string[] = [];
	for (const page of PERMISSION_PAGES) {
		for (const action of page.actions) {
			if (page.byCategory) {
				for (const category of MEDIA_CATEGORIES) {
					out.push(`${page.slug}:${action}:${category}`);
				}
			} else {
				out.push(`${page.slug}:${action}`);
			}
		}
	}
	return out as Permission[];
}

const CATALOG: readonly Permission[] = Object.freeze(buildCatalog());
const CATALOG_SET: ReadonlySet<string> = new Set(CATALOG);
const TEAM_SET: ReadonlySet<string> = new Set(TEAM_GROUPS.map((t) => t.name));
const EXTERNAL_SET: ReadonlySet<string> = new Set(
	EXTERNAL_GROUPS.map((e) => e.name),
);
const LEGACY_SET: ReadonlySet<string> = new Set(LEGACY_GROUPS);

/** Tous les droits du catalogue (sans `admin:all` ni `team:*`). */
export function allPermissions(): Permission[] {
	return [...CATALOG];
}

/** Tous les groupes a creer dans Cognito : `admin:all`, droits, `team:*`. */
export function allCatalogGroups(): CatalogGroup[] {
	return [ADMIN_ALL, ...CATALOG, ...TEAM_GROUPS.map((t) => t.name)];
}

export function isPermission(value: string): value is Permission {
	return CATALOG_SET.has(value);
}

export function isTeamGroup(value: string): value is TeamGroup {
	return TEAM_SET.has(value);
}

export function isLegacyGroup(value: string): value is LegacyGroup {
	return LEGACY_SET.has(value);
}

export function isCatalogGroup(value: string): value is CatalogGroup {
	return value === ADMIN_ALL || CATALOG_SET.has(value) || TEAM_SET.has(value);
}

export type GroupKind =
	| "admin"
	| "permission"
	| "team"
	| "legacy"
	| "external"
	| "unknown";

/**
 * Nature d'un groupe Cognito. `external` et `unknown` sont affiches « non
 * geres » et ne sont jamais modifies ni supprimes automatiquement.
 */
export function classifyGroup(name: string): GroupKind {
	if (name === ADMIN_ALL) return "admin";
	if (CATALOG_SET.has(name)) return "permission";
	if (TEAM_SET.has(name)) return "team";
	if (LEGACY_SET.has(name)) return "legacy";
	if (EXTERNAL_SET.has(name)) return "external";
	return "unknown";
}

export type ParsedPermission = {
	page: PageSlug;
	action: PermissionAction;
	category?: MediaCategory;
};

export function parsePermission(value: string): ParsedPermission | null {
	if (!isPermission(value)) return null;
	const [page, action, category] = value.split(":");
	return {
		page: page as PageSlug,
		action: action as PermissionAction,
		...(category ? { category: category as MediaCategory } : {}),
	};
}

export function pageDefinition(slug: PageSlug): PageDefinition {
	const page = PERMISSION_PAGES.find((p) => p.slug === slug);
	if (!page) throw new Error(`Unknown permission page ${slug}`);
	return page;
}

/** « Fichiers audio — Créer — Musiques », pour l'affichage et le journal. */
export function permissionLabel(value: string): string {
	if (value === ADMIN_ALL) return "Accès total (admin:all)";
	const team = TEAM_GROUPS.find((t) => t.name === value);
	if (team) return `Équipe — ${team.label}`;
	const parsed = parsePermission(value);
	if (!parsed) return value;
	const parts = [
		pageDefinition(parsed.page).label,
		ACTION_LABELS[parsed.action],
	];
	if (parsed.category) parts.push(MEDIA_CATEGORY_LABELS[parsed.category]);
	return parts.join(" — ");
}

/** Description posee sur le groupe Cognito a sa creation (max 2048 car.). */
export function catalogGroupDescription(name: CatalogGroup): string {
	if (name === ADMIN_ALL) {
		return "Fluff Radio : accès total à toutes les pages et actions, présentes et futures.";
	}
	const team = TEAM_GROUPS.find((t) => t.name === name);
	if (team) return `Fluff Radio : ${team.description}`;
	return `Fluff Radio : ${permissionLabel(name)}`;
}

/**
 * Groupes effectifs : les groupes du jeton, plus (si les alias sont actifs)
 * les nouveaux groupes que donnent les anciens.
 */
export function effectiveGroups(
	groups: readonly string[] | null | undefined,
	options: PermissionOptions = {},
): Set<string> {
	const legacy = options.legacyAliases ?? true;
	const out = new Set<string>();
	for (const group of groups ?? []) {
		if (typeof group !== "string") continue;
		out.add(group);
		if (legacy && isLegacyGroup(group)) {
			for (const mapped of LEGACY_GROUP_MIGRATION[group]) out.add(mapped);
		}
	}
	return out;
}

export function isAdmin(
	groups: readonly string[] | null | undefined,
	options: PermissionOptions = {},
): boolean {
	return effectiveGroups(groups, options).has(ADMIN_ALL);
}

/**
 * Vrai si les groupes donnent ce droit. `admin:all` donne tout ; aucun autre
 * droit n'en implique un autre. `hasPermission(groups, "admin:all")` teste
 * l'acces total seul.
 */
export function hasPermission(
	groups: readonly string[] | null | undefined,
	permission: Permission | AdminAll,
	options: PermissionOptions = {},
): boolean {
	const effective = effectiveGroups(groups, options);
	return effective.has(ADMIN_ALL) || effective.has(permission);
}

/** Vrai si au moins un des droits est accorde (liste vide : faux, sauf admin). */
export function hasAnyPermission(
	groups: readonly string[] | null | undefined,
	permissions: readonly (Permission | AdminAll)[],
	options: PermissionOptions = {},
): boolean {
	const effective = effectiveGroups(groups, options);
	if (effective.has(ADMIN_ALL)) return true;
	return permissions.some((p) => effective.has(p));
}

/**
 * Droits effectifs, tries dans l'ordre du catalogue. `admin:all` est developpe
 * en tout le catalogue actuel (l'acces aux pages futures se teste avec
 * `hasPermission`).
 */
export function permissionsOf(
	groups: readonly string[] | null | undefined,
	options: PermissionOptions = {},
): Permission[] {
	const effective = effectiveGroups(groups, options);
	if (effective.has(ADMIN_ALL)) return allPermissions();
	return CATALOG.filter((p) => effective.has(p));
}

export type LegacyMigrationPlan = {
	/** Anciens groupes portes par l'utilisateur. */
	legacy: LegacyGroup[];
	/** Nouveaux groupes a ajouter (deja presents exclus), ordre du catalogue. */
	add: CatalogGroup[];
	/** Nouveaux groupes deja presents (rien a faire). */
	alreadyPresent: CatalogGroup[];
};

/** Ce que la migration doit ajouter a un utilisateur, d'apres ses groupes. */
export function legacyMigrationPlan(
	userGroups: readonly string[],
): LegacyMigrationPlan {
	const current = new Set(userGroups);
	const legacy = LEGACY_GROUPS.filter((g) => current.has(g));
	const target = new Set<string>();
	for (const group of legacy) {
		for (const mapped of LEGACY_GROUP_MIGRATION[group]) target.add(mapped);
	}
	const ordered = allCatalogGroups().filter((g) => target.has(g));
	return {
		legacy,
		add: ordered.filter((g) => !current.has(g)),
		alreadyPresent: ordered.filter((g) => current.has(g)),
	};
}

/**
 * Usage d'une route media :
 * - `list` : liste et metadonnees, sans lien de telechargement ;
 * - `download` : ecoute / telechargement (fichier ou identifiants S3) ;
 * - `create` / `update` / `delete` : envoi, metadonnees, suppression.
 */
export type MediaAccess = "list" | "download" | "create" | "update" | "delete";

/**
 * Droits qui ouvrent un usage media pour une categorie. Une route media sert
 * plusieurs pages, d'ou plusieurs droits possibles (un seul suffit) :
 * - Mediatheque (`library:read:<cat>`) et Fichiers audio (`uploads:*:<cat>`) ;
 * - Habillage d'antenne (`branding:*`) pour la categorie `jingles` ;
 * - Validation musiques (`music-validation:*`) pour `musics` ;
 * - Programmations (`schedule:read`) et Playlists (`playlists:read`, `musics`)
 *   en liste seulement : ces pages doivent nommer les medias qu'elles
 *   referencent, sans pouvoir les ecouter ni les telecharger.
 */
export function mediaPermissions(
	access: MediaAccess,
	category: MediaCategory,
): Permission[] {
	const out: Permission[] = [];
	switch (access) {
		case "list":
			out.push(`library:read:${category}`, `uploads:read:${category}`);
			out.push("schedule:read");
			if (category === "musics") {
				out.push("playlists:read", "music-validation:read");
			}
			if (category === "jingles") out.push("branding:read");
			break;
		case "download":
			out.push(`library:read:${category}`, `uploads:read:${category}`);
			if (category === "musics") out.push("music-validation:read");
			if (category === "jingles") out.push("branding:read");
			break;
		case "create":
			out.push(`uploads:create:${category}`);
			if (category === "jingles") out.push("branding:create");
			break;
		case "update":
			out.push(`uploads:update:${category}`);
			if (category === "musics") out.push("music-validation:update");
			if (category === "jingles") out.push("branding:update");
			break;
		case "delete":
			out.push(`uploads:delete:${category}`);
			if (category === "jingles") out.push("branding:delete");
			break;
	}
	return out;
}

export function canAccessMedia(
	groups: readonly string[] | null | undefined,
	access: MediaAccess,
	category: MediaCategory,
	options: PermissionOptions = {},
): boolean {
	return hasAnyPermission(groups, mediaPermissions(access, category), options);
}

/** Categories pour lesquelles l'usage est ouvert. */
export function mediaCategoriesFor(
	groups: readonly string[] | null | undefined,
	access: MediaAccess,
	options: PermissionOptions = {},
): MediaCategory[] {
	return MEDIA_CATEGORIES.filter((c) =>
		canAccessMedia(groups, access, c, options),
	);
}
