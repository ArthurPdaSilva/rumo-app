/**
 * Guarda a fase do Pomodoro em andamento no banco, para ela sobreviver ao app
 * ser encerrado em segundo plano, e o tempo pausado de cada sessão, que não
 * entra na contagem das metas.
 */
export const POMODORO_ACTIVE_MIGRATION_SQL = `
ALTER TABLE pomodoro_sessions ADD COLUMN paused_ms INTEGER NOT NULL DEFAULT 0;

CREATE TABLE pomodoro_active (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	kind TEXT NOT NULL CHECK (kind IN ('focus', 'break', 'longBreak')),
	started_at_ms INTEGER NOT NULL,
	duration_ms INTEGER NOT NULL,
	session_id INTEGER,
	activity TEXT,
	routine_block_id INTEGER,
	task_id INTEGER,
	paused_at_ms INTEGER,
	paused_total_ms INTEGER NOT NULL DEFAULT 0,
	cycle_count INTEGER NOT NULL DEFAULT 0
);
`;
