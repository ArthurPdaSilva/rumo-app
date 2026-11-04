import { dayRange, weekRange } from "../../utils/week";

describe("week", () => {
	test("a semana começa na segunda e termina no domingo", () => {
		// Quarta-feira, 4 de novembro de 2026.
		const { start, end } = weekRange(new Date(2026, 10, 4, 14, 15));
		expect(start).toEqual(new Date(2026, 10, 2));
		expect(end).toEqual(new Date(2026, 10, 9));
	});

	test("o domingo pertence à semana que terminou nele", () => {
		const { start } = weekRange(new Date(2026, 10, 8, 23, 0));
		expect(start).toEqual(new Date(2026, 10, 2));
	});

	test("dayRange cobre o dia local inteiro", () => {
		const { start, end } = dayRange(new Date(2026, 10, 4, 14, 15));
		expect(start).toEqual(new Date(2026, 10, 4));
		expect(end).toEqual(new Date(2026, 10, 5));
	});
});
