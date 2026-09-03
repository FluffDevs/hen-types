import { describe, expect, it } from "vitest";
import { AlternateSource, ScheduleContent } from "./schedule";

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
