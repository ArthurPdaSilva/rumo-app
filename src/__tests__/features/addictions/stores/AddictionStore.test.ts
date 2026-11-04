import { migrateDatabase } from "../../../../database/client";
import { useAddictionStore } from "../../../../features/addictions/stores/AddictionStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

const DAY = 86_400_000;

async function setup() {
	const db = createTestDatabase();
	await migrateDatabase(db);
	return db;
}

describe("useAddictionStore", () => {
	beforeEach(() => {
		useAddictionStore.setState({
			addictions: [],
			details: {},
			isLoaded: false,
		});
	});

	test("load marca como carregado mesmo sem vícios", async () => {
		const db = await setup();

		await useAddictionStore.getState().load(db);

		expect(useAddictionStore.getState().isLoaded).toBe(true);
		expect(useAddictionStore.getState().addictions).toEqual([]);
		db.close();
	});

	test("add cria o vício e atualiza a lista", async () => {
		const db = await setup();
		const now = new Date("2026-11-04T16:00:00.000Z");

		const id = await useAddictionStore.getState().add(
			db,
			{
				name: "Cigarro",
				icon: "smoking",
				quitAt: "2026-10-01T10:00:00.000Z",
			},
			now,
		);

		const [item] = useAddictionStore.getState().addictions;
		expect(item).toMatchObject({
			id,
			name: "Cigarro",
			icon: "smoking",
			quitAt: "2026-10-01T10:00:00.000Z",
			createdAt: now.toISOString(),
			streakStartedAt: "2026-10-01T10:00:00.000Z",
		});
		db.close();
	});

	test("suporta vários vícios ao mesmo tempo", async () => {
		const db = await setup();
		const store = useAddictionStore.getState();

		await store.add(db, {
			name: "Cigarro",
			icon: "smoking",
			quitAt: "2026-10-01T10:00:00.000Z",
		});
		await store.add(db, {
			name: "Doces",
			icon: "candy",
			quitAt: "2026-10-05T10:00:00.000Z",
		});

		expect(
			useAddictionStore.getState().addictions.map((item) => item.name),
		).toEqual(["Cigarro", "Doces"]);
		db.close();
	});

	test("registerRelapse reinicia a contagem e guarda o histórico", async () => {
		const db = await setup();
		const start = new Date("2026-10-01T00:00:00.000Z");
		const id = await useAddictionStore.getState().add(db, {
			name: "Cigarro",
			icon: "smoking",
			quitAt: start.toISOString(),
		});
		const relapseAt = new Date(start.getTime() + 10 * DAY);

		await useAddictionStore
			.getState()
			.registerRelapse(db, id, "dia difícil", relapseAt);

		const state = useAddictionStore.getState();
		expect(state.addictions[0].streakStartedAt).toBe(relapseAt.toISOString());
		expect(state.details[id].relapses).toEqual([
			expect.objectContaining({
				occurredAt: relapseAt.toISOString(),
				note: "dia difícil",
			}),
		]);
		expect(state.details[id].bestStreakMs).toBe(10 * DAY);
		db.close();
	});

	test("loadDetails traz recaídas e melhor período", async () => {
		const db = await setup();
		const id = await useAddictionStore.getState().add(db, {
			name: "Cigarro",
			icon: "smoking",
			quitAt: "2026-10-01T00:00:00.000Z",
		});

		await useAddictionStore
			.getState()
			.loadDetails(db, id, new Date("2026-10-21T00:00:00.000Z"));

		expect(useAddictionStore.getState().details[id]).toEqual({
			relapses: [],
			bestStreakMs: 20 * DAY,
		});
		db.close();
	});

	test("remove apaga o vício e seus detalhes", async () => {
		const db = await setup();
		const id = await useAddictionStore.getState().add(db, {
			name: "Cigarro",
			icon: "smoking",
			quitAt: "2026-10-01T00:00:00.000Z",
		});
		await useAddictionStore.getState().loadDetails(db, id);

		await useAddictionStore.getState().remove(db, id);

		expect(useAddictionStore.getState().addictions).toEqual([]);
		expect(useAddictionStore.getState().details[id]).toBeUndefined();
		const count = await db.getFirstAsync<{ total: number }>(
			"SELECT COUNT(*) AS total FROM addictions",
		);
		expect(count?.total).toBe(0);
		db.close();
	});
});
