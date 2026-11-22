import { describe, expect, it } from "vitest";
import { MediaCategory } from "./music";
import {
	AlternateSource,
	DEFAULT_SCHEDULE_TIMEZONE,
	ExplicitRestriction,
	expandEventOccurrences,
	FullSchedule,
	isExplicitAllowedAt,
	isInRestrictedWindow,
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

describe("restriction des titres explicites", () => {
	const day = { enabled: true, from: "06:00", to: "22:00" };
	const paris = (explicit_restriction: ExplicitRestriction | undefined) => ({
		timezone: "Europe/Paris",
		explicit_restriction,
	});
	const at = (iso: string) => Date.parse(iso);

	it("est absente par defaut : aucun changement de comportement", () => {
		const parsed = FullSchedule.parse({ events: [] });
		expect(parsed.explicit_restriction).toBeUndefined();
		expect(isExplicitAllowedAt(parsed, at("2026-11-22T12:00:00Z"))).toBe(true);
	});

	it("valide le format HH:MM et refuse une plage vide", () => {
		expect(
			FullSchedule.safeParse({ events: [], explicit_restriction: day }).success,
		).toBe(true);
		for (const bad of [
			{ enabled: true, from: "6:00", to: "22:00" },
			{ enabled: true, from: "06:00", to: "24:00" },
			{ enabled: true, from: "06:00", to: "22:60" },
			{ enabled: true, from: "06:00:00", to: "22:00" },
			{ enabled: true, from: "06:00", to: "06:00" },
		]) {
			expect(
				FullSchedule.safeParse({ events: [], explicit_restriction: bad })
					.success,
			).toBe(false);
		}
	});

	it("met enabled a false par defaut", () => {
		const parsed = ExplicitRestriction.parse({ from: "06:00", to: "22:00" });
		expect(parsed.enabled).toBe(false);
		expect(isExplicitAllowedAt(paris(parsed), at("2026-11-22T12:00:00Z"))).toBe(
			true,
		);
	});

	it("lit la plage en heure de Paris, heure d'hiver", () => {
		// Hiver : Paris = UTC+1. 06:00 Paris = 05:00 UTC, 22:00 Paris = 21:00 UTC.
		const s = paris(day);
		expect(isExplicitAllowedAt(s, at("2026-11-22T04:59:00Z"))).toBe(true);
		expect(isExplicitAllowedAt(s, at("2026-11-22T05:00:00Z"))).toBe(false);
		expect(isExplicitAllowedAt(s, at("2026-11-22T20:59:59Z"))).toBe(false);
		// Borne de fin exclue : 22:00 pile est autorise.
		expect(isExplicitAllowedAt(s, at("2026-11-22T21:00:00Z"))).toBe(true);
	});

	it("suit l'heure d'ete (DST) sans glisser", () => {
		// Ete : Paris = UTC+2. 06:00 Paris = 04:00 UTC.
		const s = paris(day);
		expect(isExplicitAllowedAt(s, at("2026-07-05T03:59:00Z"))).toBe(true);
		expect(isExplicitAllowedAt(s, at("2026-07-05T04:00:00Z"))).toBe(false);
		expect(isExplicitAllowedAt(s, at("2026-07-05T20:00:00Z"))).toBe(true);
		// En UTC, la meme plage est decalee : la regle depend bien du fuseau.
		expect(
			isExplicitAllowedAt(
				{ timezone: "UTC", explicit_restriction: day },
				at("2026-07-05T04:00:00Z"),
			),
		).toBe(true);
	});

	it("gere les nuits de changement d'heure", () => {
		// 29 mars 2026, 02:00 -> 03:00 a Paris. Plage 02:30 -> 03:30 (murale) :
		// a 01:00 UTC il est 03:00 a Paris, donc dans la plage.
		const spring = paris({ enabled: true, from: "02:30", to: "03:30" });
		expect(isExplicitAllowedAt(spring, at("2026-03-29T00:59:00Z"))).toBe(true);
		expect(isExplicitAllowedAt(spring, at("2026-03-29T01:00:00Z"))).toBe(false);
		expect(isExplicitAllowedAt(spring, at("2026-03-29T01:30:00Z"))).toBe(true);
		// 25 octobre 2026, 03:00 -> 02:00 : 02:30 arrive deux fois, interdit les deux.
		const autumn = paris({ enabled: true, from: "02:00", to: "03:00" });
		expect(isExplicitAllowedAt(autumn, at("2026-10-25T00:30:00Z"))).toBe(false);
		expect(isExplicitAllowedAt(autumn, at("2026-10-25T01:30:00Z"))).toBe(false);
		expect(isExplicitAllowedAt(autumn, at("2026-10-25T02:00:00Z"))).toBe(true);
	});

	it("traverse minuit quand from > to", () => {
		const night = paris({ enabled: true, from: "22:00", to: "06:00" });
		expect(isExplicitAllowedAt(night, at("2026-11-22T20:59:00Z"))).toBe(true);
		expect(isExplicitAllowedAt(night, at("2026-11-22T21:00:00Z"))).toBe(false);
		expect(isExplicitAllowedAt(night, at("2026-11-22T23:30:00Z"))).toBe(false);
		expect(isExplicitAllowedAt(night, at("2026-11-23T04:59:00Z"))).toBe(false);
		expect(isExplicitAllowedAt(night, at("2026-11-23T05:00:00Z"))).toBe(true);
		expect(isInRestrictedWindow({ from: "22:00", to: "06:00" }, 0)).toBe(true);
		expect(isInRestrictedWindow({ from: "22:00", to: "06:00" }, 12 * 60)).toBe(
			false,
		);
	});

	it("ne restreint rien quand enabled est faux", () => {
		const off = paris({ ...day, enabled: false });
		expect(isExplicitAllowedAt(off, at("2026-11-22T12:00:00Z"))).toBe(true);
	});
});
