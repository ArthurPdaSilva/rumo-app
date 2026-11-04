import { minutesOfDay } from "@/utils/time";
import type { RoutineBlock } from "@/types";

export type BlockStatus = "current" | "next" | "past" | "future";

const DAY_MINUTES = 24 * 60;

/** Início e fim em minutos; se o fim não for depois do início, vai até a meia-noite. */
export function blockSpan(
	block: Pick<RoutineBlock, "startTime" | "endTime">,
): { start: number; end: number | null } | null {
	const start = minutesOfDay(block.startTime);
	if (start === null) return null;
	if (block.endTime === null) return { start, end: null };
	const end = minutesOfDay(block.endTime);
	if (end === null) return { start, end: null };
	return { start, end: end > start ? end : DAY_MINUTES };
}

/**
 * Estado de cada bloco do dia em relação ao horário atual: "current" (em
 * andamento), "next" (o primeiro que ainda vai começar), "past" ou "future".
 * Bloco sem fim vale do início até o próximo bloco.
 */
export function getBlockStatuses(
	blocks: RoutineBlock[],
	nowMinutes: number,
): Map<number, BlockStatus> {
	const ordered = [...blocks].sort((a, b) =>
		a.startTime.localeCompare(b.startTime),
	);
	const statuses = new Map<number, BlockStatus>();
	let nextAssigned = false;

	ordered.forEach((block, index) => {
		const span = blockSpan(block);
		if (!span) {
			statuses.set(block.id, "future");
			return;
		}
		const following = ordered[index + 1];
		const followingStart = following ? minutesOfDay(following.startTime) : null;
		const end = span.end ?? followingStart ?? DAY_MINUTES;

		if (nowMinutes >= span.start && nowMinutes < end) {
			statuses.set(block.id, "current");
		} else if (nowMinutes >= end) {
			statuses.set(block.id, "past");
		} else if (!nextAssigned) {
			statuses.set(block.id, "next");
			nextAssigned = true;
		} else {
			statuses.set(block.id, "future");
		}
	});
	return statuses;
}

export function formatTimeRange(
	block: Pick<RoutineBlock, "startTime" | "endTime">,
): string {
	return block.endTime
		? `${block.startTime}–${block.endTime}`
		: block.startTime;
}
