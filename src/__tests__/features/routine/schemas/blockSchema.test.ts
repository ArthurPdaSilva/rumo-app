import { blockFormSchema } from "../../../../features/routine/schemas/blockSchema";

const valid = {
	title: "Concurso 1",
	startTime: "09:40",
	endTime: "10:40",
	weekdays: 62,
	reminderMinutes: "10",
	notes: "",
};

function firstMessage(values: unknown): string | undefined {
	const result = blockFormSchema.safeParse(values);
	return result.success ? undefined : result.error.issues[0].message;
}

describe("blockFormSchema", () => {
	test("aceita um bloco válido, com fim e anotação opcionais", () => {
		expect(blockFormSchema.safeParse(valid).success).toBe(true);
		expect(blockFormSchema.safeParse({ ...valid, endTime: "" }).success).toBe(
			true,
		);
	});

	test("aceita bloco que cruza a meia-noite", () => {
		expect(
			blockFormSchema.safeParse({
				...valid,
				startTime: "23:30",
				endTime: "00:00",
			}).success,
		).toBe(true);
	});

	test("recusa nome vazio", () => {
		expect(firstMessage({ ...valid, title: "   " })).toBe(
			"Dê um nome ao bloco",
		);
	});

	test("recusa horários inválidos", () => {
		expect(firstMessage({ ...valid, startTime: "25:00" })).toBe(
			"Use o formato HH:MM",
		);
		expect(firstMessage({ ...valid, endTime: "10h" })).toBe(
			"Use o formato HH:MM",
		);
	});

	test("recusa fim igual ao início", () => {
		expect(firstMessage({ ...valid, endTime: "09:40" })).toBe(
			"O fim deve ser diferente do início",
		);
	});

	test("exige pelo menos um dia", () => {
		expect(firstMessage({ ...valid, weekdays: 0 })).toBe(
			"Escolha pelo menos um dia",
		);
	});

	test("valida o lembrete: número de 0 a 180", () => {
		expect(
			blockFormSchema.safeParse({ ...valid, reminderMinutes: "0" }).success,
		).toBe(true);
		expect(firstMessage({ ...valid, reminderMinutes: "dez" })).toBe(
			"Use um número de minutos",
		);
		expect(firstMessage({ ...valid, reminderMinutes: "181" })).toBe(
			"Use de 0 a 180 minutos",
		);
	});
});
