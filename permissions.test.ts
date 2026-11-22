import { describe, expect, it } from "vitest";
import {
	ADMIN_ALL,
	allCatalogGroups,
	allPermissions,
	canAccessMedia,
	catalogGroupDescription,
	classifyGroup,
	effectiveGroups,
	hasAnyPermission,
	hasPermission,
	isAdmin,
	LEGACY_GROUP_MIGRATION,
	LEGACY_GROUPS,
	legacyMigrationPlan,
	MEDIA_CATEGORIES,
	mediaCategoriesFor,
	mediaPermissions,
	type Permission,
	parsePermission,
	permissionLabel,
	permissionsOf,
	TEAM_GROUPS,
} from "./permissions";

describe("catalogue", () => {
	it("contient les droits attendus, sans doublon", () => {
		const all = allPermissions();
		expect(new Set(all).size).toBe(all.length);
		// 1 + 6 + 24 + 4*4 (playlists, schedule, branding, streamers) + 2 + 2 + 1 + 1 + 2 + 2 + 1 + 2
		expect(all).toHaveLength(1 + 6 + 24 + 16 + 2 + 2 + 1 + 1 + 2 + 2 + 1 + 2);
		for (const p of [
			"dashboard:read",
			"library:read:jingles",
			"uploads:create:musics",
			"uploads:delete:ads",
			"schedule:update",
			"music-validation:update",
			"my-live:update",
			"cache:delete",
		]) {
			expect(all).toContain(p);
		}
	});

	it("respecte le format page:action[:categorie] en minuscules", () => {
		for (const p of allPermissions()) {
			expect(p).toMatch(/^[a-z-]+:(read|create|update|delete)(:[a-z]+)?$/);
		}
	});

	it("n'a pas de groupe permissions:* (gestion des droits = admin:all)", () => {
		expect(allCatalogGroups().some((g) => g.startsWith("permissions:"))).toBe(
			false,
		);
	});

	it("allCatalogGroups = admin:all + droits + team", () => {
		const groups = allCatalogGroups();
		expect(groups[0]).toBe(ADMIN_ALL);
		expect(groups).toHaveLength(
			1 + allPermissions().length + TEAM_GROUPS.length,
		);
		expect(groups).toContain("team:streamer");
	});

	it("tous les groupes tiennent dans les limites Cognito (nom <= 128, description <= 2048)", () => {
		for (const g of allCatalogGroups()) {
			expect(g.length).toBeLessThanOrEqual(128);
			expect(catalogGroupDescription(g).length).toBeLessThanOrEqual(2048);
		}
	});

	it("parse et libelle un droit", () => {
		expect(parsePermission("uploads:create:musics")).toEqual({
			page: "uploads",
			action: "create",
			category: "musics",
		});
		expect(parsePermission("schedule:read")).toEqual({
			page: "schedule",
			action: "read",
		});
		expect(parsePermission("schedule:read:musics")).toBeNull();
		expect(parsePermission("admins")).toBeNull();
		expect(permissionLabel("uploads:create:musics")).toBe(
			"Fichiers audio — Créer — Musiques",
		);
		expect(permissionLabel("gestionconvsfur")).toBe("gestionconvsfur");
	});

	it("classe les groupes", () => {
		expect(classifyGroup("admin:all")).toBe("admin");
		expect(classifyGroup("playlists:read")).toBe("permission");
		expect(classifyGroup("team:associate")).toBe("team");
		expect(classifyGroup("ProgrammeursRadio")).toBe("legacy");
		expect(classifyGroup("gestionconvsfur")).toBe("external");
		expect(classifyGroup("unGroupeInconnu")).toBe("unknown");
		expect(classifyGroup("playlists:read:musics")).toBe("unknown");
	});
});

