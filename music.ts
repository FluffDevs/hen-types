import z from "zod";

export const MediaCategory = z.enum([
	"musics",
	"jingles",
	"podcasts",
	"ads",
	"vod",
	"others",
]);
export type MediaCategory = z.infer<typeof MediaCategory>;

// Stored to S3 tags, maximum 10 pers objects, max 256 bytes per value, UTF-16 stored
export const MusicTags = z.object({
	hint: z.string().meta({
		description: "Represent title and artist for human control in S3",
	}),
	page: z.string().optional(),
	validated_admin: z.boolean().default(false),
});
export type MusicTags = z.infer<typeof MusicTags>;

/**
 * Plancher de `lufs` : un fichier mesure mais silencieux (aucun bloc au-dessus
 * de la porte absolue de -70 LUFS de la BS.1770, donc `-Infinity` pour le
 * mesureur) est enregistre a cette valeur. Elle veut dire « mesure, silencieux »,
 * a ne pas confondre avec `undefined` (« pas encore mesure »).
 */
export const LUFS_SILENCE_FLOOR = -70;
/** Plancher de `true_peak`, meme principe (silence numerique : `-Infinity`). */
export const TRUE_PEAK_FLOOR = -100;

/** Vrai si la mesure dit « silencieux » (`lufs` au plancher). */
export function isSilentLoudness(lufs: number | undefined): boolean {
	return lufs !== undefined && lufs <= LUFS_SILENCE_FLOOR;
}

/**
 * Ramene un silence mesure au plancher au lieu de le perdre : `-Infinity`,
 * `null` (ce que devient `-Infinity` une fois passe par JSON) et toute valeur
 * sous le plancher. `undefined` (non mesure) et les valeurs invalides (`NaN`,
 * texte...) ne sont pas touches : `undefined` reste absent, l'invalide est
 * rattrape par `.catch(undefined)`.
 */
const silenceToFloor = (floor: number) => (value: unknown) =>
	value === null || (typeof value === "number" && value < floor)
		? floor
		: value;

// Stored to S3 Annotation, support up to 1 Mo, stored as UTF-8 JSON encoded
export const MusicMetadata = z.object({
	title: z.string(),
	artist: z.string(),
	album: z.string().optional(),
	genre: z.string().optional(),
	duration: z.iso.duration().optional(),
	year: z.coerce.number().optional(),
	explicit: z.boolean().default(false),
	lang: z.string().optional(),
	furry: z.boolean().default(false),
	cue_in: z.coerce.number().optional(),
	cue_out: z.coerce.number().optional(),
	sacem_registry: z.string().optional(),
	// Measured from the file by the backend (ITU-R BS.1770-4 / EBU R128), never
	// typed by hand. Absent until measured, and for files that cannot be decoded.
	// A silent file is measured: it is stored at the floor (LUFS_SILENCE_FLOOR /
	// TRUE_PEAK_FLOOR), and -Infinity / null / anything below the floor is read
	// back as the floor, never as "not measured".
	// `.catch(undefined)`: a broken value costs the measure, never the whole
	// record (an unparsable record is dropped from the listing pages).
	lufs: z
		.preprocess(
			silenceToFloor(LUFS_SILENCE_FLOOR),
			z.number().min(LUFS_SILENCE_FLOOR).max(10),
		)
		.optional()
		.catch(undefined)
		.meta({
			description:
				"Integrated loudness of the file, in LUFS (-70 = measured, silent)",
		}),
	true_peak: z
		.preprocess(
			silenceToFloor(TRUE_PEAK_FLOOR),
			z.number().min(TRUE_PEAK_FLOOR).max(30),
		)
		.optional()
		.catch(undefined)
		.meta({
			description:
				"Maximum true peak of the file (4x oversampled), in dBTP (-100 = digital silence)",
		}),
});
export type MusicMetadata = z.infer<typeof MusicMetadata>;

export const Music = MusicMetadata.extend({
	id: z.string(),
}).extend(MusicTags.omit({ hint: true }).shape);
export type Music = z.infer<typeof Music>;

export const MusicsList = z.object({
	musics: z.array(Music),
	metadata: z.object({
		page: z.number(),
		total_pages: z.number(),
		per_page: z.number(),
	}),
});
export type MusicsList = z.infer<typeof MusicsList>;

export async function listMusics(
	token: string,
	page: number = 0,
): Promise<MusicsList> {
	const res = await fetch(
		`${process.env.API_BASE_URL}/media/musics?page=${page}`,
		{
			mode: "cors",
			credentials: "include",
			cache: "no-cache",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
		},
	);
	return MusicsList.parse(await res.json());
}

export async function getMusicData(token: string, id: string): Promise<Music> {
	const res = await fetch(`${process.env.API_BASE_URL}/media/musics/${id}`, {
		mode: "cors",
		credentials: "include",
		cache: "no-cache",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
	});
	return Music.parse(await res.json());
}

export async function downloadMusic(token: string, id: string): Promise<Blob> {
	const res = await fetch(
		`${process.env.API_BASE_URL}/media/musics/${id}/download`,
		{
			mode: "cors",
			credentials: "include",
			cache: "no-cache",
			headers: {
				Authorization: `Bearer ${token}`,
			},
		},
	);
	if (!res.ok) {
		throw new Error(`Failed to download music with id ${id}`);
	}
	return await res.blob();
}

export async function deleteMusic(token: string, id: string): Promise<void> {
	const res = await fetch(`${process.env.API_BASE_URL}/media/musics/${id}`, {
		method: "DELETE",
		mode: "cors",
		credentials: "include",
		cache: "no-cache",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
	if (!res.ok) {
		throw new Error(`Failed to delete music with id ${id}`);
	}
}

export async function patchMusic(
	token: string,
	id: string,
	data: Partial<MusicMetadata>,
): Promise<Music> {
	const res = await fetch(`${process.env.API_BASE_URL}/media/musics/${id}`, {
		method: "PATCH",
		mode: "cors",
		credentials: "include",
		cache: "no-cache",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(data),
	});
	if (!res.ok) {
		throw new Error(`Failed to patch music with id ${id}`);
	}
	return Music.parse(await res.json());
}

// uploadMusic require file management, not handled here
