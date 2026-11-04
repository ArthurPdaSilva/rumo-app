import {
	breakEndMessage,
	dailyMessage,
	focusEndMessage,
	type Message,
	milestoneMessage,
	relapseMessage,
	routineMessage,
} from "@/features/notifications/messages";
import {
	type Addiction,
	type Profile,
	type RoutineBlock,
	STREAK_MILESTONE_DAYS,
} from "@/types";
import { minutesOfDay } from "@/utils/time";
import { hasWeekday } from "@/utils/weekdays";

export type NotificationKind =
	| "milestone"
	| "relapse"
	| "daily"
	| "routine"
	| "pomodoroFocus"
	| "pomodoroBreak";

/** Cada tipo vai para um canal do Android, que o usuário pode silenciar à parte. */
export type ChannelKey = "reminders" | "support" | "focus";

export type PlannedTrigger =
	| { type: "date"; date: Date }
	| { type: "daily"; hour: number; minute: number }
	/** `weekday` segue o expo-notifications: 1 = domingo ... 7 = sábado. */
	| { type: "weekly"; weekday: number; hour: number; minute: number };

export interface PlannedNotification extends Message {
	/** Identificador estável: reagendar o mesmo item substitui o anterior. */
	id: string;
	kind: NotificationKind;
	channel: ChannelKey;
	trigger: PlannedTrigger;
}

export const POMODORO_ID_PREFIX = "pomodoro:";
export const MAX_MILESTONES_PER_ADDICTION = 3;
const DAY_MS = 86_400_000;
/** Quanto tempo depois da recaída chega a mensagem de acolhimento. */
export const RELAPSE_FOLLOWUP_MS = 2 * 3_600_000;
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 8;

/** Marcos que caem de madrugada ou à noite vão para as 8h seguintes. */
export function adjustForQuietHours(date: Date): Date {
	const hour = date.getHours();
	if (hour >= QUIET_START_HOUR) {
		const next = new Date(date);
		next.setDate(next.getDate() + 1);
		next.setHours(QUIET_END_HOUR, 0, 0, 0);
		return next;
	}
	if (hour < QUIET_END_HOUR) {
		const same = new Date(date);
		same.setHours(QUIET_END_HOUR, 0, 0, 0);
		return same;
	}
	return date;
}

function splitTime(value: string): { hour: number; minute: number } | null {
	const total = minutesOfDay(value);
	if (total === null) return null;
	return { hour: Math.floor(total / 60), minute: total % 60 };
}

function planMilestones(
	profile: Profile,
	addictions: Addiction[],
	now: Date,
): PlannedNotification[] {
	const planned: PlannedNotification[] = [];
	for (const addiction of addictions) {
		if (addiction.archivedAt) continue;
		const start = new Date(addiction.streakStartedAt).getTime();
		if (Number.isNaN(start)) continue;
		let count = 0;
		for (const days of STREAK_MILESTONE_DAYS) {
			if (count >= MAX_MILESTONES_PER_ADDICTION) break;
			const at = adjustForQuietHours(new Date(start + days * DAY_MS));
			if (at.getTime() <= now.getTime()) continue;
			count += 1;
			planned.push({
				id: `milestone:${addiction.id}:${days}`,
				kind: "milestone",
				channel: "support",
				...milestoneMessage({
					username: profile.username,
					days,
					addiction: addiction.name,
					discreet: profile.discreetMode,
				}),
				trigger: { type: "date", date: at },
			});
		}
	}
	return planned;
}

/**
 * Depois de uma recaída o início da contagem deixa de ser `quitAt`. Dessa
 * diferença sai a mensagem de acolhimento, sem precisar ler a tabela de recaídas.
 */
function planRelapseFollowUps(
	profile: Profile,
	addictions: Addiction[],
	now: Date,
): PlannedNotification[] {
	const planned: PlannedNotification[] = [];
	for (const addiction of addictions) {
		if (
			addiction.archivedAt ||
			addiction.streakStartedAt === addiction.quitAt
		) {
			continue;
		}
		const start = new Date(addiction.streakStartedAt).getTime();
		if (Number.isNaN(start)) continue;
		const at = adjustForQuietHours(new Date(start + RELAPSE_FOLLOWUP_MS));
		if (at.getTime() <= now.getTime()) continue;
		planned.push({
			id: `relapse:${addiction.id}`,
			kind: "relapse",
			channel: "support",
			...relapseMessage(profile.username),
			trigger: { type: "date", date: at },
		});
	}
	return planned;
}

function planRoutine(
	profile: Profile,
	blocks: RoutineBlock[],
): PlannedNotification[] {
	const planned: PlannedNotification[] = [];
	for (const block of blocks) {
		// 0 minutos de antecedência significa "sem lembrete".
		if (block.reminderMinutes <= 0) continue;
		const start = minutesOfDay(block.startTime);
		if (start === null) continue;
		for (let day = 0; day < 7; day++) {
			if (!hasWeekday(block.weekdays, day)) continue;
			let minutes = start - block.reminderMinutes;
			let weekday = day;
			// Lembrete que cai antes da meia-noite pertence ao dia anterior.
			if (minutes < 0) {
				minutes += 1440;
				weekday = (day + 6) % 7;
			}
			planned.push({
				id: `routine:${block.id}:${day}`,
				kind: "routine",
				channel: "reminders",
				...routineMessage({
					username: profile.username,
					minutes: block.reminderMinutes,
					activity: block.title,
				}),
				trigger: {
					type: "weekly",
					weekday: weekday + 1,
					hour: Math.floor(minutes / 60),
					minute: minutes % 60,
				},
			});
		}
	}
	return planned;
}

export interface PlanInput {
	profile: Profile | null;
	addictions: Addiction[];
	blocks: RoutineBlock[];
	now: Date;
}

/** Tudo o que deve estar agendado agora, menos os avisos do Pomodoro. */
export function planNotifications(input: PlanInput): PlannedNotification[] {
	const { profile } = input;
	if (!profile?.notificationsEnabled) return [];

	const planned: PlannedNotification[] = [];
	const daily = splitTime(profile.dailyMessageTime);
	if (daily) {
		planned.push({
			id: "daily",
			kind: "daily",
			channel: "support",
			...dailyMessage(profile.username),
			trigger: { type: "daily", ...daily },
		});
	}
	planned.push(
		...planMilestones(profile, input.addictions, input.now),
		...planRelapseFollowUps(profile, input.addictions, input.now),
		...planRoutine(profile, input.blocks),
	);
	return planned;
}

/** Avisos do Pomodoro: fim do foco e fim da pausa seguinte. */
export function planPomodoroAlerts(input: {
	username: string;
	focusEndsAt: number;
	breakMinutes: number;
	breakEndsAt: number;
}): PlannedNotification[] {
	return [
		{
			id: `${POMODORO_ID_PREFIX}focus-end`,
			kind: "pomodoroFocus",
			channel: "focus",
			...focusEndMessage(input.username, input.breakMinutes),
			trigger: { type: "date", date: new Date(input.focusEndsAt) },
		},
		{
			id: `${POMODORO_ID_PREFIX}break-end`,
			kind: "pomodoroBreak",
			channel: "focus",
			...breakEndMessage(input.username),
			trigger: { type: "date", date: new Date(input.breakEndsAt) },
		},
	];
}
