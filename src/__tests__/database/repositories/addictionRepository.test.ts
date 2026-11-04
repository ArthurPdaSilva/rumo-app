import { migrateDatabase } from "../../../database/client";
import {
	createAddiction,
	deleteAddiction,
	getAddiction,
	getBestStreakMs,
	listAddictions,
	listRelapses,
	registerRelapse,
} from "../../../database/repositories/addictionRepository";
import { createTestDatabase } from "../../helpers/createTestDatabase";

const DAY = 86_400_000;

async function setup() {
	const db = createTestDatabase();
	await migrateDatabase(db);
	return db;
}

describe("addictionRepository", () => {
	test("cria e lista vários vícios na ordem de criação", async () => {
		const db = await setup();
		await createAddiction(db, {
			name: "Cigarro",
			quitAt: "2026-10-01T10:00:00.000Z",
			createdAt: "2026-11-01T10:00:00.000Z",
		});
		await createAddiction(db, {
			name: "Refrigerante",
			icon: "cup",
			quitAt: "2026-10-20T10:00:00.000Z",
			createdAt: "2026-11-02T10:00:00.000Z",
		});

		const list = await listAddictions(db);

		expect(list.map((item) => item.name)).toEqual(["Cigarro", "Refrigerante"]);
		expect(list[0].icon).toBe("leaf");
		expect(list[1].icon).toBe("cup");
		db.close();
	});

	test("a contagem começa em quit_at quando não há recaída", async () => {
		const db = await setup();
		const id = await createAddiction(db, {
			name: "Cigarro",
			quitAt: "2026-10-01T10:00:00.000Z",
			createdAt: "2026-11-01T10:00:00.000Z",
		});

		expect((await getAddiction(db, id))?.streakStartedAt).toBe(
			"2026-10-01T10:00:00.000Z",
		);
		db.close();
	});

	test("a recaída reinicia a contagem sem apagar o histórico", async () => {
		const db = await setup();
		const id = await createAddiction(db, {
			name: "Cigarro",
			quitAt: "2026-10-01T10:00:00.000Z",
			createdAt: "2026-11-01T10:00:00.000Z",
		});

		await registerRelapse(db, id, "2026-10-10T12:00:00.000Z", "dia difícil");
		await registerRelapse(db, id, "2026-10-20T12:00:00.000Z");

		expect((await getAddiction(db, id))?.streakStartedAt).toBe(
			"2026-10-20T12:00:00.000Z",
		);
		const relapses = await db.getAllAsync<{ note: string | null }>(
			"SELECT note FROM relapses WHERE addiction_id = ? ORDER BY occurred_at",
			id,
		);
		expect(relapses.map((relapse) => relapse.note)).toEqual([
			"dia difícil",
			null,
		]);
		db.close();
	});

	test("calcula o melhor período entre início, recaídas e agora", async () => {
		const db = await setup();
		const start = new Date("2026-10-01T00:00:00.000Z");
		const id = await createAddiction(db, {
			name: "Cigarro",
			quitAt: start.toISOString(),
			createdAt: start.toISOString(),
		});
		await registerRelapse(
			db,
			id,
			new Date(start.getTime() + 12 * DAY).toISOString(),
		);

		const now = new Date(start.getTime() + 20 * DAY);

		expect(await getBestStreakMs(db, id, now)).toBe(12 * DAY);
		db.close();
	});

	test("o melhor período considera a contagem atual quando ela é maior", async () => {
		const db = await setup();
		const start = new Date("2026-10-01T00:00:00.000Z");
		const id = await createAddiction(db, {
			name: "Cigarro",
			quitAt: start.toISOString(),
			createdAt: start.toISOString(),
		});
		await registerRelapse(
			db,
			id,
			new Date(start.getTime() + 3 * DAY).toISOString(),
		);

		const now = new Date(start.getTime() + 30 * DAY);

		expect(await getBestStreakMs(db, id, now)).toBe(27 * DAY);
		db.close();
	});

	test("retorna null e zero para vício inexistente", async () => {
		const db = await setup();

		expect(await getAddiction(db, 99)).toBeNull();
		expect(await getBestStreakMs(db, 99, new Date())).toBe(0);
		db.close();
	});

	test("excluir o vício remove as recaídas em cascata", async () => {
		const db = await setup();
		const id = await createAddiction(db, {
			name: "Cigarro",
			quitAt: "2026-10-01T10:00:00.000Z",
			createdAt: "2026-11-01T10:00:00.000Z",
		});
		await registerRelapse(db, id, "2026-10-10T12:00:00.000Z");

		await db.runAsync("DELETE FROM addictions WHERE id = ?", id);

		const count = await db.getFirstAsync<{ total: number }>(
			"SELECT COUNT(*) AS total FROM relapses",
		);
		expect(count?.total).toBe(0);
		db.close();
	});

	test("lista as recaídas da mais recente para a mais antiga", async () => {
		const db = await setup();
		const id = await createAddiction(db, {
			name: "Cigarro",
			quitAt: "2026-10-01T10:00:00.000Z",
			createdAt: "2026-11-01T10:00:00.000Z",
		});
		await registerRelapse(db, id, "2026-10-10T12:00:00.000Z", "primeira");
		await registerRelapse(db, id, "2026-10-20T12:00:00.000Z");

		const relapses = await listRelapses(db, id);

		expect(relapses.map((relapse) => relapse.occurredAt)).toEqual([
			"2026-10-20T12:00:00.000Z",
			"2026-10-10T12:00:00.000Z",
		]);
		expect(relapses[1].note).toBe("primeira");
		db.close();
	});

	test("deleteAddiction remove só o vício escolhido", async () => {
		const db = await setup();
		const first = await createAddiction(db, {
			name: "Cigarro",
			quitAt: "2026-10-01T10:00:00.000Z",
			createdAt: "2026-11-01T10:00:00.000Z",
		});
		await createAddiction(db, {
			name: "Refrigerante",
			quitAt: "2026-10-02T10:00:00.000Z",
			createdAt: "2026-11-02T10:00:00.000Z",
		});

		await deleteAddiction(db, first);

		expect((await listAddictions(db)).map((item) => item.name)).toEqual([
			"Refrigerante",
		]);
		db.close();
	});
});
