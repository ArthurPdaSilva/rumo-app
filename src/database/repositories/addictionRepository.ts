import type { Database } from "@/database/client";
import type { Addiction, Relapse } from "@/types";

interface AddictionRow {
	id: number;
	name: string;
	icon: string;
	quit_at: string;
	created_at: string;
	archived_at: string | null;
	streak_started_at: string;
}

const SELECT_ADDICTIONS = `
	SELECT a.id, a.name, a.icon, a.quit_at, a.created_at, a.archived_at,
		COALESCE(
			(SELECT MAX(r.occurred_at) FROM relapses r WHERE r.addiction_id = a.id),
			a.quit_at
		) AS streak_started_at
	FROM addictions a`;

function toAddiction(row: AddictionRow): Addiction {
	return {
		id: row.id,
		name: row.name,
		icon: row.icon,
		quitAt: row.quit_at,
		createdAt: row.created_at,
		archivedAt: row.archived_at,
		streakStartedAt: row.streak_started_at,
	};
}

export interface NewAddiction {
	name: string;
	icon?: string;
	quitAt: string;
	createdAt: string;
}

export async function createAddiction(
	db: Database,
	input: NewAddiction,
): Promise<number> {
	const result = await db.runAsync(
		"INSERT INTO addictions (name, icon, quit_at, created_at) VALUES (?, ?, ?, ?)",
		input.name,
		input.icon ?? "leaf",
		input.quitAt,
		input.createdAt,
	);
	return result.lastInsertRowId;
}

export async function listAddictions(db: Database): Promise<Addiction[]> {
	const rows = await db.getAllAsync<AddictionRow>(
		`${SELECT_ADDICTIONS} WHERE a.archived_at IS NULL ORDER BY a.created_at, a.id`,
	);
	return rows.map(toAddiction);
}

export async function getAddiction(
	db: Database,
	id: number,
): Promise<Addiction | null> {
	const row = await db.getFirstAsync<AddictionRow>(
		`${SELECT_ADDICTIONS} WHERE a.id = ?`,
		id,
	);
	return row ? toAddiction(row) : null;
}

export async function registerRelapse(
	db: Database,
	addictionId: number,
	occurredAt: string,
	note: string | null = null,
): Promise<void> {
	await db.runAsync(
		"INSERT INTO relapses (addiction_id, occurred_at, note) VALUES (?, ?, ?)",
		addictionId,
		occurredAt,
		note,
	);
}

/** Maior período, em milissegundos, entre `quit_at`, as recaídas e `now`. */
export async function getBestStreakMs(
	db: Database,
	addictionId: number,
	now: Date,
): Promise<number> {
	const addiction = await getAddiction(db, addictionId);
	if (!addiction) return 0;

	const relapses = await db.getAllAsync<{ occurred_at: string }>(
		"SELECT occurred_at FROM relapses WHERE addiction_id = ? ORDER BY occurred_at",
		addictionId,
	);
	const points = [
		addiction.quitAt,
		...relapses.map((relapse) => relapse.occurred_at),
	].map((value) => new Date(value).getTime());
	points.push(now.getTime());

	let best = 0;
	for (let index = 1; index < points.length; index += 1) {
		best = Math.max(best, points[index] - points[index - 1]);
	}
	return best;
}

export async function listRelapses(
	db: Database,
	addictionId: number,
): Promise<Relapse[]> {
	const rows = await db.getAllAsync<{
		id: number;
		occurred_at: string;
		note: string | null;
	}>(
		"SELECT id, occurred_at, note FROM relapses WHERE addiction_id = ? ORDER BY occurred_at DESC, id DESC",
		addictionId,
	);
	return rows.map((row) => ({
		id: row.id,
		occurredAt: row.occurred_at,
		note: row.note,
	}));
}

export async function deleteAddiction(
	db: Database,
	addictionId: number,
): Promise<void> {
	await db.runAsync("DELETE FROM addictions WHERE id = ?", addictionId);
}
