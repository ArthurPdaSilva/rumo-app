import { migrateDatabase } from "../../../database/client";
import {
	clearCalendarEventRows,
	deleteCalendarEventRow,
	getCalendarSettings,
	listCalendarEventRows,
	setCalendarId,
	setCalendarRecurring,
	upsertCalendarEventRow,
} from "../../../database/repositories/calendarRepository";
import { createTestDatabase } from "../../helpers/createTestDatabase";

async function setup() {
	const db = createTestDatabase();
	await migrateDatabase(db);
	return db;
}

const row = {
	blockId: 1,
	weekday: 3,
	calendarId: "cal",
	eventId: "ev",
	signature: "s",
};

describe("calendarRepository", () => {
	test("começa sem agenda escolhida e repetindo toda semana", async () => {
		const db = await setup();
		expect(await getCalendarSettings(db)).toEqual({
			calendarId: null,
			recurring: true,
		});
		db.close();
	});

	test("guarda a agenda e a preferência de repetição", async () => {
		const db = await setup();
		await setCalendarId(db, "abc");
		await setCalendarRecurring(db, false);
		expect(await getCalendarSettings(db)).toEqual({
			calendarId: "abc",
			recurring: false,
		});

		await setCalendarId(db, null);
		expect((await getCalendarSettings(db)).calendarId).toBeNull();
		db.close();
	});

	test("um evento por bloco e dia: gravar de novo substitui", async () => {
		const db = await setup();
		await upsertCalendarEventRow(db, row);
		await upsertCalendarEventRow(db, {
			...row,
			eventId: "ev2",
			signature: "t",
		});
		await upsertCalendarEventRow(db, { ...row, weekday: 5 });

		const rows = await listCalendarEventRows(db);
		expect(rows).toHaveLength(2);
		expect(rows.find((r) => r.weekday === 3)).toMatchObject({
			eventId: "ev2",
			signature: "t",
		});
		db.close();
	});

	test("apaga uma linha ou todas", async () => {
		const db = await setup();
		await upsertCalendarEventRow(db, row);
		await upsertCalendarEventRow(db, { ...row, weekday: 5 });

		await deleteCalendarEventRow(db, 1, 3);
		expect((await listCalendarEventRows(db)).map((r) => r.weekday)).toEqual([
			5,
		]);

		await clearCalendarEventRows(db);
		expect(await listCalendarEventRows(db)).toEqual([]);
		db.close();
	});

	test("o dia da semana só aceita 0 a 6", async () => {
		const db = await setup();
		await expect(
			upsertCalendarEventRow(db, { ...row, weekday: 9 }),
		).rejects.toThrow();
		db.close();
	});

	test("apagar o bloco não apaga o mapeamento (a próxima sincronização limpa a agenda)", async () => {
		const db = await setup();
		await db.execAsync(
			"INSERT INTO routine_blocks (id, weekdays, start_time, title) VALUES (1, 8, '09:00', 'X')",
		);
		await upsertCalendarEventRow(db, row);

		await db.execAsync("DELETE FROM routine_blocks WHERE id = 1");

		expect(await listCalendarEventRows(db)).toHaveLength(1);
		db.close();
	});
});
