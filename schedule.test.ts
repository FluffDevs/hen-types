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
	isValidTimeZone,
	parseIsoDurationMs,
	ScheduleContent,
	ScheduleDuration,
	ScheduleEvent,
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

	it("n'accepte que les noms IANA canoniques (et UTC)", () => {
		expect(isValidTimeZone("Europe/Paris")).toBe(true);
		expect(isValidTimeZone("UTC")).toBe(true);
		expect(isValidTimeZone("America/New_York")).toBe(true);
		for (const bad of [
			"+01:00",
			"-05:00",
			"+0100",
			"−01:00",
			"europe/paris",
			"EUROPE/PARIS",
			"utc",
			"Mars/Olympus",
			"",
		]) {
			expect(isValidTimeZone(bad)).toBe(false);
			expect(
				FullSchedule.safeParse({ events: [], timezone: bad }).success,
			).toBe(false);
		}
	});

	it("joue des la premiere semaine un lundi 00:30 a Paris (dimanche 23:30 UTC)", () => {
		// first_occurence = lundi 5 janvier 2026 a minuit UTC. Lundi 00:30 a Paris
		// = dimanche 4 janvier 23:30 UTC, avant l'instant d'ancrage mais le jour
		// mural (lundi 5) n'est pas avant la date d'ancrage : l'occurrence joue.
		const out = expandEventOccurrences(
			liveEvent(["MONDAY:00:30:00"]),
			"Europe/Paris",
			Date.parse("2026-01-04T00:00:00Z"),
			Date.parse("2026-01-13T00:00:00Z"),
		);
		expect(out.map((o) => iso(o.startAt))).toEqual([
			"2026-01-04T23:30:00.000Z",
			"2026-01-11T23:30:00.000Z",
		]);
	});

	it("compare la date murale a la date UTC de first_occurence, pas l'instant", () => {
		// Ancrage mercredi 7 janvier 2026 a 20:00 UTC.
		const e = liveEvent(
			["MONDAY:10:00:00", "WEDNESDAY:00:30:00", "WEDNESDAY:10:00:00"],
			{ first_occurence: "2026-01-07T20:00:00.000Z" },
		);
		const out = expandEventOccurrences(
			e,
			"Europe/Paris",
			Date.parse("2026-01-05T00:00:00Z"),
			Date.parse("2026-01-08T00:00:00Z"),
		);
		// Lundi 5 : date murale avant l'ancrage, ecarte. Mercredi 00:30 Paris
		// (mardi 23:30 UTC) et mercredi 10:00 Paris (avant 20:00 UTC) : le jour
		// mural est le 7, ils jouent.
		expect(out.map((o) => iso(o.startAt))).toEqual([
			"2026-01-06T23:30:00.000Z",
			"2026-01-07T09:00:00.000Z",
		]);
	});

	it("ecarte un jour mural anterieur a l'ancrage meme si l'instant UTC est apres", () => {
		// Fuseau a l'ouest d'UTC : mardi 23:00 a New York = mercredi 04:00 UTC,
		// date UTC egale a l'ancrage, mais date murale (mardi) anterieure.
		const e = liveEvent(["TUESDAY:23:00:00", "WEDNESDAY:23:00:00"], {
			first_occurence: "2026-01-07T00:00:00.000Z",
		});
		const out = expandEventOccurrences(
			e,
			"America/New_York",
			Date.parse("2026-01-05T00:00:00Z"),
			Date.parse("2026-01-09T00:00:00Z"),
		);
		expect(out.map((o) => iso(o.startAt))).toEqual([
			"2026-01-08T04:00:00.000Z",
		]);
	});

	it("passage a l'heure d'ete (29/03/2026) : 02:30 joue a 03:30, la duree reste reelle", () => {
		const e = {
			...liveEvent(["SUNDAY:02:30:00"]),
			duration: "PT2H",
		} as ScheduleEvent;
		const out = expandEventOccurrences(
			e,
			"Europe/Paris",
			Date.parse("2026-03-21T00:00:00Z"),
			Date.parse("2026-04-06T00:00:00Z"),
		);
		expect(out.map((o) => iso(o.startAt))).toEqual([
			"2026-03-22T01:30:00.000Z", // 02:30 CET
			"2026-03-29T01:30:00.000Z", // 03:30 CEST (02:30 n'existe pas)
			"2026-04-05T00:30:00.000Z", // 02:30 CEST
		]);
		for (const o of out) expect(o.endAt - o.startAt).toBe(2 * 3_600_000);
	});

	it("passage a l'heure d'hiver (25/10/2026) : 02:30 doublee, la premiere", () => {
		const out = expandEventOccurrences(
			liveEvent(["SUNDAY:02:30:00"]),
			"Europe/Paris",
			Date.parse("2026-10-17T00:00:00Z"),
			Date.parse("2026-11-02T00:00:00Z"),
		);
		expect(out.map((o) => iso(o.startAt))).toEqual([
			"2026-10-18T00:30:00.000Z", // 02:30 CEST
			"2026-10-25T00:30:00.000Z", // premiere 02:30 (CEST)
			"2026-11-01T01:30:00.000Z", // 02:30 CET
		]);
	});

	it("garde une occurrence longue commencee avant la fenetre et encore en cours", () => {
		// Vendredi 20 novembre 2026 20:00 Paris (19:00 UTC), 4 jours : jusqu'au
		// mardi 24 19:00 UTC. Fenetre : lundi 23 a midi.
		const e = {
			...liveEvent(["FRIDAY:20:00:00"]),
			duration: "P4D",
		} as ScheduleEvent;
		const out = expandEventOccurrences(
			e,
			"Europe/Paris",
			Date.parse("2026-11-23T12:00:00Z"),
			Date.parse("2026-11-23T13:00:00Z"),
		);
		expect(out.map((o) => iso(o.startAt))).toEqual([
			"2026-11-20T19:00:00.000Z",
		]);
	});

	it("refuse une fenetre non bornee, sauf si last_occurence la borne", () => {
		const open = liveEvent(["SUNDAY:18:00:00"]);
		expect(() =>
			expandEventOccurrences(
				open,
				"Europe/Paris",
				Date.parse("2026-11-01T00:00:00Z"),
				Number.POSITIVE_INFINITY,
			),
		).toThrow(RangeError);
		expect(() =>
			expandEventOccurrences(
				open,
				"Europe/Paris",
				Number.NEGATIVE_INFINITY,
				Date.parse("2026-11-01T00:00:00Z"),
			),
		).toThrow(RangeError);
		expect(
			expandEventOccurrences(open, "Europe/Paris", Number.NaN, Number.NaN),
		).toEqual([]);

		const bounded = liveEvent(["SUNDAY:18:00:00"], {
			first_occurence: "2026-11-01T00:00:00.000Z",
			last_occurence: "2026-11-16T00:00:00.000Z",
		});
		const out = expandEventOccurrences(
			bounded,
			"Europe/Paris",
			Date.parse("2026-11-01T00:00:00Z"),
			Number.POSITIVE_INFINITY,
		);
		expect(out.map((o) => iso(o.startAt))).toEqual([
			"2026-11-01T17:00:00.000Z",
			"2026-11-08T17:00:00.000Z",
			"2026-11-15T17:00:00.000Z",
		]);
	});
});

