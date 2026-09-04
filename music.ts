import z from "zod";

export const MediaCategory = z.enum(["musics", "jingles", "podcasts", "ads"]);
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
