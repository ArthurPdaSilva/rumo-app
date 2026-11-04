import { WEEKDAY_BITS, WORKDAYS_MASK } from "@/types";
import {
	cleanSectionTitle,
	normalizeKey,
	normalizeNewlines,
	readTables,
	readTasks,
	stripFrontMatter,
	toPlainText,
} from "./markdown";
import type {
	ParsedMarkdown,
	ParsedRoutineBlock,
	ParsedWeeklyGoal,
} from "./types";

const ALL_DAYS_MASK = Object.values(WEEKDAY_BITS).reduce((a, b) => a | b, 0);

/** Dias da semana inferidos do título da seção (ex.: "Dia útil (segunda a sexta)"). */
export function weekdaysFromHeading(heading: string): number | null {
	const key = normalizeKey(heading);
	if (/dia util|segunda a sexta/.test(key)) return WORKDAYS_MASK;
	if (/todos os dias|diario/.test(key)) return ALL_DAYS_MASK;
	if (/fim de semana/.test(key))
		return WEEKDAY_BITS.saturday | WEEKDAY_BITS.sunday;
	const names: [RegExp, number][] = [
		[/\bdomingo\b/, WEEKDAY_BITS.sunday],
		[/\bsegunda\b/, WEEKDAY_BITS.monday],
		[/\bterca\b/, WEEKDAY_BITS.tuesday],
		[/\bquarta\b/, WEEKDAY_BITS.wednesday],
		[/\bquinta\b/, WEEKDAY_BITS.thursday],
		[/\bsexta\b/, WEEKDAY_BITS.friday],
		[/\bsabado\b/, WEEKDAY_BITS.saturday],
	];
	let mask = 0;
	for (const [pattern, bit] of names) if (pattern.test(key)) mask |= bit;
	return mask === 0 ? null : mask;
}

function pad(time: string): string | null {
	const match = /^(\d{1,2}):(\d{2})$/.exec(time);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) return null;
	return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

/** `09:40–10:40`, `19:15 em diante` e `~00:00` viram início e fim opcional. */
export function parseTimeRange(
	cell: string,
): { startTime: string; endTime: string | null } | null {
	const times = [...cell.matchAll(/(\d{1,2}):(\d{2})/g)].map((m) => m[0]);
	if (times.length === 0) return null;
	const startTime = pad(times[0]);
	if (!startTime) return null;
	const hasRange = /\d{1,2}:\d{2}\s*[–—-]\s*\d{1,2}:\d{2}/.test(cell);
	const endTime = hasRange && times[1] ? pad(times[1]) : null;
	return { startTime, endTime };
}

/** `4h`, `3h30`, `45 min` e `1h40 (20 min por dia útil)`. */
export function parseDuration(
	value: string,
): { minutes: number; note: string | null } | null {
	const plain = toPlainText(value);
	const hours = /(\d+)\s*h(?:\s*(\d{1,2})(?!\d))?/i.exec(plain);
	const minutesOnly = /(\d+)\s*min/i.exec(plain);
	let minutes: number;
	let matched: string;
	if (
		hours &&
		(!minutesOnly || (hours.index ?? 0) <= (minutesOnly.index ?? 0))
	) {
		minutes = Number(hours[1]) * 60 + Number(hours[2] ?? 0);
		matched = hours[0];
	} else if (minutesOnly) {
		minutes = Number(minutesOnly[1]);
		matched = minutesOnly[0];
	} else {
		return null;
	}
	if (minutes <= 0) return null;

	const parenthetical = /\(([^)]*)\)/.exec(plain);
	const rest = plain
		.replace(matched, "")
		.replace(/\([^)]*\)/g, "")
		.replace(/\bcerca de\b/i, "")
		.replace(/\s+/g, " ")
		.trim();
	const note = parenthetical?.[1].trim() || rest || null;
	return { minutes, note };
}

function parseRoutine(
	tables: ReturnType<typeof readTables>,
	warnings: string[],
): ParsedRoutineBlock[] {
	const blocks: ParsedRoutineBlock[] = [];
	for (const table of tables) {
		const keys = table.headers.map(normalizeKey);
		const timeColumn = keys.indexOf("horario");
		const activityColumn = keys.indexOf("atividade");
		if (timeColumn < 0 || activityColumn < 0) continue;

		const weekdays = weekdaysFromHeading(table.heading);
		if (weekdays === null) {
			warnings.push(
				"Uma tabela de horários foi ignorada: não foi possível descobrir o dia pelo título.",
			);
			continue;
		}
		let skipped = 0;
		for (const row of table.rows) {
			const range = parseTimeRange(row[timeColumn] ?? "");
			const title = toPlainText(row[activityColumn] ?? "");
			if (!range || !title) {
				skipped++;
				continue;
			}
			blocks.push({ weekdays, ...range, title });
		}
		if (skipped > 0) {
			warnings.push(
				`${skipped} linha(s) de horário sem hora válida foram ignoradas.`,
			);
		}
	}
	return blocks;
}

function parseGoals(
	tables: ReturnType<typeof readTables>,
	warnings: string[],
): ParsedWeeklyGoal[] {
	const goals: ParsedWeeklyGoal[] = [];
	const seen = new Set<string>();
	for (const table of tables) {
		const keys = table.headers.map(normalizeKey);
		const hoursColumn = keys.findIndex((key) => /horas? por semana/.test(key));
		if (hoursColumn < 0) continue;

		for (const row of table.rows) {
			const activity = toPlainText(row[0] ?? "");
			const duration = parseDuration(row[hoursColumn] ?? "");
			if (!activity || !duration) continue;
			const key = normalizeKey(activity);
			if (seen.has(key)) {
				warnings.push("Uma meta repetida foi ignorada (vale a primeira).");
				continue;
			}
			seen.add(key);
			goals.push({
				activity,
				targetMinutes: duration.minutes,
				note: duration.note,
			});
		}
	}
	return goals;
}

/** Lê um arquivo Markdown e extrai rotina, tarefas e metas semanais. */
export function parseMarkdown(raw: string): ParsedMarkdown {
	const text = stripFrontMatter(normalizeNewlines(raw));
	const warnings: string[] = [];
	const tables = readTables(text);

	const tasks = readTasks(text).map((task) => ({
		...task,
		section: cleanSectionTitle(task.section) || "Geral",
	}));

	return {
		routineBlocks: parseRoutine(tables, warnings),
		tasks,
		weeklyGoals: parseGoals(tables, warnings),
		warnings,
	};
}
