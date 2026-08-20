import z from "zod";

export const MediaKind = z.enum(["audio", "video"]);
export type MediaKind = z.infer<typeof MediaKind>;

export const Media = z.object({
	bucket: z.string(),
	key: z.string(),
	kind: MediaKind,
	contentType: z.string().optional(),
	durationSec: z.number().optional(),
});
export type Media = z.infer<typeof Media>;

const WeeklyPeriodCommon = {
	id: z.string(),
	enabled: z.boolean().default(true),
	/** ISO 8601 : 1 = lundi ... 7 = dimanche. */
	dayOfWeek: z.number().int().min(1).max(7),
	/** Heure locale "HH:mm" (voir ScheduleDocument.timezone). */
	startTime: z.string(),
	endTime: z.string(),
	title: z.string(),
	description: z.string().default(""),
	createdBy: z.string(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
};

export const MusiquePeriod = z.object({
	type: z.literal("musique"),
	...WeeklyPeriodCommon,
	playlistId: z.string(),
	/** Nom de la playlist dénormalisé, pour affichage sans lookup supplémentaire. */
	playlistName: z.string(),
});
export type MusiquePeriod = z.infer<typeof MusiquePeriod>;

export const EmissionRecurrentePeriod = z.object({
	type: z.literal("emission_recurrente"),
	...WeeklyPeriodCommon,
	hostUserId: z.string(),
	hostDisplayName: z.string(),
	/** true = direct (RTMP/SRT via /live/start côté awoo-queen), false = lecture de `media`. */
	live: z.boolean(),
	media: Media.nullable().optional(),
});
export type EmissionRecurrentePeriod = z.infer<typeof EmissionRecurrentePeriod>;

export const WeeklyPeriod = z.discriminatedUnion("type", [MusiquePeriod, EmissionRecurrentePeriod]);
export type WeeklyPeriod = z.infer<typeof WeeklyPeriod>;

export const OneOffEvent = z.object({
	id: z.string(),
	type: z.literal("emission_ponctuelle"),
	enabled: z.boolean().default(true),
	/** Date ISO absolue (pas rattachée à la grille Semaine A/B). */
	date: z.iso.date(),
	startTime: z.string(),
	endTime: z.string(),
	title: z.string(),
	description: z.string().default(""),
	hostUserId: z.string(),
	hostDisplayName: z.string(),
	live: z.boolean(),
	media: Media.nullable().optional(),
	createdBy: z.string(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
export type OneOffEvent = z.infer<typeof OneOffEvent>;

export const Weeks = z.object({
	A: z.array(WeeklyPeriod).default([]),
	B: z.array(WeeklyPeriod).default([]),
});
export type Weeks = z.infer<typeof Weeks>;

/**
 * Document unique décrivant toute la programmation de la radio (planning bi-hebdomadaire
 * Semaine A / Semaine B + émissions ponctuelles). Stocké tel quel en JSON sur S3 par awoo-queen,
 * remplacé en entier à chaque écriture (verrou optimiste via `version`).
 */
export const ScheduleDocument = z.object({
	version: z.number().int(),
	/** Fuseau horaire dans lequel TOUTES les heures de ce document doivent être interprétées. */
	timezone: z.string(),
	/** Date ISO (un lundi) marquant le début connu d'un cycle "Semaine A". */
	weekAnchor: z.iso.date(),
	updatedAt: z.iso.datetime(),
	updatedBy: z.string().default(""),
	/** Playlist diffusée quand aucun créneau ne correspond à l'instant présent. */
	defaultPlaylistId: z.string().nullable().optional(),
	weeks: Weeks,
	oneOffs: z.array(OneOffEvent).default([]),
});
export type ScheduleDocument = z.infer<typeof ScheduleDocument>;

export const MediaListItem = z.object({
	key: z.string(),
	size: z.number(),
	lastModified: z.string().optional(),
});
export type MediaListItem = z.infer<typeof MediaListItem>;

export async function getSchedule(): Promise<ScheduleDocument> {
	const res = await fetch("/api/programmations", { cache: "no-store" });
	if (!res.ok) {
		const payload = await res.json().catch(() => ({}));
		throw new Error(payload?.error ?? `Erreur ${res.status}`);
	}
	return ScheduleDocument.parse(await res.json());
}

export async function putSchedule(token: string, doc: ScheduleDocument): Promise<ScheduleDocument> {
	const res = await fetch("/api/programmations", {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(doc),
	});
	const payload = await res.json();
	if (!res.ok) {
		throw new Error(payload?.error ?? `Erreur ${res.status}`);
	}
	return ScheduleDocument.parse(payload);
}
