import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	parseDuration,
	parseMarkdown,
	parseTimeRange,
	weekdaysFromHeading,
} from "../../../../tools/seed/parseMarkdown";

const seed = (name: string) =>
	readFileSync(join(__dirname, "../../../../seed", name), "utf8");

describe("parseTimeRange", () => {
	test.each([
		["09:40–10:40", "09:40", "10:40"],
		["09:40-10:40", "09:40", "10:40"],
		["9:05 — 10:00", "09:05", "10:00"],
		["19:15 em diante", "19:15", null],
		["~00:00", "00:00", null],
		["23:30–00:00", "23:30", "00:00"],
	])("lê %s", (cell, startTime, endTime) => {
		expect(parseTimeRange(cell)).toEqual({ startTime, endTime });
	});

	test.each(["", "cedo", "25:00", "10:75"])("recusa %s", (cell) => {
		expect(parseTimeRange(cell)).toBeNull();
	});
});

describe("parseDuration", () => {
	test.each([
		["4h", 240, null],
		["3h30", 210, null],
		["45 min", 45, null],
		["1h40 (20 min por dia útil)", 100, "20 min por dia útil"],
		["3h no total, girando", 180, "no total, girando"],
		["cerca de 4h25 (35 min por dia útil)", 265, "35 min por dia útil"],
		["**2h**", 120, null],
	])("lê %s", (value, minutes, note) => {
		expect(parseDuration(value)).toEqual({ minutes, note });
	});

	test.each(["", "girando", "0h"])("recusa %s", (value) => {
		expect(parseDuration(value)).toBeNull();
	});
});

describe("weekdaysFromHeading", () => {
	test("reconhece os títulos do Cronograma", () => {
		expect(weekdaysFromHeading("Dia útil (segunda a sexta)")).toBe(62);
		expect(weekdaysFromHeading("Sábado")).toBe(64);
		expect(weekdaysFromHeading("Domingo")).toBe(1);
		expect(weekdaysFromHeading("Fim de semana")).toBe(65);
		expect(weekdaysFromHeading("Terça e quinta")).toBe(4 | 16);
	});

	test("devolve null quando não há dia", () => {
		expect(weekdaysFromHeading("Resumo da semana")).toBeNull();
	});
});

describe("parseMarkdown", () => {
	test("lê tabelas de horário por dia", () => {
		const parsed = parseMarkdown(`## Sábado

| Horário | Atividade |
| --- | --- |
| 09:00–10:30 | **Casa**: plantas |
| 19:15 em diante | Livre |
`);

		expect(parsed.routineBlocks).toEqual([
			{
				weekdays: 64,
				startTime: "09:00",
				endTime: "10:30",
				title: "Casa: plantas",
			},
			{ weekdays: 64, startTime: "19:15", endTime: null, title: "Livre" },
		]);
	});

	test("avisa e ignora tabela de horários sem dia reconhecível", () => {
		const parsed = parseMarkdown(`## Qualquer coisa

| Horário | Atividade |
| --- | --- |
| 09:00–10:00 | Algo |
`);

		expect(parsed.routineBlocks).toEqual([]);
		expect(parsed.warnings).toHaveLength(1);
	});

	test("conta linhas de horário inválidas como aviso", () => {
		const parsed = parseMarkdown(`## Domingo

| Horário | Atividade |
| --- | --- |
| de manhã | Algo |
| 10:00–11:00 | Outro |
`);

		expect(parsed.routineBlocks).toHaveLength(1);
		expect(parsed.warnings[0]).toContain("1 linha");
	});

	test("lê tarefas por seção, com estado concluído", () => {
		const parsed = parseMarkdown(`## 1. Português — 499 págs

- [ ] **Classes de palavras** — Aula 03
- [x] **Pontuação** — Aula 10
- item comum, não é tarefa

## Informática

- [ ] Aula 01 · Protocolos · 38 págs (\`pasta/arquivo.pdf\`)
`);

		expect(parsed.tasks).toEqual([
			{ section: "Português", title: "Classes de palavras", done: false },
			{ section: "Português", title: "Pontuação", done: true },
			{ section: "Informática", title: "Aula 01 · Protocolos", done: false },
		]);
	});

	test("lê metas semanais e guarda o texto extra como nota", () => {
		const parsed = parseMarkdown(`| Atividade | Horas por semana |
| --- | --- |
| Inglês | 6h (1h por dia útil + 1h no sábado) |
| AWS | 2h |
| Sem horas | variável |
`);

		expect(parsed.weeklyGoals).toEqual([
			{
				activity: "Inglês",
				targetMinutes: 360,
				note: "1h por dia útil + 1h no sábado",
			},
			{ activity: "AWS", targetMinutes: 120, note: null },
		]);
	});

	test("ignora metas repetidas e avisa", () => {
		const parsed = parseMarkdown(`| Atividade | Horas por semana |
| --- | --- |
| Inglês | 6h |
| inglês | 2h |
`);

		expect(parsed.weeklyGoals).toHaveLength(1);
		expect(parsed.weeklyGoals[0].targetMinutes).toBe(360);
		expect(parsed.warnings).toHaveLength(1);
	});

	test("ignora front-matter e aceita quebras de linha do Windows", () => {
		const parsed = parseMarkdown(
			"---\r\ntags: [a]\r\n---\r\n## Domingo\r\n\r\n| Horário | Atividade |\r\n| --- | --- |\r\n| 10:00–11:00 | Missa |\r\n",
		);

		expect(parsed.routineBlocks).toHaveLength(1);
	});

	test("não quebra com texto vazio ou sem estrutura", () => {
		expect(parseMarkdown("")).toEqual({
			routineBlocks: [],
			tasks: [],
			weeklyGoals: [],
			warnings: [],
		});
		expect(parseMarkdown("só um parágrafo").tasks).toEqual([]);
	});
});

