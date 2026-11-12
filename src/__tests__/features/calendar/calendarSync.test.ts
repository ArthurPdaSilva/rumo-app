import { migrateDatabase } from "../../../database/client";
import {
	listCalendarEventRows,
	setCalendarId,
	setCalendarRecurring,
} from "../../../database/repositories/calendarRepository";
import {
	CalendarNotSelectedError,
	type CalendarEventDetails,
	type CalendarGateway,
	removeRoutineEvents,
	syncRoutineToCalendar,
} from "../../../features/calendar/calendarSync";
import { createTestDatabase } from "../../helpers/createTestDatabase";

// Quarta-feira, 4 de novembro de 2026, 14:15 (horário local).
const NOW = new Date(2026, 10, 4, 14, 15);
const MON_WED_FRI = 2 | 8 | 32;

type Db = ReturnType<typeof createTestDatabase>;
let db: Db;

/** Agenda em memória: o que o Rumo cria e apaga fica visível para os testes. */
function makeGateway() {
	let counter = 0;
	const events = new Map<
		string,
		CalendarEventDetails & { calendarId: string }
	>();
	const gateway = {
		createEvent: jest.fn(
			async (calendarId: string, details: CalendarEventDetails) => {
				counter += 1;
				const id = `ev${counter}`;
				events.set(id, { ...details, calendarId });
				return id;
			},
		),
		deleteEvent: jest.fn(async (id: string) => {
			if (!events.delete(id)) throw new Error("evento não existe");
		}),
		eventExists: jest.fn(async (id: string) => events.has(id)),
	} satisfies CalendarGateway;
	return { gateway, events };
}

async function addBlock(
	title: string,
	weekdays = MON_WED_FRI,
	start = "09:00",
	end: string | null = "10:00",
) {
	const result = await db.runAsync(
		`INSERT INTO routine_blocks (weekdays, start_time, end_time, title, reminder_minutes)
		VALUES (?, ?, ?, ?, 10)`,
		weekdays,
		start,
		end,
		title,
	);
	return result.lastInsertRowId;
}

