import { describe, expect, it } from "vitest";
import {
	isSilentLoudness,
	LUFS_SILENCE_FLOOR,
	MusicMetadata,
	TRUE_PEAK_FLOOR,
} from "./music";

describe("volume mesure (lufs / true_peak)", () => {
	const base = { title: "t", artist: "a" };

	it("absent : non mesure", () => {
		const parsed = MusicMetadata.parse(base);
		expect(parsed.lufs).toBeUndefined();
		expect(parsed.true_peak).toBeUndefined();
		expect(isSilentLoudness(parsed.lufs)).toBe(false);
	});

	it("garde une mesure normale", () => {
		const parsed = MusicMetadata.parse({ ...base, lufs: -14.2, true_peak: -1 });
		expect(parsed.lufs).toBe(-14.2);
		expect(parsed.true_peak).toBe(-1);
	});

	it("un fichier silencieux reste mesure : ramene au plancher", () => {
		for (const [lufs, true_peak] of [
			[Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
			[null, null],
			[-75, -120],
			[-70, -100],
		]) {
			const parsed = MusicMetadata.parse({ ...base, lufs, true_peak });
			expect(parsed.lufs).toBe(LUFS_SILENCE_FLOOR);
			expect(parsed.true_peak).toBe(TRUE_PEAK_FLOOR);
			expect(isSilentLoudness(parsed.lufs)).toBe(true);
		}
		// Silence en LUFS (sous la porte) mais crete mesurable : la crete est gardee.
		const quiet = MusicMetadata.parse({
			...base,
			lufs: Number.NEGATIVE_INFINITY,
			true_peak: -80,
		});
		expect(quiet.lufs).toBe(LUFS_SILENCE_FLOOR);
		expect(quiet.true_peak).toBe(-80);
	});

	it("survit a un aller-retour JSON (-Infinity devient null)", () => {
		const json = JSON.stringify({
			...base,
			lufs: Number.NEGATIVE_INFINITY,
			true_peak: Number.NEGATIVE_INFINITY,
		});
		const parsed = MusicMetadata.parse(JSON.parse(json));
		expect(parsed.lufs).toBe(LUFS_SILENCE_FLOOR);
		expect(parsed.true_peak).toBe(TRUE_PEAK_FLOOR);
	});

	it("une valeur cassee fait perdre la mesure, pas la fiche", () => {
		for (const broken of [Number.NaN, "fort", 42, Number.POSITIVE_INFINITY]) {
			const parsed = MusicMetadata.parse({ ...base, lufs: broken });
			expect(parsed.lufs).toBeUndefined();
			expect(parsed.title).toBe("t");
		}
	});
});
