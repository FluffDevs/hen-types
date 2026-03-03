import z from "zod";

export const PlaylistEditable = z.object({
	name: z.string(),
	author: z.string(),
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

export async function listPlaylists(token: string): Promise<PlaylistBase[]> {
	const res = await fetch(`${process.env.API_BASE_URL}/playlists`, {
		mode: "cors",
		credentials: "include",
		cache: "no-cache",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
	});
	const data = z.object({ data: z.array(z.any()) }).parse(await res.json());
	if (!Array.isArray(data?.data)) {
		throw new Error("Invalid response format, expected an array");
	}
	return data.data.flatMap((item) => {
		try {
			return PlaylistBase.parse(item);
		} catch (e) {
			console.error("Failed to parse playlist metadata:", e);
			return [];
		}
	});
}

export async function getPlaylist(
	token: string,
	id: string,
): Promise<FullPlaylist> {
	const res = await fetch(`${process.env.API_BASE_URL}/playlists/${id}`, {
		mode: "cors",
		credentials: "include",
		cache: "no-cache",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
	});
	return FullPlaylist.parse(await res.json());
}

export async function createPlaylist(
	token: string,
	data: PlaylistEditable,
): Promise<FullPlaylist> {
	const res = await fetch(`${process.env.API_BASE_URL}/playlists`, {
		method: "POST",
		mode: "cors",
		credentials: "include",
		cache: "no-cache",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(data),
	});
	return FullPlaylist.parse(await res.json());
}

export async function patchPlaylist(
	token: string,
	id: string,
	data: Partial<PlaylistEditable>,
): Promise<FullPlaylist> {
	const res = await fetch(`${process.env.API_BASE_URL}/playlists/${id}`, {
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
	return FullPlaylist.parse(await res.json());
}

export async function deletePlaylist(token: string, id: string): Promise<void> {
	const res = await fetch(`${process.env.API_BASE_URL}/playlists/${id}`, {
		method: "DELETE",
		mode: "cors",
		credentials: "include",
		cache: "no-cache",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
	if (!res.ok) {
		throw new Error(`Failed to delete playlist with id ${id}`);
	}
}
