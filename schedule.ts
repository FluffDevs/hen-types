import { z } from "zod";
import { MediaCategory } from "./music";

export const WEEKDAYS = [
	"MONDAY",
	"TUESDAY",
	"WEDNESDAY",
	"THURSDAY",
	"FRIDAY",
	"SATURDAY",
	"SUNDAY",
];
export const Weekday = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof Weekday>;

/** 1 (lundi) ... 7 (dimanche) */
export function weekdayToIso(day: Weekday): number {
	return WEEKDAYS.indexOf(day) + 1;
}

export const DayOccurence = z.templateLiteral([
	Weekday,
	":",
	z.iso.time({ precision: 0 }),
]);
export type DayOccurence = z.infer<typeof DayOccurence>;

export function parseDayOccurence(occ: DayOccurence): {
	day: Weekday;
	isoDay: number;
	time: string;
} {
	const idx = occ.split(":");
	const day = Weekday.parse(idx.shift());
	const time = z.iso.time({ precision: 0 }).parse(idx.join(":"));
	return {
		day,
		isoDay: weekdayToIso(day),
		time,
	};
}

const PlaylistContent = z.object({
	kind: z.literal("playlist"),
	playlist_id: z.string().min(1),
	random: z.boolean().default(false),
	max_loop: z.number().int().min(1).optional(),
});

const MediaContent = z.object({
	kind: z.literal("media"),
	medias: z
		.object({
			category: MediaCategory,
			media_id: z.string().min(1),
		})
		.array()
		.min(1),
	random: z.boolean().default(false),
	max_loop: z.number().int().min(1).optional(),
});

/**
 * Une source d'un creneau "alternate". C'est une playlist ou une liste de medias,
 * plus `take`.
 *
 * Volontairement NON recursif : une alternance ne peut pas contenir une autre
 * alternance, et on ne prend pas une piste dans un direct. Garder le type plat
 * evite au modele, a l'editeur et au serveur de diffusion d'avoir a repondre a des
 * questions genantes sur l'imbrication.
 */
export const AlternateSource = z.discriminatedUnion("kind", [
	PlaylistContent.extend({
		/** Nombre d'elements joues d'affilee avant de passer a la source suivante. */
		take: z.number().int().min(1).default(1),
	}),
	MediaContent.extend({
		take: z.number().int().min(1).default(1),
	}),
]);
export type AlternateSource = z.infer<typeof AlternateSource>;

export const ScheduleContent = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("live"),
		animator_id: z.string(),
		animator_label: z.string(),
	}),
	PlaylistContent,
	MediaContent,
	/**
	 * Joue un tour de chaque source, en boucle : une musique, un jingle, une
	 * musique, un jingle.
	 *
	 * Chaque source garde sa propre position et son propre budget de boucles, donc
	 * l'epuisement de l'une n'arrete pas les autres : elle sort simplement de la
	 * rotation. Quand toutes sont epuisees, le creneau rend l'antenne a la priorite
	 * inferieure.
	 *
	 * `duration` reste la fenetre du creneau. Une alternance ne compte comme du
	 * travail fini (et donc rattrapable si elle demarre en retard) que si TOUTES
	 * ses sources ont un `max_loop` : une seule source sans limite et la rotation
	 * ne s'arrete jamais.
	 */
	z.object({
		kind: z.literal("alternate"),
		/** Au moins deux : alterner entre une seule source n'a pas de sens. */
		sources: AlternateSource.array().min(2),
	}),
]);
export type ScheduleContent = z.infer<typeof ScheduleContent>;

/**
 * Types de creneau proposes dans l'editeur. Chacun determine le `content.kind`
 * et pre-remplit une priorite par defaut (modifiable). Pour les types "media",
 * `genre` indique le genre de la mediatheque a pre-filtrer dans la recherche.
 */
export const SlotType = z.enum([
	"playlist",
	"playlist_alternee",
	"emission_live",
	"emission_rec",
	"habillage",
	"promo",
	"vod",
]);
export type SlotType = z.infer<typeof SlotType>;

export const SLOT_TYPES: Record<
	SlotType,
	{
		label: string;
		content_kind: "playlist" | "live" | "media" | "alternate";
		/** Genre de la mediatheque a pre-filtrer (types "media" uniquement). */
		category?: MediaCategory;
		default_priority: number;
	}
