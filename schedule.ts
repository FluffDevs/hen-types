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
};

/**
 * The server will interpret ALL dates and time, for the whole Schedule, as UTC
 * The frontend / client is responsible to convert them to/from UTC on their side
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

export const FullSchedule = z.object({
	events: ScheduleEvent.array(),
	default_playlist_id: z.string().optional(),
});
export type FullSchedule = z.infer<typeof FullSchedule>;

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
