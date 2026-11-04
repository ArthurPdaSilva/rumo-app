import {
	formatStreak,
	getNextMilestone,
	getStreak,
	streakFromMs,
} from "../../utils/streak";

describe("getStreak", () => {
	const now = new Date("2026-11-04T16:00:00.000Z");

	test("conta dias e horas completos", () => {
		expect(getStreak("2026-10-28T10:00:00.000Z", now)).toEqual({
			days: 7,
			hours: 6,
		});
	});

	test("começa em zero logo após parar", () => {
		expect(getStreak("2026-11-04T15:59:00.000Z", now)).toEqual({
			days: 0,
			hours: 0,
		});
	});

	test("data futura conta como zero", () => {
		expect(getStreak("2026-11-10T00:00:00.000Z", now)).toEqual({
			days: 0,
			hours: 0,
		});
	});
});

describe("streakFromMs", () => {
	test("converte milissegundos em dias e horas", () => {
		expect(streakFromMs(27 * 86_400_000 + 5 * 3_600_000)).toEqual({
			days: 27,
			hours: 5,
		});
	});

	test("valores negativos viram zero", () => {
		expect(streakFromMs(-5)).toEqual({ days: 0, hours: 0 });
	});
});

describe("getNextMilestone", () => {
	test.each([
		[0, 1],
		[1, 3],
		[6, 7],
		[7, 14],
		[89, 90],
		[364, 365],
	])("com %i dias o próximo marco é %i", (days, expected) => {
		expect(getNextMilestone(days)).toBe(expected);
	});

	test("depois do último marco não há próximo", () => {
		expect(getNextMilestone(365)).toBeNull();
	});
});

describe("formatStreak", () => {
	test.each([
		[{ days: 0, hours: 0 }, "menos de 1 hora"],
		[{ days: 0, hours: 1 }, "1 hora"],
		[{ days: 0, hours: 5 }, "5 horas"],
		[{ days: 1, hours: 0 }, "1 dia"],
		[{ days: 3, hours: 0 }, "3 dias"],
		[{ days: 7, hours: 6 }, "7 dias e 6 h"],
	])("formata %j como %s", (streak, expected) => {
		expect(formatStreak(streak)).toBe(expected);
	});
});
