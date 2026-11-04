import {
	formatMinutes,
	isValidTime,
	minutesOfDate,
	minutesOfDay,
} from "../../utils/time";

describe("time", () => {
	test.each(["00:00", "09:40", "23:59"])("%s é válido", (value) => {
		expect(isValidTime(value)).toBe(true);
	});

	test.each(["24:00", "9:40", "10:60", "", "10h"])("%s é inválido", (value) => {
		expect(isValidTime(value)).toBe(false);
	});

	test("minutesOfDay e minutesOfDate", () => {
		expect(minutesOfDay("09:40")).toBe(580);
		expect(minutesOfDay("x")).toBeNull();
		expect(minutesOfDate(new Date(2026, 10, 4, 14, 15))).toBe(855);
	});

	test.each([
		[240, "4h"],
		[210, "3h30"],
		[45, "45 min"],
		[65, "1h05"],
	])("formatMinutes(%i) = %s", (total, text) => {
		expect(formatMinutes(total)).toBe(text);
	});
});
