/** Utilitários de baixo nível para ler Markdown (sem dependências externas). */

export function normalizeNewlines(text: string): string {
	return text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

/** Remove o front-matter YAML do topo, se existir. */
export function stripFrontMatter(text: string): string {
	return text.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

/** Texto simples: tira negrito, itálico, código, links e callouts. */
export function toPlainText(value: string): string {
	return value
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/`([^`]*)`/g, "$1")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/__([^_]+)__/g, "$1")
		.replace(/(^|[\s(])[*_]([^*_]+)[*_](?=[\s).,;:]|$)/g, "$1$2")
		.replace(/\s+/g, " ")
		.trim();
}

export function normalizeKey(value: string): string {
	return toPlainText(value)
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

export interface MarkdownTable {
	/** Título do cabeçalho `#` mais próximo acima da tabela. */
	heading: string;
	headers: string[];
	rows: string[][];
}

function splitRow(line: string): string[] {
	const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
	return trimmed
		.split(/(?<!\\)\|/)
		.map((cell) => cell.replace(/\\\|/g, "|").trim());
}

const SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Lê todas as tabelas com linha separadora, guardando o título anterior. */
export function readTables(text: string): MarkdownTable[] {
	const lines = text.split("\n");
	const tables: MarkdownTable[] = [];
	let heading = "";

	for (let i = 0; i < lines.length; i++) {
		const headingMatch = /^#{1,6}\s+(.*)$/.exec(lines[i]);
		if (headingMatch) {
			heading = toPlainText(headingMatch[1]);
			continue;
		}
		const isTableStart =
			lines[i].includes("|") &&
			i + 1 < lines.length &&
			SEPARATOR.test(lines[i + 1]) &&
			lines[i + 1].includes("-");
		if (!isTableStart) continue;

		const headers = splitRow(lines[i]);
		const rows: string[][] = [];
		let j = i + 2;
		while (
			j < lines.length &&
			lines[j].includes("|") &&
			lines[j].trim() !== ""
		) {
			rows.push(splitRow(lines[j]));
			j++;
		}
		tables.push({ heading, headers, rows });
		i = j - 1;
	}
	return tables;
}

export interface MarkdownTask {
	section: string;
	title: string;
	done: boolean;
}

/** Texto do título da seção sem numeração nem a explicação depois do travessão. */
export function cleanSectionTitle(heading: string): string {
	return toPlainText(heading)
		.replace(/^\d+[.)]\s*/, "")
		.split(/\s[—–]\s/)[0]
		.trim();
}

function taskTitle(raw: string): string {
	const bold = /\*\*([^*]+)\*\*/.exec(raw);
	if (bold) return toPlainText(bold[1]);
	const withoutPath = raw.split(/\s*\(`/)[0];
	const withoutPages = withoutPath.replace(/\s*·\s*\d+\s*págs?\b.*$/i, "");
	return toPlainText(withoutPages.split(/\s[—–]\s/)[0]);
}

/** Lê itens `- [ ]` e `- [x]`, agrupados pelo título da seção. */
export function readTasks(text: string): MarkdownTask[] {
	const tasks: MarkdownTask[] = [];
	let section = "Geral";
	for (const line of text.split("\n")) {
		const headingMatch = /^#{1,6}\s+(.*)$/.exec(line);
		if (headingMatch) {
			section = cleanSectionTitle(headingMatch[1]) || "Geral";
			continue;
		}
		const item = /^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/.exec(line);
		if (!item) continue;
		const title = taskTitle(item[2]);
		if (!title) continue;
		tasks.push({ section, title, done: item[1].toLowerCase() === "x" });
	}
	return tasks;
}