> = {
	playlist: {
		label: "Playlist",
		content_kind: "playlist",
		category: "musics",
		default_priority: 1,
	},
	playlist_alternee: {
		label: "Playlist alternée",
		content_kind: "alternate",
		category: "musics",
		default_priority: 1,
	},
	emission_live: {
		label: "Émission — direct",
		content_kind: "live",
		default_priority: 50,
	},
	emission_rec: {
		label: "Émission — préenregistrée",
		content_kind: "media",
		category: "podcasts",
		default_priority: 50,
	},
	habillage: {
		label: "Habillage / virgule",
		content_kind: "media",
		category: "jingles",
		default_priority: 25,
	},
	promo: {
		label: "Promotion",
		content_kind: "media",
		category: "ads",
		default_priority: 75,
	},
	vod: {
		label: "VOD / Rediffusion",
		content_kind: "media",
		category: "vod",
		default_priority: 50,
	},
};

/**
 * Fuseau de reference d'un planning qui n'en declare pas : celui dans lequel les
 * heures de `days` ont toujours ete saisies dans l'editeur.
 */
export const DEFAULT_SCHEDULE_TIMEZONE = "Europe/Paris";

/** Vrai si `tz` est un fuseau IANA connu du runtime (`Europe/Paris`, `UTC`...). */
export function isValidTimeZone(tz: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

export const ScheduleTimezone = z
	.string()
	.min(1)
	.refine(isValidTimeZone, { message: "Fuseau horaire IANA inconnu" });

/**
 * Heures et dates d'un evenement :
 * - recurrent : les heures de `days` sont des heures « murales » dans le fuseau
 *   du planning (`FullSchedule.timezone`). `"SUNDAY:18:00:00"` joue a 18:00 a
 *   Paris toute l'annee, heure d'ete comprise. `first_occurence` /
 *   `last_occurence` sont des instants UTC qui bornent les occurrences ; la date
 *   UTC de `first_occurence` fixe aussi la semaine d'ancrage du cycle.
 * - ponctuel : `date` est un instant UTC (avec `Z`).
 * `duration` est une duree reelle : un creneau de 2 h a cheval sur un changement
 * d'heure dure 2 h, meme si l'heure murale de fin parait decalee.
 */
export const ScheduleEvent = z.object({
	timing: z.union([
		z.object({
			first_occurence: z.iso.datetime(),
			last_occurence: z.iso.datetime().optional(),
			repeat_every_weeks: z.number().int().min(1),
			days: DayOccurence.array().min(1),
		}),
		z.object({
			date: z.iso.datetime(),
		}),
	]),
	event_id: z.string(),
	enabled: z.boolean().default(true),
	title: z.string(),
	description: z.string().default(""),
	slot_type: SlotType,
	duration: z.iso.duration(),
	priority: z.number().int().min(0).max(100).default(1),
	content: ScheduleContent,
	created_by: z.string(),
	created_at: z.iso.datetime(),
	updated_by: z.string(),
	updated_at: z.iso.datetime(),
});
export type ScheduleEvent = z.infer<typeof ScheduleEvent>;

/** Heure murale "HH:MM" (00:00 a 23:59). */
export const WallClockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
	message: "Heure attendue au format HH:MM",
});
export type WallClockTime = z.infer<typeof WallClockTime>;

/**
 * Plage quotidienne pendant laquelle les titres marques `explicit` ne doivent pas
 * etre diffuses (ex. 06:00 -> 22:00).
 *
 * - `from` et `to` sont des heures murales dans le fuseau du planning
 *   (`FullSchedule.timezone`), comme les heures de `days` : 06:00 reste 06:00 a
 *   Paris toute l'annee, heure d'ete comprise.
 * - La plage est semi-ouverte `[from, to)` : un titre qui demarre a 22:00 pile
 *   est autorise.
 * - `from > to` traverse minuit (22:00 -> 06:00 interdit la nuit).
 * - `from === to` est refuse : on ne saurait pas dire si c'est « toute la
 *   journee » ou « jamais ».
 * - `enabled: false` conserve les heures saisies sans rien restreindre.
 *
 * Le direct n'est pas concerne : le serveur de diffusion ne choisit pas ce qui
 * passe pendant un live.
 */
