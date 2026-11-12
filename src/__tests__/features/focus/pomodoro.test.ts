import {
	breakAfterFocus,
	formatClock,
	isPhaseExpired,
	type PhaseTiming,
	phaseDurationMs,
	phaseEndsAtMs,
	phaseMinutes,
	phaseRemainingMs,
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

	describe("fase com pausa", () => {
		const MIN = 60_000;
		const T0 = 1_000_000;
		const timing = (overrides: Partial<PhaseTiming> = {}): PhaseTiming => ({
			startedAtMs: T0,
			durationMs: 25 * MIN,
			pausedAtMs: null,
			pausedTotalMs: 0,
			...overrides,
		});

		test("correndo: o fim é início + duração e o restante diminui com o relógio", () => {
			expect(phaseEndsAtMs(timing())).toBe(T0 + 25 * MIN);
			expect(phaseRemainingMs(timing(), T0 + 10 * MIN)).toBe(15 * MIN);
			expect(phaseRemainingMs(timing(), T0 + 40 * MIN)).toBe(0);
		});

		test("cada pausa já encerrada empurra o fim", () => {
			const t = timing({ pausedTotalMs: 30 * MIN });
			expect(phaseEndsAtMs(t)).toBe(T0 + 55 * MIN);
			expect(phaseRemainingMs(t, T0 + 40 * MIN)).toBe(15 * MIN);
		});

		test("pausada: o restante fica congelado, não importa quanto tempo passe", () => {
			const t = timing({ pausedAtMs: T0 + 10 * MIN });
			expect(phaseRemainingMs(t, T0 + 11 * MIN)).toBe(15 * MIN);
			expect(phaseRemainingMs(t, T0 + 500 * MIN)).toBe(15 * MIN);
		});

		test("só vence correndo; uma fase pausada nunca expira sozinha", () => {
			expect(isPhaseExpired(timing(), T0 + 25 * MIN - 1)).toBe(false);
			expect(isPhaseExpired(timing(), T0 + 25 * MIN)).toBe(true);
			expect(
				isPhaseExpired(timing({ pausedAtMs: T0 + MIN }), T0 + 999 * MIN),
			).toBe(false);
		});
	});
});
