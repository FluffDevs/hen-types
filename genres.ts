/**
 * Genres normalisés pour la recherche/filtrage.
 *
 * Une musique peut avoir plusieurs genres : le champ `genre` stocke la liste choisie
 * sous forme d'une chaîne unique, les genres étant séparés par des virgules
 * (ex: "Pop, Rock, Funk / Disco"). Utiliser `parseGenres`/`serializeGenres` pour
 * convertir entre cette chaîne et un tableau de genres.
 */
export const MUSIC_GENRES = [
	"Pop",
	"Pop rock",
	"Synth-pop",
	"Indie pop",
	"Dream pop",
	"City pop",
	"Rock",
	"Rock alternatif",
	"Rock indé",
	"Rock progressif",
	"Rock psychédélique",
	"Post-rock",
	"Rock garage",
	"Glam rock",
	"Hard rock",
	"Grunge",
	"Metal",
	"Metal alternatif",
	"Heavy metal",
	"Death metal",
	"Black metal",
	"Doom metal",
	"Metalcore",
	"Nu metal",
	"Punk",
	"Punk rock",
	"Post-punk",
	"Pop punk",
	"Hardcore punk",
	"Emo",
	"Rap / Hip-Hop",
	"Trap",
	"Drill",
	"Boom bap",
	"Cloud rap",
	"Rap francais",
	"Grime",
	"RnB / Soul",
	"Neo soul",
	"Funk / Soul",
	"Funk / Disco",
	"Gospel",
	"Blues",
	"Jazz",
	"Jazz fusion",
	"Smooth jazz",
	"Swing",
	"Electro / EDM",
	"House",
	"Deep house",
	"Tech house",
	"Progressive house",
	"Future house",
	"Techno",
	"Trance",
	"Hardstyle",
	"Hardcore techno",
	"Gabber",
	"Dance",
	"Eurodance",
	"Big room",
	"Electro pop",
	"Synthwave",
	"Vaporwave",
	"Chiptune",
	"Drum and Bass",
	"Jungle",
	"Breakbeat",
	"Dubstep",
	"Bass music",
	"UK garage",
	"Phonk",
	"Hyperpop",
	"Ambient / Chillout",
	"Downtempo",
	"Lo-fi",
	"IDM",
	"Experimental",
	"Industrial",
	"EBM",
	"Darkwave",
	"Reggae / Ska",
	"Dancehall",
	"Dub",
	"Ragga",
	"Afrobeat",
	"Afrobeats",
	"Amapiano",
	"Latin",
	"Reggaeton",
	"Salsa",
	"Bachata",
	"Cumbia",
	"Bossa nova",
	"Samba",
	"Flamenco",
	"Folk",
	"Folk francaise",
	"Chanson francaise / Variete",
	"Country",
	"Bluegrass",
	"Americana",
	"Musique celtique",
	"World",
	"Musique orientale",
	"Musique africaine",
	"Musique indienne",
	"K-Pop",
	"J-Pop",
	"J-Rock",
	"City pop japonaise",
	"Vocaloid",
	"Anime / OST japonais",
	"Classique",
	"Musique baroque",
	"Opera",
	"Musique de chambre",
	"Musique contemporaine",
	"Minimalisme",
	"Neoclassique",
	"Bande originale / Comedie musicale",
	"Musique de jeu video",
	"Musique de film",
	"Comptine / Enfants",
	"Musique religieuse",
	"Musique traditionnelle",
	"Spoken word / Poesie",
	"Comedie / Sketch audio",
	"ASMR",
	"Podcast",
	"Mix",
	"Mashup",
	"Remix",
	"Autre",
] as const;

export type MusicGenre = (typeof MUSIC_GENRES)[number];

const KNOWN_GENRES = new Set<string>(MUSIC_GENRES);

/** Découpe la chaîne de genres stockée (séparés par des virgules) en liste, sans doublons ni vides, ordre préservé. */
export function parseGenres(genre: string | undefined): string[] {
	if (!genre) return [];
	const seen = new Set<string>();
	const result: string[] = [];
	for (const raw of genre.split(",")) {
		const trimmed = raw.trim();
		if (!trimmed || seen.has(trimmed)) continue;
		seen.add(trimmed);
		result.push(trimmed);
	}
	return result;
}

/** Reconstruit la chaîne de genres à stocker à partir de la liste sélectionnée. */
export function serializeGenres(genres: string[]): string {
	return parseGenres(genres.join(",")).join(", ");
}

/** Indique si le genre donné fait partie de la liste normalisée (sinon c'est un genre personnalisé). */
export function isKnownGenre(genre: string): boolean {
	return KNOWN_GENRES.has(genre);
}