describe("hasPermission", () => {
	it("admin:all donne tout", () => {
		for (const p of allPermissions()) {
			expect(hasPermission([ADMIN_ALL], p)).toBe(true);
		}
		expect(hasPermission([ADMIN_ALL], ADMIN_ALL)).toBe(true);
		expect(isAdmin([ADMIN_ALL])).toBe(true);
	});

	it("les droits sont independants (meme la lecture doit etre donnee)", () => {
		const groups = ["uploads:delete:musics"];
		expect(hasPermission(groups, "uploads:delete:musics")).toBe(true);
		expect(hasPermission(groups, "uploads:read:musics")).toBe(false);
		expect(hasPermission(groups, "uploads:delete:jingles")).toBe(false);
		expect(hasPermission(["schedule:update"], "schedule:read")).toBe(false);
		expect(hasPermission(["schedule:read"], ADMIN_ALL)).toBe(false);
	});

	it("les groupes team:* ne donnent aucun droit", () => {
		const groups = TEAM_GROUPS.map((t) => t.name);
		expect(permissionsOf(groups)).toEqual([]);
		expect(isAdmin(groups)).toBe(false);
	});

	it("tolere des entrees vides ou invalides", () => {
		expect(hasPermission(undefined, "dashboard:read")).toBe(false);
		expect(hasPermission(null, "dashboard:read")).toBe(false);
		expect(hasPermission([42 as unknown as string], "dashboard:read")).toBe(
			false,
		);
	});

	it("applique les alias legacy pendant la transition", () => {
		expect(hasPermission(["admins"], "cache:delete")).toBe(true);
		expect(hasPermission(["admins"], ADMIN_ALL)).toBe(true);
		expect(hasPermission(["UploaderRadio"], "uploads:create:musics")).toBe(
			true,
		);
		expect(hasPermission(["UploaderRadio"], "uploads:update:musics")).toBe(
			false,
		);
		expect(hasPermission(["UploaderRadio"], "uploads:create:jingles")).toBe(
			false,
		);
		expect(hasPermission(["Streamers"], "branding:read")).toBe(true);
		expect(hasPermission(["Streamers"], "branding:update")).toBe(false);
		expect(hasPermission(["AccesAuxStatus"], "monitoring:update")).toBe(false);
	});

	it("n'applique plus les alias quand la transition est terminee", () => {
		const options = { legacyAliases: false };
		expect(hasPermission(["admins"], "cache:delete", options)).toBe(false);
		expect(isAdmin(["admins"], options)).toBe(false);
		expect(hasPermission([ADMIN_ALL], "cache:delete", options)).toBe(true);
	});

	it("hasAnyPermission", () => {
		expect(
			hasAnyPermission(["schedule:read"], ["playlists:read", "schedule:read"]),
		).toBe(true);
		expect(hasAnyPermission(["schedule:read"], [])).toBe(false);
		expect(hasAnyPermission([ADMIN_ALL], [])).toBe(true);
	});

	it("permissionsOf : admin developpe, sinon ordre du catalogue", () => {
		expect(permissionsOf([ADMIN_ALL])).toEqual(allPermissions());
		expect(permissionsOf(["StaffRadio"])).toEqual(["dashboard:read"]);
		expect(effectiveGroups(["StaffRadio"]).has("team:radiovolunteer")).toBe(
			true,
		);
	});
});

