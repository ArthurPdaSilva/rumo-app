import {
	dayBit,
	describeWeekdays,
	hasWeekday,
	toggleWeekday,
} from "../../utils/weekdays";

describe("weekdays", () => {
	test("a máscara segue Date#getDay(): domingo = 1, sábado = 64", () => {
		expect(dayBit(0)).toBe(1);
		expect(dayBit(1)).toBe(2);
		expect(dayBit(6)).toBe(64);
	});

	test("hasWeekday e toggleWeekday", () => {
		const mask = dayBit(1) | dayBit(3);

		expect(hasWeekday(mask, 1)).toBe(true);
		expect(hasWeekday(mask, 2)).toBe(false);
		expect(toggleWeekday(mask, 2)).toBe(dayBit(1) | dayBit(2) | dayBit(3));
		expect(toggleWeekday(mask, 1)).toBe(dayBit(3));
	});

	test.each([
		[62, "Dias úteis"],
		[64, "Sábado"],
		[1, "Domingo"],
		[65, "Fim de semana"],
		[127, "Todos os dias"],
		[0, "Nenhum dia"],
		[2 | 8 | 32, "Seg, Qua e Sex"],
	])("descreve a máscara %i como %s", (mask, text) => {
		expect(describeWeekdays(mask)).toBe(text);
	});
});
