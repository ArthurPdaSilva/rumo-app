/**
 * Textos das notificações. Tom sempre acolhedor: nada de culpa, ameaça ou
 * ironia. As variáveis são trocadas na hora de agendar.
 */
export const NOTIFICATION_TITLE = "Rumo";

const TEMPLATES = {
	milestone: "Parabéns, {username}! {days} {dayWord} sem {addiction}.",
	milestoneDiscreet: "Parabéns, {username}! {days} {dayWord} de caminhada.",
	daily: "Bom dia, {username}. Hoje é mais um dia de cada vez.",
	routine: "{username}, em {minutes} {minuteWord}: {activity}.",
	focusEnd: "Foco concluído, {username}! Pausa de {minutes} minutos.",
	breakEnd: "Pausa terminada, {username}. Pronto para outro foco?",
} as const;

export interface Message {
	title: string;
	body: string;
}

export function renderTemplate(
	template: string,
	values: Record<string, string | number>,
): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in values ? String(values[key]) : match,
	);
}

/** Nome para usar na mensagem; sem nome, um tratamento neutro. */
function nameOf(username: string): string {
	return username.trim() || "você";
}

function message(template: string, values: Record<string, string | number>) {
	return { title: NOTIFICATION_TITLE, body: renderTemplate(template, values) };
}

export function milestoneMessage(input: {
	username: string;
	days: number;
	addiction: string;
	discreet: boolean;
}): Message {
	return message(
		input.discreet ? TEMPLATES.milestoneDiscreet : TEMPLATES.milestone,
		{
			username: nameOf(input.username),
			days: input.days,
			dayWord: input.days === 1 ? "dia" : "dias",
			addiction: input.addiction,
		},
	);
}

export function dailyMessage(username: string): Message {
	return message(TEMPLATES.daily, { username: nameOf(username) });
}

export function routineMessage(input: {
	username: string;
	minutes: number;
	activity: string;
}): Message {
	return message(TEMPLATES.routine, {
		username: nameOf(input.username),
		minutes: input.minutes,
		minuteWord: input.minutes === 1 ? "minuto" : "minutos",
		activity: input.activity,
	});
}

export function focusEndMessage(
	username: string,
	breakMinutes: number,
): Message {
	return message(TEMPLATES.focusEnd, {
		username: nameOf(username),
		minutes: breakMinutes,
	});
}

export function breakEndMessage(username: string): Message {
	return message(TEMPLATES.breakEnd, { username: nameOf(username) });
}
