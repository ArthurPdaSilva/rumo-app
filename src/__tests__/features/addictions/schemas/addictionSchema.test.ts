import { createAddictionFormSchema } from "../../../../features/addictions/schemas/addictionSchema";

const now = new Date(2026, 10, 4, 12, 0);
const schema = createAddictionFormSchema(() => now);
const valid = {
	name: "Cigarro",
	icon: "smoking",
	quitDate: "01/10/2026",
	quitTime: "10:00",
};

function firstMessage(values: unknown): string | undefined {
	const result = schema.safeParse(values);
	return result.success ? undefined : result.error.issues[0].message;
}

describe("addictionFormSchema", () => {
	test("aceita um vício válido e apara o nome", () => {
		const result = schema.safeParse({ ...valid, name: "  Cigarro " });

		expect(result.success).toBe(true);
		if (result.success) expect(result.data.name).toBe("Cigarro");
	});

	test("aceita parar agora (mesmo horário do relógio)", () => {
		expect(
			schema.safeParse({ ...valid, quitDate: "04/11/2026", quitTime: "12:00" })
				.success,
		).toBe(true);
	});

	test("recusa nome curto e nome longo", () => {
		expect(firstMessage({ ...valid, name: "A" })).toBe(
			"Use pelo menos 2 caracteres",
		);
		expect(firstMessage({ ...valid, name: "a".repeat(41) })).toBe(
			"Use no máximo 40 caracteres",
		);
	});

	test("recusa ícone desconhecido", () => {
		expect(schema.safeParse({ ...valid, icon: "foguete" }).success).toBe(false);
	});

	test("recusa formatos de data e hora inválidos", () => {
		expect(firstMessage({ ...valid, quitDate: "2026-10-01" })).toBe(
			"Use o formato DD/MM/AAAA",
		);
		expect(firstMessage({ ...valid, quitTime: "9:00" })).toBe(
			"Use o formato HH:MM",
		);
	});

	test("recusa dia que não existe", () => {
		expect(firstMessage({ ...valid, quitDate: "31/02/2026" })).toBe(
			"Data inválida",
		);
	});

	test("recusa data no futuro", () => {
		expect(
			firstMessage({ ...valid, quitDate: "04/11/2026", quitTime: "12:01" }),
		).toBe("A data não pode estar no futuro");
	});
});