describe("migration legacy", () => {
	it("correspondances validees", () => {
		expect(LEGACY_GROUP_MIGRATION.admins).toEqual([ADMIN_ALL]);
		expect(LEGACY_GROUP_MIGRATION.AccesMediatheque).toEqual(
			MEDIA_CATEGORIES.map((c) => `library:read:${c}`),
		);
		expect(LEGACY_GROUP_MIGRATION.ProgrammeursRadio).toHaveLength(8);
		expect(LEGACY_GROUP_MIGRATION.Streamers).toEqual([
			"my-live:read",
			"my-live:update",
			"branding:read",
			"team:streamer",
		]);
	});

	it("tous les groupes cibles existent dans le catalogue", () => {
		const catalog = new Set<string>(allCatalogGroups());
		for (const legacy of LEGACY_GROUPS) {
			for (const g of LEGACY_GROUP_MIGRATION[legacy]) {
				expect(catalog.has(g)).toBe(true);
			}
		}
	});

	it("les pages nouvelles ne sont donnees a personne", () => {
		const given = new Set<string>(
			LEGACY_GROUPS.flatMap((g) => LEGACY_GROUP_MIGRATION[g]),
		);
		for (const p of [
			"play-history:read",
			"monitoring:update",
			"live-stats:read",
			"audio-console:read",
			"music-validation:read",
			"debug-api:read",
			"cache:read",
			"streamers:read",
		]) {
			expect(given.has(p)).toBe(false);
		}
	});

	it("plan pour un utilisateur : ajoute seulement ce qui manque", () => {
		const plan = legacyMigrationPlan([
			"Streamers",
			"StaffRadio",
			"branding:read",
			"gestionconvsfur",
		]);
		expect(plan.legacy).toEqual(["StaffRadio", "Streamers"]);
		expect(plan.add).toEqual([
			"dashboard:read",
			"my-live:read",
			"my-live:update",
			"team:radiovolunteer",
			"team:streamer",
		]);
		expect(plan.alreadyPresent).toEqual(["branding:read"]);
	});

	it("plan vide sans ancien groupe", () => {
		expect(legacyMigrationPlan(["admin:all", "gestionconvsfur"])).toEqual({
			legacy: [],
			add: [],
			alreadyPresent: [],
		});
	});

	it("la migration rend exactement les droits que donnaient les alias", () => {
		for (const legacy of LEGACY_GROUPS) {
			const plan = legacyMigrationPlan([legacy]);
			const migrated = [...plan.add];
			expect(permissionsOf(migrated, { legacyAliases: false })).toEqual(
				permissionsOf([legacy]),
			);
		}
	});
});

describe("medias", () => {
	it("lecture par categorie : mediatheque ou fichiers audio", () => {
		expect(
			canAccessMedia(["library:read:jingles"], "download", "jingles"),
		).toBe(true);
		expect(canAccessMedia(["library:read:jingles"], "download", "musics")).toBe(
			false,
		);
		expect(canAccessMedia(["uploads:read:ads"], "list", "ads")).toBe(true);
	});

	it("l'ecriture ne donne pas la lecture", () => {
		expect(canAccessMedia(["uploads:create:musics"], "list", "musics")).toBe(
			false,
		);
		expect(canAccessMedia(["uploads:create:musics"], "create", "musics")).toBe(
			true,
		);
		expect(canAccessMedia(["uploads:create:musics"], "update", "musics")).toBe(
			false,
		);
	});

	it("programmations et playlists listent sans telecharger", () => {
		expect(canAccessMedia(["schedule:read"], "list", "podcasts")).toBe(true);
		expect(canAccessMedia(["schedule:read"], "download", "podcasts")).toBe(
			false,
		);
		expect(canAccessMedia(["playlists:read"], "list", "musics")).toBe(true);
		expect(canAccessMedia(["playlists:read"], "list", "jingles")).toBe(false);
	});

	it("habillage = jingles ; validation = musiques", () => {
		expect(mediaCategoriesFor(["branding:read"], "download")).toEqual([
			"jingles",
		]);
		expect(mediaCategoriesFor(["branding:update"], "update")).toEqual([
			"jingles",
		]);
		expect(mediaCategoriesFor(["music-validation:update"], "update")).toEqual([
			"musics",
		]);
		expect(mediaCategoriesFor(["music-validation:read"], "download")).toEqual([
			"musics",
		]);
	});

	it("UploaderRadio (legacy) : musiques seulement, sans modifier ni supprimer", () => {
		expect(mediaCategoriesFor(["UploaderRadio"], "create")).toEqual(["musics"]);
		expect(mediaCategoriesFor(["UploaderRadio"], "update")).toEqual([]);
		expect(mediaCategoriesFor(["UploaderRadio"], "delete")).toEqual([]);
	});

	it("tous les droits renvoyes existent", () => {
		for (const access of [
			"list",
			"download",
			"create",
			"update",
			"delete",
		] as const) {
			for (const c of MEDIA_CATEGORIES) {
				for (const p of mediaPermissions(access, c)) {
					expect(allPermissions()).toContain(p as Permission);
				}
			}
		}
	});
});
