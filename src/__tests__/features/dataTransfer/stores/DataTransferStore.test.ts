import { readFileSync } from "node:fs";
import { join } from "node:path";
import { migrateDatabase } from "../../../../database/client";
import { useAddictionStore } from "../../../../features/addictions/stores/AddictionStore";
import { useDataTransferStore } from "../../../../features/dataTransfer/stores/DataTransferStore";
import { useProfileStore } from "../../../../features/profile/stores/ProfileStore";
import {
	createTestDatabase,
	openTestRumoFile,
} from "../../../helpers/createTestDatabase";

const seedFile = () => ({
	name: "rumo-seed.db",
	bytes: new Uint8Array(
		readFileSync(join(__dirname, "../../../../../seed/rumo-seed.db")),
	),
});

async function setup() {
	const db = createTestDatabase();
	await migrateDatabase(db);
	return db;
}

describe("useDataTransferStore", () => {
	beforeEach(() => {
		useDataTransferStore.setState({ preview: null, pending: null });
		useAddictionStore.setState({ addictions: [], details: {}, isLoaded: true });
	});

	test("prepare mostra o preview sem gravar", async () => {
		const db = await setup();

		const preview = await useDataTransferStore
			.getState()
			.prepare(db, openTestRumoFile, seedFile());

		expect(preview.lines.map((line) => line.incoming)).toEqual([59, 80, 16]);
		const count = await db.getFirstAsync<{ total: number }>(
			"SELECT COUNT(*) AS total FROM tasks",
		);
		expect(count?.total).toBe(0);
		db.close();
	});

	test("confirm importa o seed e recarrega os stores", async () => {
		const db = await setup();
		await useDataTransferStore
			.getState()
			.prepare(db, openTestRumoFile, seedFile());

		const applied = await useDataTransferStore.getState().confirm(db);

		expect(applied).toBe(true);
		expect(useDataTransferStore.getState().preview).toBeNull();
		expect(useAddictionStore.getState().isLoaded).toBe(false);
		const count = await db.getFirstAsync<{ total: number }>(
			"SELECT COUNT(*) AS total FROM routine_blocks",
		);
		expect(count?.total).toBe(59);
		db.close();
	});

	test("restaurar um backup traz o perfil para o store", async () => {
		const source = await setup();
		await source.runAsync(
			"INSERT INTO profile (id, username) VALUES (1, 'Arthur')",
		);
		const bytes = await source.serializeAsync();
		const target = await setup();

		await useDataTransferStore
			.getState()
			.prepare(target, openTestRumoFile, { name: "b.db", bytes });
		await useDataTransferStore.getState().confirm(target);

		expect(useProfileStore.getState().profile?.username).toBe("Arthur");
		source.close();
		target.close();
	});

	test("arquivo do Rumo sem dados não pode ser aplicado", async () => {
		const empty = await setup();
		const bytes = await empty.serializeAsync();
		const db = await setup();

		const preview = await useDataTransferStore
			.getState()
			.prepare(db, openTestRumoFile, { name: "vazio.db", bytes });

		expect(preview.lines).toEqual([]);
		expect(await useDataTransferStore.getState().confirm(db)).toBe(false);
		empty.close();
		db.close();
	});

	test("confirm sem preparar não faz nada e reset limpa", async () => {
		const db = await setup();

		expect(await useDataTransferStore.getState().confirm(db)).toBe(false);
		await useDataTransferStore
			.getState()
			.prepare(db, openTestRumoFile, seedFile());
		useDataTransferStore.getState().reset();

		expect(useDataTransferStore.getState().preview).toBeNull();
		db.close();
	});
});
