import { describe, expect, it } from "vitest";
import { MediaCategory } from "./music";
import {
	AlternateSource,
	DEFAULT_SCHEDULE_TIMEZONE,
	expandEventOccurrences,
	FullSchedule,
	ScheduleContent,
	type ScheduleEvent,
	SLOT_TYPES,
	SlotType,
	zonedWallTimeToUtcMs,
} from "./schedule";

describe("contenu alternate", () => {
	const playlistSource = {
		kind: "playlist",
		playlist_id: "musics",
		random: false,
	};
	const mediaSource = {
		kind: "media",
		medias: [{ category: "jingles", media_id: "j1" }],
		random: false,
	};

	it("accepte une alternance playlist / liste de medias", () => {
		const parsed = ScheduleContent.parse({
			kind: "alternate",
			sources: [playlistSource, mediaSource],
		});

		expect(parsed.kind).toBe("alternate");
		if (parsed.kind !== "alternate") throw new Error("unreachable");
		expect(parsed.sources).toHaveLength(2);
	});

	it("met take a 1 par defaut", () => {
		// Le cas un-pour-un (musique, jingle, musique, jingle) n'a donc rien a
		// renseigner.
		const parsed = AlternateSource.parse(playlistSource);

		expect(parsed.take).toBe(1);
	});

	it("accepte un take explicite", () => {
		// Trois musiques puis un jingle.
		const parsed = AlternateSource.parse({ ...playlistSource, take: 3 });

		expect(parsed.take).toBe(3);
	});

	it("refuse un take de zero", () => {
		// Une source qui ne prend jamais son tour bloquerait la rotation.
		expect(() =>
			AlternateSource.parse({ ...playlistSource, take: 0 }),
		).toThrow();
	});

	it("refuse une alternance de moins de deux sources", () => {
		// Alterner avec une seule source, c'est juste cette source.
		expect(() =>
			ScheduleContent.parse({ kind: "alternate", sources: [playlistSource] }),
		).toThrow();
		expect(() =>
			ScheduleContent.parse({ kind: "alternate", sources: [] }),
		).toThrow();
	});

	it("n'accepte pas une alternance imbriquee", () => {
		// Volontairement non recursif.
		expect(() =>
			ScheduleContent.parse({
				kind: "alternate",
				sources: [
					playlistSource,
					{ kind: "alternate", sources: [playlistSource, mediaSource] },
				],
			}),
		).toThrow();
	});

	it("n'accepte pas un direct comme source", () => {
		expect(() =>
			ScheduleContent.parse({
				kind: "alternate",
				sources: [
					playlistSource,
					{ kind: "live", animator_id: "a", animator_label: "A" },
				],
			}),
		).toThrow();
	});

	it("laisse les autres kinds inchanges", () => {
		// Pas de take sur un creneau playlist simple : il joue sa playlist d'un
		// bout a l'autre, il n'a rien avec quoi alterner.
		const parsed = ScheduleContent.parse(playlistSource);

		expect(parsed.kind).toBe("playlist");
		expect("take" in parsed).toBe(false);
	});
});

describe("categorie VOD / Rediffusion", () => {
	it("existe dans MediaCategory", () => {
		expect(MediaCategory.options).toContain("vod");
	});

	it("a un slot_type dedie qui pre-filtre sur la categorie vod", () => {
		expect(SlotType.options).toContain("vod");
		expect(SLOT_TYPES.vod).toEqual({
			label: "VOD / Rediffusion",
			content_kind: "media",
			category: "vod",
			default_priority: 50,
		});
	});

	it("accepte un creneau media avec des pistes de la categorie vod", () => {
		const parsed = ScheduleContent.parse({
			kind: "media",
			medias: [{ category: "vod", media_id: "v1" }],
			random: false,
		});
		expect(parsed.kind).toBe("media");
	});
});

