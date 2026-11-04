import {
	adjustForQuietHours,
	MAX_MILESTONES_PER_ADDICTION,
	planNotifications,
	planPomodoroAlerts,
} from "../../../features/notifications/planner";
import type { Addiction, Profile, RoutineBlock } from "../../../types";

const profile: Profile = {
	username: "Arthur",
	notificationsEnabled: true,
	dailyMessageTime: "08:30",
	discreetMode: false,
};
// Quarta-feira, 4 de novembro de 2026, 14:15 (horário local).
const now = new Date(2026, 10, 4, 14, 15);

function addiction(overrides: Partial<Addiction> = {}): Addiction {
	return {
		id: 1,
		name: "Cigarro",
		icon: "leaf",
		quitAt: new Date(2026, 10, 1, 10, 0).toISOString(),
		createdAt: new Date(2026, 10, 1, 10, 0).toISOString(),
		archivedAt: null,
		streakStartedAt: new Date(2026, 10, 1, 10, 0).toISOString(),
		...overrides,
	};
}

function block(overrides: Partial<RoutineBlock> = {}): RoutineBlock {
	return {
		id: 7,
		weekdays: 2, // segunda
		startTime: "09:40",
		endTime: "10:40",
		title: "Concurso 1",
		notes: null,
		reminderMinutes: 10,
		importId: null,
		...overrides,
	};
}

const plan = (
	overrides: Partial<Parameters<typeof planNotifications>[0]> = {},
) =>
	planNotifications({
		profile,
		addictions: [],
		blocks: [],
		now,
		...overrides,
	});

describe("planNotifications", () => {
	test("sem perfil ou com notificações desligadas não planeja nada", () => {
		expect(plan({ profile: null })).toEqual([]);
		expect(
			plan({
				profile: { ...profile, notificationsEnabled: false },
				addictions: [addiction()],
				blocks: [block()],
			}),
		).toEqual([]);
	});

	test("mensagem diária no horário do perfil", () => {
		const [daily] = plan();
		expect(daily).toMatchObject({
			id: "daily",
			kind: "daily",
			channel: "support",
			trigger: { type: "daily", hour: 8, minute: 30 },
		});
		expect(daily?.body).toContain("Arthur");
	});

	test("horário diário inválido não gera a mensagem", () => {
		expect(plan({ profile: { ...profile, dailyMessageTime: "xx" } })).toEqual(
			[],
		);
	});

	test("marcos futuros, no máximo três por vício, ignorando os que já passaram", () => {
		// Início em 1/nov às 10h: já tem 3 dias, então 1 e 3 ficaram para trás.
		const marcos = plan({ addictions: [addiction()] }).filter(
			(item) => item.kind === "milestone",
		);
		expect(marcos).toHaveLength(MAX_MILESTONES_PER_ADDICTION);
		expect(marcos.map((item) => item.id)).toEqual([
			"milestone:1:7",
			"milestone:1:14",
			"milestone:1:30",
		]);
		expect(marcos[0]?.trigger).toEqual({
			type: "date",
			date: new Date(2026, 10, 8, 10, 0),
		});
		expect(marcos[0]?.body).toBe("Parabéns, Arthur! 7 dias sem Cigarro.");
	});

	test("vícios arquivados não geram marcos e o modo discreto esconde o nome", () => {
		expect(
			plan({ addictions: [addiction({ archivedAt: now.toISOString() })] }),
		).toHaveLength(1);
		const [marco] = plan({
			profile: { ...profile, discreetMode: true },
			addictions: [addiction()],
		}).filter((item) => item.kind === "milestone");
		expect(marco?.body).not.toContain("Cigarro");
	});

	test("marco de madrugada ou à noite vai para as 8h", () => {
		expect(adjustForQuietHours(new Date(2026, 10, 8, 3, 0))).toEqual(
			new Date(2026, 10, 8, 8, 0),
		);
		expect(adjustForQuietHours(new Date(2026, 10, 8, 23, 0))).toEqual(
			new Date(2026, 10, 9, 8, 0),
		);
		const meio = new Date(2026, 10, 8, 12, 0);
		expect(adjustForQuietHours(meio)).toBe(meio);
	});

	test("lembrete da rotina semanal, 10 min antes, um por dia do bloco", () => {
		const items = plan({
			blocks: [block({ weekdays: 2 | 8 })], // segunda e quarta
		}).filter((item) => item.kind === "routine");
		expect(items).toHaveLength(2);
		expect(items[0]).toMatchObject({
			id: "routine:7:1",
			channel: "reminders",
			trigger: { type: "weekly", weekday: 2, hour: 9, minute: 30 },
		});
		// Quarta: getDay() = 3, weekday do expo = 4.
		expect(items[1]?.trigger).toEqual({
			type: "weekly",
			weekday: 4,
			hour: 9,
			minute: 30,
		});
		expect(items[0]?.body).toBe("Arthur, em 10 minutos: Concurso 1.");
	});

	test("lembrete que cruza a meia-noite cai no dia anterior", () => {
		const [item] = plan({
			blocks: [block({ weekdays: 2, startTime: "00:05", reminderMinutes: 10 })],
		}).filter((entry) => entry.kind === "routine");
		// Segunda 00:05 menos 10 min = domingo 23:55 (weekday 1 no expo).
		expect(item?.trigger).toEqual({
			type: "weekly",
			weekday: 1,
			hour: 23,
			minute: 55,
		});
	});

	test("segunda-feira 00:05 e domingo viram sábado quando necessário", () => {
		const [item] = plan({
			blocks: [block({ weekdays: 1, startTime: "00:05", reminderMinutes: 10 })],
		}).filter((entry) => entry.kind === "routine");
		// Domingo 00:05 menos 10 min = sábado 23:55 (weekday 7).
		expect(item?.trigger).toMatchObject({ weekday: 7, hour: 23, minute: 55 });
	});

	test("lembrete 0 significa sem aviso", () => {
		expect(
			plan({ blocks: [block({ reminderMinutes: 0 })] }).filter(
				(item) => item.kind === "routine",
			),
		).toEqual([]);
	});
});

describe("planPomodoroAlerts", () => {
	test("avisos de fim de foco e de pausa com identificadores próprios", () => {
		const items = planPomodoroAlerts({
			username: "Arthur",
			focusEndsAt: 1000,
			breakMinutes: 5,
			breakEndsAt: 2000,
		});
		expect(items.map((item) => item.id)).toEqual([
			"pomodoro:focus-end",
			"pomodoro:break-end",
		]);
		expect(items[0]?.trigger).toEqual({ type: "date", date: new Date(1000) });
		expect(items[0]?.body).toBe("Foco concluído, Arthur! Pausa de 5 minutos.");
		expect(items[1]?.channel).toBe("focus");
	});
});
