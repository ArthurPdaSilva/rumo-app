import { STREAK_MILESTONE_DAYS } from "@/types";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export interface Streak {
	days: number;
	hours: number;
}

/** Dias e horas completos desde `startedAt`. Datas futuras contam como zero. */
export function getStreak(startedAt: string, now: Date): Streak {
	const elapsed = Math.max(0, now.getTime() - new Date(startedAt).getTime());
	return {
		days: Math.floor(elapsed / MS_PER_DAY),
		hours: Math.floor((elapsed % MS_PER_DAY) / MS_PER_HOUR),
	};
}

export function streakFromMs(elapsedMs: number): Streak {
	return getStreak(new Date(0).toISOString(), new Date(Math.max(0, elapsedMs)));
}

/** Próximo marco ainda não alcançado, ou `null` depois do último. */
export function getNextMilestone(days: number): number | null {
	return STREAK_MILESTONE_DAYS.find((milestone) => milestone > days) ?? null;
}

/** Texto curto do período, como "3 dias e 5 h" ou "2 horas". */
export function formatStreak({ days, hours }: Streak): string {
	if (days === 0) {
		if (hours === 0) return "menos de 1 hora";
		return hours === 1 ? "1 hora" : `${hours} horas`;
	}
	const dayLabel = days === 1 ? "1 dia" : `${days} dias`;
	return hours === 0 ? dayLabel : `${dayLabel} e ${hours} h`;
}
