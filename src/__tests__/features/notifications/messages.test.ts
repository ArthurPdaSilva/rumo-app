import {
	breakEndMessage,
	dailyMessage,
	focusEndMessage,
	milestoneMessage,
	relapseMessage,
	renderTemplate,
	routineMessage,
} from "../../../features/notifications/messages";

describe("messages", () => {
	test("renderTemplate troca variáveis e preserva as desconhecidas", () => {
		expect(renderTemplate("Oi, {username} {x}", { username: "Arthur" })).toBe(
			"Oi, Arthur {x}",
		);
	});

	test("marco com o nome do vício, no singular e no plural", () => {
		const base = { username: "Arthur", addiction: "Cigarro", discreet: false };
		expect(milestoneMessage({ ...base, days: 1 }).body).toBe(
			"Parabéns, Arthur! 1 dia sem Cigarro.",
		);
		expect(milestoneMessage({ ...base, days: 7 }).body).toBe(
			"Parabéns, Arthur! 7 dias sem Cigarro.",
		);
	});

	test("modo discreto não revela o vício", () => {
		const { body } = milestoneMessage({
			username: "Arthur",
			days: 30,
			addiction: "Cigarro",
			discreet: true,
		});
		expect(body).toBe("Parabéns, Arthur! 30 dias de caminhada.");
		expect(body).not.toContain("Cigarro");
	});

	test("mensagem diária, rotina e pomodoro", () => {
		expect(dailyMessage("Arthur").body).toBe(
			"Bom dia, Arthur. Hoje é mais um dia de cada vez.",
		);
		expect(
			routineMessage({ username: "Arthur", minutes: 10, activity: "Inglês" })
				.body,
		).toBe("Arthur, em 10 minutos: Inglês.");
		expect(
			routineMessage({ username: "Arthur", minutes: 1, activity: "Inglês" })
				.body,
		).toBe("Arthur, em 1 minuto: Inglês.");
		expect(focusEndMessage("Arthur", 5).body).toBe(
			"Foco concluído, Arthur! Pausa de 5 minutos.",
		);
		expect(breakEndMessage("Arthur").body).toBe(
			"Pausa terminada, Arthur. Pronto para outro foco?",
		);
	});

	test("sem nome usa um tratamento neutro", () => {
		expect(dailyMessage("  ").body).toContain("você");
	});

	test("mensagem após recaída acolhe e não cita o vício", () => {
		expect(relapseMessage("Arthur").body).toBe(
			"Arthur, recomeçar faz parte. Hoje é o dia 1 de novo.",
		);
	});
});