describe("arquivos de exemplo (seed/)", () => {
	test("Cronograma.md preenche rotina e metas", () => {
		const parsed = parseMarkdown(seed("Cronograma.md"));

		const workdays = parsed.routineBlocks.filter((b) => b.weekdays === 62);
		const saturday = parsed.routineBlocks.filter((b) => b.weekdays === 64);
		const sunday = parsed.routineBlocks.filter((b) => b.weekdays === 1);
		expect(workdays.length).toBeGreaterThan(15);
		expect(saturday.length).toBeGreaterThan(10);
		expect(sunday.length).toBeGreaterThan(10);
		// Os blocos de concurso trazem a matéria de cada dia, sem "Concurso 1/2/3".
		expect(parsed.routineBlocks).toContainEqual({
			weekdays: 2,
			startTime: "09:40",
			endTime: "10:40",
			title: "Português",
		});
		expect(parsed.routineBlocks).toContainEqual({
			weekdays: 4,
			startTime: "11:00",
			endTime: "12:00",
			title: "Matemática Básica",
		});
		expect(
			parsed.routineBlocks.some((b) => /^Concurso [123]\b/.test(b.title)),
		).toBe(false);
		expect(parsed.tasks).toEqual([]);

		const goal = (name: string) =>
			parsed.weeklyGoals.find((item) => item.activity === name);
		expect(goal("Português")?.targetMinutes).toBe(240);
		expect(goal("Direito Constitucional")?.targetMinutes).toBe(210);
		expect(goal("Concurso (ciclo)")?.targetMinutes).toBe(1230);
		expect(goal("Inglês")?.targetMinutes).toBe(360);
		expect(goal("Música")?.targetMinutes).toBe(265);
		expect(goal("Caminhada ou mobilidade")?.targetMinutes).toBe(100);
		expect(parsed.warnings).toEqual([]);
	});

	test("Rota_de_estudos.md vira tarefas agrupadas por matéria", () => {
		const parsed = parseMarkdown(seed("Rota_de_estudos.md"));

		expect(parsed.tasks).toHaveLength(80);
		expect(parsed.routineBlocks).toEqual([]);
		expect([...new Set(parsed.tasks.map((task) => task.section))]).toEqual([
			"Português",
			"Direito Constitucional",
			"Direito Administrativo",
			"Raciocínio Lógico",
			"Matemática Básica",
			"Informática",
		]);
		expect(parsed.tasks).toContainEqual({
			section: "Português",
			title: "Classes de palavras",
			done: false,
		});
		expect(parsed.tasks.filter((task) => task.done)).toEqual([
			{
				section: "Direito Constitucional",
				title: "Estatísticas da banca (leitura rápida)",
				done: true,
			},
		]);
	});
});
