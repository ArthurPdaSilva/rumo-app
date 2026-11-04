import { migrateDatabase } from "../../../../database/client";
import { useRoutineStore } from "../../../../features/routine/stores/RoutineStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

const input = {
	title: "Academia",
	startTime: "18:00",
	endTime: "19:30",
	weekdays: 62,
	reminderMinutes: 10,
	notes: null,
};

async function setup() {
	const db = createTestDatabase();
	await migrateDatabase(db);
	return db;
}

describe("useRoutineStore", () => {
	beforeEach(() => {
		useRoutineStore.setState({
			blocks: [],
			tasks: [],
			goals: [],
			isLoaded: false,
		});
	});

	test("load traz blocos, tarefas e metas", async () => {
		const db = await setup();
		await db.runAsync("INSERT INTO tasks (section, title) VALUES ('A', 't')");
		await db.runAsync(
			"INSERT INTO weekly_goals (activity, target_minutes) VALUES ('Inglês', 360)",
		);
		await useRoutineStore.getState().addBlock(db, input);

		await useRoutineStore.getState().load(db);

		const state = useRoutineStore.getState();
		expect(state.isLoaded).toBe(true);
		expect(state.blocks).toHaveLength(1);
		expect(state.tasks).toEqual([
			expect.objectContaining({ section: "A", title: "t", done: false }),
		]);
		expect(state.goals).toEqual([
			expect.objectContaining({ activity: "Inglês", targetMinutes: 360 }),
		]);
		db.close();
	});

	test("blocos vêm ordenados por horário", async () => {
		const db = await setup();
		const store = useRoutineStore.getState();
		await store.addBlock(db, { ...input, title: "Tarde", startTime: "14:00" });
		await store.addBlock(db, { ...input, title: "Manhã", startTime: "08:00" });

		expect(useRoutineStore.getState().blocks.map((b) => b.title)).toEqual([
			"Manhã",
			"Tarde",
		]);
		db.close();
	});

	test("editBlock e removeBlock persistem", async () => {
		const db = await setup();
		const id = await useRoutineStore.getState().addBlock(db, input);

		await useRoutineStore.getState().editBlock(db, id, {
			...input,
			title: "Treino",
			endTime: null,
			notes: "leve",
			reminderMinutes: 0,
		});
		expect(useRoutineStore.getState().blocks[0]).toMatchObject({
			title: "Treino",
			endTime: null,
			notes: "leve",
			reminderMinutes: 0,
		});

		await useRoutineStore.getState().removeBlock(db, id);
		expect(useRoutineStore.getState().blocks).toEqual([]);
		db.close();
	});

	test("toggleTask alterna, persiste e devolve o novo estado", async () => {
		const db = await setup();
		await db.runAsync("INSERT INTO tasks (section, title) VALUES ('A', 't')");
		await useRoutineStore.getState().load(db);
		const id = useRoutineStore.getState().tasks[0].id;

		expect(await useRoutineStore.getState().toggleTask(db, id)).toBe(true);
		expect(useRoutineStore.getState().tasks[0].done).toBe(true);
		const row = await db.getFirstAsync<{ done: number }>(
			"SELECT done FROM tasks",
		);
		expect(row?.done).toBe(1);

		expect(await useRoutineStore.getState().toggleTask(db, id)).toBe(false);
		await expect(
			useRoutineStore.getState().toggleTask(db, 999),
		).rejects.toThrow();
		db.close();
	});
});
