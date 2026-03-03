import z from "zod";

export const Playlist = z.object({
	id: z.string(),
	name: z.string(),
	author: z.string(),
	updatedAt: z.iso.datetime(),
	musics: z.array(
		z.object({
			id: z.string(),
			title: z.string(),
			artist: z.string(),
		}),
	),
});

export type Playlist = z.infer<typeof Playlist>;