export const ExplicitRestriction = z
	.object({
		enabled: z.boolean().default(false),
		from: WallClockTime,
		to: WallClockTime,
	})
	.refine((r) => r.from !== r.to, {
		message: "Le debut et la fin de la plage doivent etre differents",
		path: ["to"],
	});
export type ExplicitRestriction = z.infer<typeof ExplicitRestriction>;

export const FullSchedule = z.object({
	events: ScheduleEvent.array(),
	default_playlist_id: z.string().optional(),
	/**
	 * Fuseau IANA dans lequel sont exprimees les heures des evenements
	 * recurrents. Absent des anciens documents : vaut alors
	 * `DEFAULT_SCHEDULE_TIMEZONE`, qui est le fuseau dans lequel elles ont ete
	 * saisies.
	 */
	timezone: ScheduleTimezone.default(DEFAULT_SCHEDULE_TIMEZONE),
	/**
	 * Plage horaire sans titres explicites (heures murales dans `timezone`).
	 * Absente : aucune restriction, ce qui est le comportement historique.
	 */
	explicit_restriction: ExplicitRestriction.optional(),
});
export type FullSchedule = z.infer<typeof FullSchedule>;

// --- Expansion des evenements en instants UTC --------------------------------

const DAY_MS = 86_400_000;

type RecurringTiming = Extract<
	ScheduleEvent["timing"],
	{ repeat_every_weeks: number }
>;

/** Discrimine les deux formes de `timing` (recurrent vs ponctuel). */
export function isRecurringTiming(
	timing: ScheduleEvent["timing"],
): timing is RecurringTiming {
	return "repeat_every_weeks" in timing;
}