describe("syncRoutineToCalendar", () => {
	beforeEach(async () => {
		db = createTestDatabase();
		await migrateDatabase(db);
	});
	afterEach(() => db.close());

	test("sem agenda escolhida, avisa em vez de criar eventos", async () => {
		const { gateway } = makeGateway();
		await addBlock("Concurso");

		await expect(
			syncRoutineToCalendar(db, gateway, NOW),
		).rejects.toBeInstanceOf(CalendarNotSelectedError);
		expect(gateway.createEvent).not.toHaveBeenCalled();
	});

	test("cria um evento por bloco e dia, na agenda escolhida, e guarda o mapeamento", async () => {
		const { gateway, events } = makeGateway();
		await setCalendarId(db, "cal-google");
		await addBlock("Concurso");
		await addBlock("Inglês", 4, "20:00", "21:00");

		const result = await syncRoutineToCalendar(db, gateway, NOW);

		expect(result).toEqual({
			created: 4,
			updated: 0,
			removed: 0,
			unchanged: 0,
		});
		expect(
			[...events.values()].every((e) => e.calendarId === "cal-google"),
		).toBe(true);
		expect([...events.values()].map((e) => e.title).sort()).toEqual([
			"Concurso",
			"Concurso",
			"Concurso",
			"Inglês",
		]);
		expect(await listCalendarEventRows(db)).toHaveLength(4);
	});

	test("sincronizar de novo sem mudanças não cria nem apaga nada", async () => {
		const { gateway } = makeGateway();
		await setCalendarId(db, "cal");
		await addBlock("Concurso");
		await syncRoutineToCalendar(db, gateway, NOW);
		jest.clearAllMocks();

		const result = await syncRoutineToCalendar(db, gateway, NOW);

		expect(result).toEqual({
			created: 0,
			updated: 0,
			removed: 0,
			unchanged: 3,
		});
		expect(gateway.createEvent).not.toHaveBeenCalled();
		expect(gateway.deleteEvent).not.toHaveBeenCalled();
	});

	test("repetindo, o passar dos dias não recria os eventos", async () => {
		const { gateway } = makeGateway();
		await setCalendarId(db, "cal");
		await addBlock("Concurso");
		await syncRoutineToCalendar(db, gateway, NOW);

		const nextWeek = await syncRoutineToCalendar(
			db,
			gateway,
			new Date(2026, 10, 11, 8),
		);

		expect(nextWeek.unchanged).toBe(3);
	});

	test("editar um bloco troca os eventos dele (apaga o antigo, cria o novo)", async () => {
		const { gateway, events } = makeGateway();
		await setCalendarId(db, "cal");
		const id = await addBlock("Concurso");
		await syncRoutineToCalendar(db, gateway, NOW);

		await db.runAsync(
			"UPDATE routine_blocks SET title = 'Concurso 2', start_time = '10:00' WHERE id = ?",
			id,
		);
		const result = await syncRoutineToCalendar(db, gateway, NOW);

		expect(result).toEqual({
			created: 0,
			updated: 3,
			removed: 0,
			unchanged: 0,
		});
		expect(events.size).toBe(3);
		expect([...events.values()].every((e) => e.title === "Concurso 2")).toBe(
			true,
		);
	});

	test("apagar um bloco remove os eventos dele da agenda", async () => {
		const { gateway, events } = makeGateway();
		await setCalendarId(db, "cal");
		const keep = await addBlock("Manter", 2);
		const drop = await addBlock("Apagar", 2);
		await syncRoutineToCalendar(db, gateway, NOW);

		await db.runAsync("DELETE FROM routine_blocks WHERE id = ?", drop);
		const result = await syncRoutineToCalendar(db, gateway, NOW);

		expect(result).toMatchObject({ removed: 1, created: 0 });
		expect([...events.values()].map((e) => e.title)).toEqual(["Manter"]);
		expect((await listCalendarEventRows(db)).map((r) => r.blockId)).toEqual([
			keep,
		]);
	});

	test("tirar um dia do bloco remove só o evento daquele dia", async () => {
		const { gateway, events } = makeGateway();
		await setCalendarId(db, "cal");
		const id = await addBlock("Concurso");
		await syncRoutineToCalendar(db, gateway, NOW);

		await db.runAsync(
			"UPDATE routine_blocks SET weekdays = ? WHERE id = ?",
			2 | 8,
			id,
		);
		const result = await syncRoutineToCalendar(db, gateway, NOW);

		expect(result).toEqual({
			created: 0,
			updated: 0,
			removed: 1,
			unchanged: 2,
		});
		expect(events.size).toBe(2);
	});

	test("evento apagado à mão na agenda é recriado", async () => {
		const { gateway, events } = makeGateway();
		await setCalendarId(db, "cal");
		await addBlock("Concurso");
		await syncRoutineToCalendar(db, gateway, NOW);
		events.delete("ev1");

		const result = await syncRoutineToCalendar(db, gateway, NOW);

		expect(result).toEqual({
			created: 1,
			updated: 0,
			removed: 0,
			unchanged: 2,
		});
		expect(events.size).toBe(3);
	});

	test("trocar de agenda move os eventos: remove da antiga e cria na nova", async () => {
		const { gateway, events } = makeGateway();
		await setCalendarId(db, "velha");
		await addBlock("Concurso");
		await syncRoutineToCalendar(db, gateway, NOW);

		await setCalendarId(db, "nova");
		const result = await syncRoutineToCalendar(db, gateway, NOW);

		expect(result).toEqual({
			created: 3,
			updated: 0,
			removed: 3,
			unchanged: 0,
		});
		expect([...events.values()].every((e) => e.calendarId === "nova")).toBe(
			true,
		);
		expect(events.size).toBe(3);
	});

	test("ligar ou desligar a repetição atualiza todos os eventos", async () => {
		const { gateway, events } = makeGateway();
		await setCalendarId(db, "cal");
		await addBlock("Concurso");
		await syncRoutineToCalendar(db, gateway, NOW);

		await setCalendarRecurring(db, false);
		const result = await syncRoutineToCalendar(db, gateway, NOW);

		// Sem repetir, só sobram quarta e sexta nesta semana: a segunda já passou.
		expect(result).toMatchObject({ updated: 2, removed: 1, created: 0 });
		expect(events.size).toBe(2);
		expect([...events.values()].every((e) => !e.recurring)).toBe(true);
	});

	test("só mexe nos eventos que o Rumo criou", async () => {
		const { gateway, events } = makeGateway();
		events.set("meu-evento", {
			title: "Dentista",
			notes: null,
			startDate: NOW,
			endDate: NOW,
			recurring: false,
			calendarId: "cal",
		});
		await setCalendarId(db, "cal");
		await addBlock("Concurso", 2);
		await syncRoutineToCalendar(db, gateway, NOW);
		await db.runAsync("DELETE FROM routine_blocks");
		await syncRoutineToCalendar(db, gateway, NOW);

		expect(events.has("meu-evento")).toBe(true);
		expect(gateway.deleteEvent).not.toHaveBeenCalledWith("meu-evento");
	});

	test("falha no meio: o que já foi criado fica registrado e a nova tentativa não duplica", async () => {
		const { gateway, events } = makeGateway();
		await setCalendarId(db, "cal");
		await addBlock("Concurso");
		gateway.createEvent
			.mockImplementationOnce(async (calendarId, details) => {
				events.set("ok1", { ...details, calendarId });
				return "ok1";
			})
			.mockRejectedValueOnce(new Error("sem espaço"));

		await expect(syncRoutineToCalendar(db, gateway, NOW)).rejects.toThrow(
			"sem espaço",
		);
		expect(await listCalendarEventRows(db)).toHaveLength(1);

		const retry = await syncRoutineToCalendar(db, gateway, NOW);

		expect(retry).toMatchObject({ created: 2, unchanged: 1 });
		expect(events.size).toBe(3);
	});

	test("remover um evento que já não existe na agenda não é erro", async () => {
		const { gateway, events } = makeGateway();
		await setCalendarId(db, "cal");
		const id = await addBlock("Concurso", 2);
		await syncRoutineToCalendar(db, gateway, NOW);
		events.clear();
		await db.runAsync("DELETE FROM routine_blocks WHERE id = ?", id);

		await expect(
			syncRoutineToCalendar(db, gateway, NOW),
		).resolves.toMatchObject({
			removed: 1,
		});
	});
});

describe("removeRoutineEvents", () => {
	beforeEach(async () => {
		db = createTestDatabase();
		await migrateDatabase(db);
	});
	afterEach(() => db.close());

	test("apaga todos os eventos do Rumo, limpa o mapeamento e diz quantos eram", async () => {
		const { gateway, events } = makeGateway();
		await setCalendarId(db, "cal");
		await addBlock("Concurso");
		await syncRoutineToCalendar(db, gateway, NOW);

		const removed = await removeRoutineEvents(db, gateway);

		expect(removed).toBe(3);
		expect(events.size).toBe(0);
		expect(await listCalendarEventRows(db)).toEqual([]);
	});

	test("sem eventos devolve zero e tolera os que já sumiram da agenda", async () => {
		const { gateway, events } = makeGateway();
		expect(await removeRoutineEvents(db, gateway)).toBe(0);

		await setCalendarId(db, "cal");
		await addBlock("Concurso", 2);
		await syncRoutineToCalendar(db, gateway, NOW);
		events.clear();

		expect(await removeRoutineEvents(db, gateway)).toBe(1);
		expect(await listCalendarEventRows(db)).toEqual([]);
	});
});
