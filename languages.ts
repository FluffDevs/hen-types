/**
 * Langues normalisées pour la recherche/filtrage : une seule valeur par musique,
 * choisie dans cette liste plutôt que saisie librement (evite "fr" / "FR" / "français"
 * qui casseraient une recherche exacte).
 *
 * Codes ISO 639-1 en minuscules, plus quelques valeurs utilitaires pour la radio
 * (musique sans parole, plusieurs langues dans le meme titre, ou langue non listee).
 */
export const MUSIC_LANGUAGES = [
	"fr",
	"en",
	"es",
	"de",
	"it",
	"pt",
	"nl",
	"ru",
	"ja",
	"ko",
	"zh",
	"ar",
	"pl",
	"sv",
	"fi",
	"tr",
	"multi",
	"instrumental",
	"autre",
] as const;

export type MusicLanguage = (typeof MUSIC_LANGUAGES)[number];

/** Libellé humain affiché dans le <select>, pour chaque code de MUSIC_LANGUAGES. */
export const MUSIC_LANGUAGE_LABELS: Record<MusicLanguage, string> = {
	fr: "Français",
	en: "Anglais",
	es: "Espagnol",
	de: "Allemand",
	it: "Italien",
	pt: "Portugais",
	nl: "Néerlandais",
	ru: "Russe",
	ja: "Japonais",
	ko: "Coréen",
	zh: "Chinois",
	ar: "Arabe",
	pl: "Polonais",
	sv: "Suédois",
	fi: "Finnois",
	tr: "Turc",
	multi: "Multilingue",
	instrumental: "Instrumental (sans parole)",
	autre: "Autre",
};

const KNOWN_LANGUAGES = new Set<string>(MUSIC_LANGUAGES);

/** Valeur à afficher dans le <select> : la langue si connue, "autre" si personnalisée. */
export function langSelectValue(lang: string | undefined): string {
	if (!lang) return "";
	const normalized = lang.trim().toLowerCase();
	return KNOWN_LANGUAGES.has(normalized) ? normalized : "autre";
}

/** Texte à afficher dans le champ personnalisé (vide si aucune langue personnalisée n'est saisie). */
export function langCustomValue(lang: string | undefined): string {
	if (!lang) return "";
	const normalized = lang.trim().toLowerCase();
	return KNOWN_LANGUAGES.has(normalized) ? "" : lang;
}