/** "PT2H30M" / "P1DT2H" -> millisecondes. Ignore annees/mois (ambigus). */
export function parseIsoDurationMs(iso: string): number {
	const m =
		/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
			(iso ?? "").trim(),
		);
	if (!m) return 0;
	const [, w, d, h, min, s] = m;
	return (
		(Number(w ?? 0) * 7 * 24 * 3600 +
			Number(d ?? 0) * 24 * 3600 +
			Number(h ?? 0) * 3600 +
			Number(min ?? 0) * 60 +
			Number(s ?? 0)) *
		1000
	);
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** Decalage (ms) du fuseau `tz` par rapport a UTC a l'instant `utcMs`. */
export function timeZoneOffsetMs(utcMs: number, tz: string): number {
	let fmt = offsetFormatters.get(tz);
	if (!fmt) {
		fmt = new Intl.DateTimeFormat("en-US", {
			timeZone: tz,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		offsetFormatters.set(tz, fmt);
	}
	const p: Record<string, number> = {};
	for (const part of fmt.formatToParts(new Date(utcMs))) {
		if (part.type !== "literal") p[part.type] = Number(part.value);
	}
	const asUtc = Date.UTC(
		p.year,
		p.month - 1,
		p.day,
		p.hour === 24 ? 0 : p.hour,
		p.minute,
		p.second,
	);
	// Les millisecondes de `utcMs` ne sont pas dans `asUtc` : on les retire avant de comparer.
	return asUtc - (utcMs - (((utcMs % 1000) + 1000) % 1000));
}

/**
 * Instant UTC (ms) correspondant a l'heure murale `wallMs` dans `tz`. `wallMs`
 * est l'heure murale encodee comme si elle etait UTC (`Date.UTC(y, m, d, h, mi)`).
 *
 * Changements d'heure :
 * - heure qui n'existe pas (passage a l'heure d'ete, 02:30 a Paris) : decalee
 *   d'autant que le saut, donc 03:30 ;
 * - heure qui existe deux fois (passage a l'heure d'hiver) : la premiere.
 */
export function zonedWallTimeToUtcMs(wallMs: number, tz: string): number {
	// Un seul changement d'heure au plus autour de l'instant vise : les decalages
	// la veille et le lendemain encadrent les deux interpretations possibles.
	const before = timeZoneOffsetMs(wallMs - DAY_MS, tz);
	const after = timeZoneOffsetMs(wallMs + DAY_MS, tz);
	const candidates = [wallMs - before, wallMs - after].filter(
		(utc) => timeZoneOffsetMs(utc, tz) === wallMs - utc,
	);
	if (candidates.length > 0) return Math.min(...candidates);
	// Heure sautee : on garde le decalage d'avant le saut, ce qui la pousse en avant.
	return wallMs - before;
}

/** Jour (index depuis 1970-01-01) contenant `ms`, l'instant etant lu en UTC. */
function epochDay(ms: number): number {
	return Math.floor(ms / DAY_MS);
}

/** 1 = lundi ... 7 = dimanche (1970-01-01 = jeudi = iso 4). */
function isoWeekdayFromEpochDay(day: number): number {
	return ((((day + 3) % 7) + 7) % 7) + 1;
}

function mondayEpochDay(day: number): number {
	return day - (isoWeekdayFromEpochDay(day) - 1);
}

export type EventOccurrence = {
	event: ScheduleEvent;
	source: "recurring" | "one_off";
	/** Instant UTC (ms) de debut. */
	startAt: number;
	/** Instant UTC (ms) de fin (exclu). */
	endAt: number;
};

/**
 * Occurrences concretes [startAt, endAt) d'un evenement qui recoupent
 * [fromMs, toMs]. Ignore `enabled` : c'est a l'appelant de filtrer.
 *
 * Les heures de `days` sont lues dans `timezone` (voir `ScheduleEvent`). C'est la
 * reference partagee par le backend et le front ; awoo-queen applique les memes
 * regles en Rust (`api/schedule.rs`).
 */
export function expandEventOccurrences(
	event: ScheduleEvent,
	timezone: string,
	fromMs: number,
	toMs: number,
): EventOccurrence[] {
	const durationMs = parseIsoDurationMs(event.duration);
	if (durationMs <= 0) return [];

	if (!isRecurringTiming(event.timing)) {
		const startAt = new Date(event.timing.date).getTime();
		if (Number.isNaN(startAt)) return [];
		const endAt = startAt + durationMs;
		return endAt > fromMs && startAt < toMs
			? [{ event, source: "one_off", startAt, endAt }]
			: [];
	}

	const t = event.timing;
	const firstMs = new Date(t.first_occurence).getTime();
	const lastMs = t.last_occurence
		? new Date(t.last_occurence).getTime()
		: Number.POSITIVE_INFINITY;
	if (Number.isNaN(firstMs)) return [];
	const period = Math.max(1, t.repeat_every_weeks);
	const firstMonday = mondayEpochDay(epochDay(firstMs));
	const occurences = t.days.map((occ) => {
		const { isoDay, time } = parseDayOccurence(occ);
		const [h, m, s] = time.split(":").map(Number);
		return {
			isoDay,
			timeMs: ((h || 0) * 3600 + (m || 0) * 60 + (s || 0)) * 1000,
		};
	});

	// Jours muraux a parcourir : la marge de deux jours couvre le decalage du
	// fuseau (au plus +/-14 h) et un creneau commence la veille de `fromMs`.
	const out: EventOccurrence[] = [];
	for (let day = epochDay(fromMs) - 2; day <= epochDay(toMs) + 2; day++) {
		const weeksSince = (mondayEpochDay(day) - firstMonday) / 7;
		if (weeksSince < 0 || weeksSince % period !== 0) continue;
		const isoWeekday = isoWeekdayFromEpochDay(day);
		for (const occ of occurences) {
			if (occ.isoDay !== isoWeekday) continue;
			const startAt = zonedWallTimeToUtcMs(day * DAY_MS + occ.timeMs, timezone);
			if (startAt < firstMs || startAt > lastMs) continue;
			const endAt = startAt + durationMs;
			if (endAt > fromMs && startAt < toMs) {
				out.push({ event, source: "recurring", startAt, endAt });
			}
		}
	}
	return out;
}

// --- Restriction des titres explicites ---------------------------------------

/** "HH:MM" -> minutes depuis minuit. */
function wallClockMinutes(time: string): number {
	const [h, m] = time.split(":").map(Number);
	return (h || 0) * 60 + (m || 0);
}

/** Minute de la journee (0..1439) affichee par l'horloge murale de `tz` a `instantMs`. */
export function wallMinuteOfDay(instantMs: number, tz: string): number {
	const wall = instantMs + timeZoneOffsetMs(instantMs, tz);
	return Math.floor((((wall % DAY_MS) + DAY_MS) % DAY_MS) / 60_000);
}

/** Vrai si la minute murale `minute` tombe dans `[from, to)` (minuit gere). */
export function isInRestrictedWindow(
	restriction: Pick<ExplicitRestriction, "from" | "to">,
	minute: number,
): boolean {
	const from = wallClockMinutes(restriction.from);
	const to = wallClockMinutes(restriction.to);
	if (from === to) return false;
	return from < to
		? minute >= from && minute < to
		: minute >= from || minute < to;
}

/**
 * Un titre explicite peut-il demarrer a `instantMs` (instant UTC, ms) ?
 *
 * Vrai sans restriction, avec une restriction desactivee, ou hors de la plage
 * interdite lue dans le fuseau du planning. C'est la reference ; awoo-queen
 * applique la meme regle en Rust (`ExplicitRestriction` dans
 * `api/schedule.rs`) et, quand il connait la duree du titre, refuse aussi un
 * titre qui deborderait sur la plage.
 */
export function isExplicitAllowedAt(
	schedule: {
		explicit_restriction?: ExplicitRestriction;
		timezone?: string;
	},
	instantMs: number,
): boolean {
	const restriction = schedule.explicit_restriction;
	if (!restriction?.enabled) return true;
	const tz = schedule.timezone || DEFAULT_SCHEDULE_TIMEZONE;
	return !isInRestrictedWindow(restriction, wallMinuteOfDay(instantMs, tz));
}

export const ScheduleWithMetadata = FullSchedule.extend({
	version: z.string(),
	updated_by: z.string(),
	updated_at: z.iso.datetime(),
});
export type ScheduleWithMetadata = z.infer<typeof ScheduleWithMetadata>;

/**
 * Un creneau resolu a un instant donne, renvoye par `/now` et `/after`.
 * `content` porte TOUTES les infos (playlist / animateur / medias) selon `content.kind`.
 */
export const ResolvedSlot = z.object({
	event_id: z.string(),
	title: z.string(),
	description: z.string().default(""),
	slot_type: SlotType,
	/** Debut effectif, instant UTC ISO (DST resolue). */
	startAt: z.iso.datetime(),
	endAt: z.iso.datetime(),
	priority: z.number(),
	source: z.enum(["recurring", "one_off", "default"]),
	content: ScheduleContent,
});
export type ResolvedSlot = z.infer<typeof ResolvedSlot>;

// --- Helpers client (front) -------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// biome-ignore lint/suspicious/noExplicitAny: reponse JSON libre, validee ensuite par zod
type Json = any;

async function safeJson(res: Response): Promise<Json> {
	try {
		return await res.json();
	} catch {
		return {};
	}
}

export async function getSchedule(): Promise<ScheduleWithMetadata> {
	const res = await fetch("/api/programmations", { cache: "no-store" });
	if (!res.ok) {
		const payload = await safeJson(res);
		throw new Error(payload?.error ?? `Erreur ${res.status}`);
	}
	return ScheduleWithMetadata.parse(await res.json());
}

export type PutScheduleResult =
	| { ok: true; saved: ScheduleWithMetadata }
	| {
			ok: false;
			status: number;
			error: string;
			issues?: unknown;
			currentVersion?: string;
	  };

export async function putSchedule(
	token: string,
	doc: FullSchedule,
	baseVersion: string,
): Promise<PutScheduleResult> {
	const res = await fetch("/api/programmations", {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ ...doc, version: baseVersion }),
	});
	const payload = await safeJson(res);
	if (!res.ok) {
		return {
			ok: false,
			status: res.status,
			error: payload?.error ?? `Erreur ${res.status}`,
			issues: payload?.issues,
			currentVersion: payload?.currentVersion,
		};
	}
	return { ok: true, saved: ScheduleWithMetadata.parse(payload) };
}

export async function getResolvedNow(): Promise<ResolvedSlot | null> {
	const res = await fetch("/api/programmations/now", { cache: "no-store" });
	if (!res.ok) return null;
	const payload = await safeJson(res);
	return payload?.now ? ResolvedSlot.parse(payload.now) : null;
}

export async function getResolvedAfter(): Promise<ResolvedSlot | null> {
	const res = await fetch("/api/programmations/after", { cache: "no-store" });
	if (!res.ok) return null;
	const payload = await safeJson(res);
	return payload?.after ? ResolvedSlot.parse(payload.after) : null;
}
