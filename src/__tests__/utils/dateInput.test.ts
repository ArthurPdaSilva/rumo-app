import {
	formatDateInput,
	formatDateTimeLabel,
	formatTimeInput,
	parseLocalDateTime,
} from "../../utils/dateInput";

describe("parseLocalDateTime", () => {
	test("converte data e hora locais", () => {
		const result = parseLocalDateTime("01/10/2026", "10:30");

		expect(result?.getTime()).toBe(new Date(2026, 9, 1, 10, 30).getTime());
	});

	test.each([
		["31/02/2026", "10:00"],
		["00/10/2026", "10:00"],
		["01/13/2026", "10:00"],
		["01/10/2026", "24:00"],
		["01/10/2026", "10:60"],
		["1/10/2026", "10:00"],
		["01/10/2026", "10h"],
		["", ""],
	])("recusa %s %s", (date, time) => {
		expect(parseLocalDateTime(date, time)).toBeNull();
	});

	test("ignora espaços nas pontas", () => {
		expect(parseLocalDateTime(" 01/10/2026 ", " 09:05 ")).not.toBeNull();
	});
});

describe("formatação", () => {
	const date = new Date(2026, 9, 1, 9, 5);

	test("formata data e hora para os campos", () => {
		expect(formatDateInput(date)).toBe("01/10/2026");
		expect(formatTimeInput(date)).toBe("09:05");
	});

	test("formata o rótulo com data e hora", () => {
		expect(formatDateTimeLabel(date.toISOString())).toBe("01/10/2026 às 09:05");
	});
});
