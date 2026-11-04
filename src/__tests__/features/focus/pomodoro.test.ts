import {
	breakAfterFocus,
	formatClock,
	phaseDurationMs,
	phaseMinutes,
} from "../../../features/focus/pomodoro";

describe("pomodoro", () => {
	test("tempos fixos 25/5/15", () => {
		expect(phaseMinutes("focus")).toBe(25);
		expect(phaseMinutes("break")).toBe(5);
		expect(phaseMinutes("longBreak")).toBe(15);
		expect(phaseDurationMs("focus")).toBe(25 * 60_000);
	});

	test("pausa longa só depois do quarto foco", () => {
		expect(breakAfterFocus(1)).toBe("break");
		expect(breakAfterFocus(3)).toBe("break");
		expect(breakAfterFocus(4)).toBe("longBreak");
	});

	test("formatClock arredonda para cima e não fica negativo", () => {
		expect(formatClock(25 * 60_000)).toBe("25:00");
		expect(formatClock(61_000)).toBe("01:01");
		expect(formatClock(1)).toBe("00:01");
		expect(formatClock(-500)).toBe("00:00");
	});
});
