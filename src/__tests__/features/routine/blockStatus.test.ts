import {
	blockSpan,
	formatTimeRange,
	getBlockStatuses,
} from "../../../features/routine/blockStatus";
import type { RoutineBlock } from "../../../types";

function block(
	id: number,
	startTime: string,
	endTime: string | null,
): RoutineBlock {
	return {
		id,
		weekdays: 62,
		startTime,
		endTime,
		title: `b${id}`,
		notes: null,
		reminderMinutes: 10,
		importId: null,
	};
}

const at = (hours: number, minutes = 0) => hours * 60 + minutes;

describe("getBlockStatuses", () => {
	const blocks = [
		block(1, "09:00", "10:00"),
		block(2, "10:00", "11:00"),
		block(3, "14:00", "15:00"),
		block(4, "16:00", "17:00"),
	];

	test("marca o atual, o próximo e os passados", () => {
		const statuses = getBlockStatuses(blocks, at(14, 30));

		expect([...statuses.values()]).toEqual(["past", "past", "current", "next"]);
	});

	test("entre blocos, o próximo é o primeiro que ainda vai começar", () => {
		const statuses = getBlockStatuses(blocks, at(12));

		expect(statuses.get(3)).toBe("next");
		expect(statuses.get(4)).toBe("future");
		expect(statuses.get(2)).toBe("past");
	});

	test("o fim é exclusivo e o início é inclusivo", () => {
		expect(getBlockStatuses(blocks, at(10)).get(2)).toBe("current");
		expect(getBlockStatuses(blocks, at(10)).get(1)).toBe("past");
	});

	test("ordena por horário mesmo com a lista fora de ordem", () => {
		const statuses = getBlockStatuses([blocks[3], blocks[0]], at(8));

		expect(statuses.get(1)).toBe("next");
		expect(statuses.get(4)).toBe("future");
	});

	test("bloco que termina às 00:00 vai até o fim do dia", () => {
		const night = [block(1, "23:30", "00:00")];

		expect(getBlockStatuses(night, at(23, 45)).get(1)).toBe("current");
		expect(getBlockStatuses(night, at(23, 0)).get(1)).toBe("next");
	});

	test("bloco sem fim vale até o início do próximo", () => {
		const open = [block(1, "19:15", null), block(2, "23:00", "23:30")];

		expect(getBlockStatuses(open, at(21)).get(1)).toBe("current");
		expect(getBlockStatuses(open, at(23)).get(1)).toBe("past");
		expect(getBlockStatuses(open, at(23)).get(2)).toBe("current");
	});

	test("sem blocos, nada a marcar", () => {
		expect(getBlockStatuses([], at(10)).size).toBe(0);
	});
});

describe("blockSpan e formatTimeRange", () => {
	test("calcula o intervalo", () => {
		expect(blockSpan({ startTime: "09:00", endTime: "10:30" })).toEqual({
			start: 540,
			end: 630,
		});
		expect(blockSpan({ startTime: "09:00", endTime: null })).toEqual({
			start: 540,
			end: null,
		});
		expect(blockSpan({ startTime: "xx", endTime: null })).toBeNull();
	});

	test("formata com travessão", () => {
		expect(formatTimeRange({ startTime: "09:00", endTime: "10:30" })).toBe(
			"09:00–10:30",
		);
		expect(formatTimeRange({ startTime: "19:15", endTime: null })).toBe(
			"19:15",
		);
	});
});
