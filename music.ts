import z from "zod";

/** S3 definition
 * Key: musics/{id}
 * ContentType: audio/*
 * Tags:
 * - page: number (as string) - the page where this music is listed
 *
 */

export const Music = z.object({
	id: z.string(),
	title: z.string(),
	artist: z.string(),
	album: z.string().optional(),
	genre: z.string().optional(),
	duration: z.iso.duration().optional(),
	year: z.coerce.number().optional(),
});
export type Music = z.infer<typeof Music>;

export interface MusicInt {
	id: string; // UUIDv7 - Partition Key
	title: string;
	artist: string;
	album: string;
	genre: string;
	duration: number; // in seconds
	fileName: string; // original file name
	s3Key: string; // S3 object key
	fileSize: number; // in bytes
	mimeType: string; // e.g., "audio/mpeg"
	createdAt: number; // Unix timestamp
	updatedAt: number; // Unix timestamp
}
