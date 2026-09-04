import z from "zod";

export const PlaylistEditable = z.object({
	name: z.string(),
	musics: z.array(z.string()).default([]),
});
export type PlaylistEditable = z.infer<typeof PlaylistEditable>;

export const PlaylistBase = z.object({
	id: z.string(),
	name: z.string(),
	author: z.string(),
	updatedAt: z.iso.datetime(),
});
export type PlaylistBase = z.infer<typeof PlaylistBase>;

export const FullPlaylist = PlaylistBase.extend({
	musics: z.array(
		z.object({
			id: z.string(),
			title: z.string(),
			artist: z.string(),
		}),
	),
});
export type FullPlaylist = z.infer<typeof FullPlaylist>;