describe("fuseau horaire du planning", () => {
	const iso = (ms: number) => new Date(ms).toISOString();
	const wall = (y: number, mo: number, d: number, h: number, mi = 0) =>
		Date.UTC(y, mo - 1, d, h, mi);

	function liveEvent(
		days: string[],
		extra: Partial<ScheduleEvent["timing"]> = {},
	): ScheduleEvent {
		return {
			timing: {
				first_occurence: "2026-01-05T00:00:00.000Z",
				repeat_every_weeks: 1,
				days,
				...extra,
			},
			event_id: "e1",
			enabled: true,
			title: "Top 15",
			description: "",
			slot_type: "emission_live",
			duration: "PT1H",
			priority: 50,
			content: {
				kind: "live",
				animator_id: "spyrothebat",
				animator_label: "spyrothebat",
			},
			created_by: "u",
			created_at: "2026-01-01T00:00:00.000Z",
			updated_by: "u",
			updated_at: "2026-01-01T00:00:00.000Z",
		} as ScheduleEvent;
	}

	it("un document sans fuseau vaut Europe/Paris", () => {
		const parsed = FullSchedule.parse({ events: [] });
		expect(parsed.timezone).toBe(DEFAULT_SCHEDULE_TIMEZONE);
		expect(DEFAULT_SCHEDULE_TIMEZONE).toBe("Europe/Paris");
	});

	it("refuse un fuseau inconnu", () => {
		expect(
			FullSchedule.safeParse({ events: [], timezone: "Mars/Olympus" }).success,
		).toBe(false);
		expect(
			FullSchedule.safeParse({ events: [], timezone: "UTC" }).success,
		).toBe(true);
	});

	it("convertit une heure murale de Paris en UTC, heure d'hiver et d'ete", () => {
		expect(
			iso(zonedWallTimeToUtcMs(wall(2026, 11, 22, 18), "Europe/Paris")),
		).toBe("2026-11-22T17:00:00.000Z");
		expect(
			iso(zonedWallTimeToUtcMs(wall(2026, 7, 5, 18), "Europe/Paris")),
		).toBe("2026-07-05T16:00:00.000Z");
		expect(iso(zonedWallTimeToUtcMs(wall(2026, 7, 5, 18), "UTC"))).toBe(
			"2026-07-05T18:00:00.000Z",
		);
	});

	it("pousse une heure sautee (passage a l'heure d'ete) d'une heure", () => {
		// 29 mars 2026 : 02:00 -> 03:00 a Paris. 02:30 n'existe pas, on joue a 03:30.
		expect(
			iso(zonedWallTimeToUtcMs(wall(2026, 3, 29, 2, 30), "Europe/Paris")),
		).toBe("2026-03-29T01:30:00.000Z");
	});

	it("prend la premiere d'une heure doublee (passage a l'heure d'hiver)", () => {
		// 25 octobre 2026 : 03:00 -> 02:00 a Paris. 02:30 arrive deux fois.
		expect(
			iso(zonedWallTimeToUtcMs(wall(2026, 10, 25, 2, 30), "Europe/Paris")),
		).toBe("2026-10-25T00:30:00.000Z");
	});

	it("garde un creneau recurrent a la meme heure de Paris toute l'annee", () => {
		const e = liveEvent(["SUNDAY:18:00:00"]);
		const winter = expandEventOccurrences(
			e,
			"Europe/Paris",
			Date.parse("2026-11-22T00:00:00Z"),
			Date.parse("2026-11-23T00:00:00Z"),
		);
		expect(winter.map((o) => iso(o.startAt))).toEqual([
			"2026-11-22T17:00:00.000Z",
		]);
		expect(winter[0].endAt - winter[0].startAt).toBe(3_600_000);

		const summer = expandEventOccurrences(
			e,
			"Europe/Paris",
			Date.parse("2026-07-05T00:00:00Z"),
			Date.parse("2026-07-06T00:00:00Z"),
		);
		expect(summer.map((o) => iso(o.startAt))).toEqual([
			"2026-07-05T16:00:00.000Z",
		]);
	});

	it("rattache au bon jour un creneau dont l'heure UTC tombe la veille", () => {
		// Lundi 00:30 a Paris = dimanche 23:30 UTC.
		const out = expandEventOccurrences(
			liveEvent(["MONDAY:00:30:00"]),
			"Europe/Paris",
			Date.parse("2026-11-22T00:00:00Z"),
			Date.parse("2026-11-24T00:00:00Z"),
		);
		expect(out.map((o) => iso(o.startAt))).toEqual([
			"2026-11-22T23:30:00.000Z",
		]);
	});

	it("respecte le cycle d'une semaine sur deux, ancre sur first_occurence", () => {
		const e = liveEvent(["SATURDAY:18:00:00"], {
			first_occurence: "2026-11-09T00:00:00.000Z",
			repeat_every_weeks: 2,
		});
		const out = expandEventOccurrences(
			e,
			"Europe/Paris",
			Date.parse("2026-11-09T00:00:00Z"),
			Date.parse("2026-12-07T00:00:00Z"),
		);
		expect(out.map((o) => iso(o.startAt))).toEqual([
			"2026-11-14T17:00:00.000Z",
			"2026-11-28T17:00:00.000Z",
		]);
	});

	it("rend un creneau ponctuel tel quel (instant UTC)", () => {
		const e = {
			...liveEvent([]),
			timing: { date: "2026-11-22T17:00:00.000Z" },
		} as ScheduleEvent;
		const out = expandEventOccurrences(
			e,
			"Europe/Paris",
			Date.parse("2026-11-22T00:00:00Z"),
			Date.parse("2026-11-23T00:00:00Z"),
		);
		expect(out).toEqual([
			expect.objectContaining({
				source: "one_off",
				startAt: Date.parse("2026-11-22T17:00:00Z"),
			}),
		]);
	});
});
