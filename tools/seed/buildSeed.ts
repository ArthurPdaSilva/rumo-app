/**
 * Converte os .md de `seed/` em `seed/rumo-seed.db`, o formato único que o app
 * importa. Uso: `npm run seed:build`.
 */
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdown } from "./parseMarkdown";
import { writeSeedDb } from "./writeSeedDb";

const seedDir = join(__dirname, "../../seed");
const sources = ["Cronograma.md", "Rota_de_estudos.md"];
const output = join(seedDir, "rumo-seed.db");

const parsed = sources.map((name) =>
	parseMarkdown(readFileSync(join(seedDir, name), "utf8")),
);

rmSync(output, { force: true });
writeSeedDb(output, parsed);

const total = (pick: (item: (typeof parsed)[number]) => number) =>
	parsed.reduce((sum, item) => sum + pick(item), 0);
console.log(
	`rumo-seed.db: ${total((p) => p.routineBlocks.length)} blocos, ${total((p) => p.tasks.length)} tarefas, ${total((p) => p.weeklyGoals.length)} metas.`,
);
for (const item of parsed)
	for (const warning of item.warnings) console.warn(warning);