describe("duree d'un creneau", () => {
	it("accepte semaines, jours, heures, minutes, secondes", () => {
		for (const ok of [
			"PT1H",
			"PT1H30M",
			"P1DT2H",
			"P1W",
			"PT90S",
			"PT1.5S",
			"PT0S",
		]) {
			expect(ScheduleDuration.safeParse(ok).success).toBe(true);
		}
		expect(parseIsoDurationMs("PT1H30M")).toBe(5_400_000);
		expect(parseIsoDurationMs("P1DT2H")).toBe(26 * 3_600_000);
		expect(parseIsoDurationMs("PT1.5S")).toBe(1_500);
	});

	it("refuse annees, mois, virgule decimale et fractions hors secondes", () => {
		for (const bad of [
			"P1Y",
			"P1M",
			"P1Y2M",
			"P1MT1H",
			"PT1,5S",
			"PT1.5H",
			"P",
			"PT",
			"1H",
			"",
		]) {
			expect(ScheduleDuration.safeParse(bad).success).toBe(false);
			// Ce que le schema refuse, parseIsoDurationMs le ramene a 0.
			expect(parseIsoDurationMs(bad)).toBe(0);
		}
	});

	it("s'applique au champ duration des evenements", () => {
		const base = {
			timing: { date: "2026-11-22T17:00:00.000Z" },
			event_id: "e1",
			title: "t",
			slot_type: "playlist",
			content: { kind: "playlist", playlist_id: "p" },
			created_by: "u",
			created_at: "2026-01-01T00:00:00.000Z",
			updated_by: "u",
			updated_at: "2026-01-01T00:00:00.000Z",
		};
		expect(ScheduleEvent.safeParse({ ...base, duration: "PT1H" }).success).toBe(
			true,
		);
		expect(ScheduleEvent.safeParse({ ...base, duration: "P1M" }).success).toBe(
			false,
		);
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

	it("n'exige from !== to que si la restriction est active", () => {
		expect(
			ExplicitRestriction.safeParse({
				enabled: false,
				from: "06:00",
				to: "06:00",
			}).success,
		).toBe(true);
		expect(
			ExplicitRestriction.safeParse({ from: "06:00", to: "06:00" }).success,
		).toBe(true);
		expect(
			ExplicitRestriction.safeParse({
				enabled: true,
				from: "06:00",
				to: "06:00",
			}).success,
		).toBe(false);
		const off = ExplicitRestriction.parse({ from: "06:00", to: "06:00" });
		expect(isExplicitAllowedAt(paris(off), at("2026-11-22T05:30:00Z"))).toBe(
			true,
		);
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
