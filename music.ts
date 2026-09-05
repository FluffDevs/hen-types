import z from "zod";

export const MediaCategory = z.enum(["musics", "jingles", "podcasts", "ads", "others"]);
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
