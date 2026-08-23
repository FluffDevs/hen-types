/**
 * Genres normalisés pour la recherche/filtrage : une seule valeur par musique,
 * choisie dans cette liste plutôt que saisie librement.
 *
 * Le backend (admin-panel-backend) stocke le genre comme tag S3, dont les caractères
 * autorisés sont restreints (voir `safe_tag` dans src/shared/s3.ts : a-z 0-9 espace + - . _ : / @).
 * Pas d'accents ni de "&" ici, sous peine de troncature silencieuse une fois taggé.
 */
export const MUSIC_GENRES = [
	"Pop",
	"Rock",
	"Alternative",
	"Rap / Hip-Hop",
	"RnB / Soul",
	"Electro / EDM",
	"House",
	"Techno",
	"Drum and Bass",
	"Dubstep",
	"Trap",
	"Reggae / Ska",
	"Funk / Disco",
	"Jazz",
	"Blues",
	"Classique",
	"Metal",
	"Punk",
	"Folk",
	"Country",
	"Latin",
	"K-Pop",
	"J-Pop",
	"Chanson francaise / Variete",
	"Gospel",
	"World",
	"Ambient / Chillout",
	"Bande originale / Comedie musicale",
	"Mix",
	"Autre",
] as const;

export type MusicGenre = (typeof MUSIC_GENRES)[number];

const KNOWN_GENRES = new Set<string>(MUSIC_GENRES);

/** Valeur à afficher dans le <select> : le genre s'il est connu, "Autre" si c'est un genre personnalisé. */
export function genreSelectValue(genre: string | undefined): string {
	if (!genre) return "";
	return KNOWN_GENRES.has(genre) ? genre : "Autre";
}

/** Texte à afficher dans le champ personnalisé (vide si aucun genre personnalisé n'est saisi). */
export function genreCustomValue(genre: string | undefined): string {
	if (!genre || KNOWN_GENRES.has(genre)) return "";
	return genre;
}
