import { z } from "zod";
import { MediaCategory } from "./music";

export const DayOccurence = z.templateLiteral([
	z.enum([
		"MONDAY",
		"TUESDAY",
		"WEDNESDAY",
		"THURSDAY",
		"FRIDAY",
		"SATURDAY",
		"SUNDAY",
	]),
	":",
	z.iso.time({ precision: 0 }),
]);
export type DayOccurence = z.infer<typeof DayOccurence>;

export const ScheduleEvent = z.object({
	timing: z.union([
		z.object({
			first_occurence: z.iso.datetime(),
			last_occurence: z.iso.datetime().optional(),
			repeat_every_weeks: z.number().min(1),
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
	duration: z.iso.duration(),
	priority: z.number().min(0).max(100),
	content: z.discriminatedUnion("kind", [
		z.object({
			kind: z.literal("live"),
			animator_id: z.string(),
			animator_label: z.string(),
		}),
		z.object({
			kind: z.literal("playlist"),
			playlist_id: z.string().min(1),
			random: z.boolean(),
			max_loop: z.number().min(1).optional(),
		}),
		z.object({
			kind: z.literal("media"),
			medias: z
				.object({
					category: MediaCategory,
					media_id: z.string().min(1),
				})
				.array()
				.min(1),
			random: z.boolean(),
			max_loop: z.number().min(1).optional(),
		}),
	]),
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

export async function getSchedule(): Promise<ScheduleWithMetadata> {
	const res = await fetch("/api/programmations", { cache: "no-store" });
	if (!res.ok) {
		const payload = await res.json().catch(() => ({}));
		throw new Error(payload?.error ?? `Erreur ${res.status}`);
	}
	return ScheduleWithMetadata.parse(await res.json());
}

export async function putSchedule(
	token: string,
	doc: FullSchedule,
): Promise<ScheduleWithMetadata> {
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
	return ScheduleWithMetadata.parse(payload);
}
