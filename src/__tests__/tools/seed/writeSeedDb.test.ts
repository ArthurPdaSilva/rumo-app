import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { writeSeedDb } from "../../../../tools/seed/writeSeedDb";
import { parseMarkdown } from "../../../../tools/seed/parseMarkdown";
import { readRumoFile } from "../../../features/dataTransfer/rumoFile";
import {
	makeTempDir,
	openTestRumoFile,
} from "../../helpers/createTestDatabase";

const root = join(__dirname, "../../../..");
const parsedSeed = () =>
	["Cronograma.md", "Rota_de_estudos.md"].map((name) =>
		parseMarkdown(readFileSync(join(root, "seed", name), "utf8")),
	);

describe("writeSeedDb", () => {
	test("gera um .db que o leitor do app entende", async () => {
		const dir = makeTempDir();
		const path = join(dir, "plano.db");

		writeSeedDb(path, parsedSeed());
		const data = await readRumoFile(
			openTestRumoFile,
			new Uint8Array(readFileSync(path)),
		);

		expect(data.routineBlocks).toHaveLength(59);
		expect(data.tasks).toHaveLength(80);
		expect(data.weeklyGoals).toHaveLength(16);
		rmSync(dir, { recursive: true, force: true });
	});

	test("seed/rumo-seed.db está em dia com os .md (rode npm run seed:build se falhar)", async () => {
		const dir = makeTempDir();
		const path = join(dir, "fresh.db");
		writeSeedDb(path, parsedSeed());

		const fresh = await readRumoFile(
			openTestRumoFile,
			new Uint8Array(readFileSync(path)),
		);
		const committed = await readRumoFile(
			openTestRumoFile,
			new Uint8Array(readFileSync(join(root, "seed/rumo-seed.db"))),
		);

		expect(committed).toEqual(fresh);
		rmSync(dir, { recursive: true, force: true });
	});
});
