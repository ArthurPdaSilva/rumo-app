import { planCalendarEvents } from "../../../features/calendar/planner";
import type { RoutineBlock } from "../../../types";

// Quarta-feira, 4 de novembro de 2026, 14:15 (horário local).
const WED = new Date(2026, 10, 4, 14, 15);
const MON = 2;
const WED_BIT = 8;
const FRI = 32;
const SUN = 1;

function block(overrides: Partial<RoutineBlock> = {}): RoutineBlock {
	return {
		id: 1,
		weekdays: MON | WED_BIT | FRI,
		startTime: "09:00",
		endTime: "10:30",
		title: "Concurso",
		notes: null,
		reminderMinutes: 10,
		importId: null,
		...overrides,
	};
}

const at = (day: number, hour: number, minute = 0) =>
	new Date(2026, 10, day, hour, minute);

describe("planCalendarEvents", () => {
	test("um evento por dia do bloco, começando na próxima data de cada dia (a partir de hoje)", () => {
		const events = planCalendarEvents([block()], {
			today: WED,
			recurring: true,
		});

		expect(events.map((e) => [e.weekday, e.startDate, e.endDate])).toEqual([
			// Segunda já passou nesta semana: começa na próxima, 9 de novembro.
			[1, at(9, 9), at(9, 10, 30)],
			// Hoje conta mesmo que o horário já tenha passado.
			[3, at(4, 9), at(4, 10, 30)],
			[5, at(6, 9), at(6, 10, 30)],
		]);
		for (const event of events) {
			expect(event).toMatchObject({
				blockId: 1,
				title: "Concurso",
				recurring: true,
			});
		}
	});

	test("sem repetir, só entram os dias que restam da semana (segunda a domingo)", () => {
		const events = planCalendarEvents(
			[block({ weekdays: MON | WED_BIT | FRI | SUN })],
			{ today: WED, recurring: false },
		);

		// Seg 9/11 já é da semana seguinte; domingo 8/11 ainda é desta.
		expect(
			events.map((e) => e.startDate.getDate()).sort((a, b) => a - b),
		).toEqual([4, 6, 8]);
		expect(events.every((e) => !e.recurring)).toBe(true);
	});

	test("sem horário de fim ou com fim igual ao início: 30 minutos", () => {
		const [noEnd] = planCalendarEvents(
			[block({ endTime: null, weekdays: WED_BIT })],
			{
				today: WED,
				recurring: true,
			},
		);
		const [sameEnd] = planCalendarEvents(
			[block({ endTime: "09:00", weekdays: WED_BIT })],
			{ today: WED, recurring: true },
		);

		expect(noEnd.endDate).toEqual(at(4, 9, 30));
		expect(sameEnd.endDate).toEqual(at(4, 9, 30));
	});

	test("bloco que termina depois da meia-noite acaba no dia seguinte", () => {
		const [event] = planCalendarEvents(
			[block({ startTime: "22:00", endTime: "01:00", weekdays: WED_BIT })],
			{ today: WED, recurring: true },
		);

		expect(event.startDate).toEqual(at(4, 22));
		expect(event.endDate).toEqual(at(5, 1));
	});

	test("início inválido não gera evento", () => {
		const events = planCalendarEvents([block({ startTime: "9h" })], {
			today: WED,
			recurring: true,
		});

		expect(events).toEqual([]);
	});

	test("bloco sem nenhum dia não gera evento", () => {
		expect(
			planCalendarEvents([block({ weekdays: 0 })], {
				today: WED,
				recurring: true,
			}),
		).toEqual([]);
	});

	describe("assinatura", () => {
		test("repetindo, não muda com o passar dos dias", () => {
			const today = planCalendarEvents([block()], {
				today: WED,
				recurring: true,
			});
			const nextWeek = planCalendarEvents([block()], {
				today: new Date(2026, 10, 11, 8, 0),
				recurring: true,
			});

			expect(nextWeek.map((e) => e.signature)).toEqual(
				today.map((e) => e.signature),
			);
		});

		test("muda quando título, notas, horário ou o modo de repetição mudam", () => {
			const base = planCalendarEvents([block()], {
				today: WED,
				recurring: true,
			})[0];
			const changed = [
				block({ title: "Outro" }),
				block({ notes: "Levar caderno" }),
				block({ startTime: "09:30" }),
				block({ endTime: "11:00" }),
			].map(
				(b) =>
					planCalendarEvents([b], { today: WED, recurring: true })[0].signature,
			);
			const single = planCalendarEvents([block()], {
				today: WED,
				recurring: false,
			})[0];

			for (const signature of changed)
				expect(signature).not.toBe(base.signature);
			expect(single.signature).not.toBe(base.signature);
		});

		test("sem repetir, inclui a data: a semana seguinte vira outro evento", () => {
			const thisWeek = planCalendarEvents([block()], {
				today: WED,
				recurring: false,
			});
			const nextWeek = planCalendarEvents([block()], {
				today: new Date(2026, 10, 11, 8, 0),
				recurring: false,
			});

			expect(nextWeek[0].signature).not.toBe(thisWeek[0].signature);
		});
	});
});
