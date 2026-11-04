export const INITIAL_MIGRATION_SQL = `
CREATE TABLE profile (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	username TEXT NOT NULL,
	notifications_enabled INTEGER NOT NULL DEFAULT 1,
	daily_message_time TEXT NOT NULL DEFAULT '08:30',
	discreet_mode INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE app_state (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	theme_mode TEXT NOT NULL DEFAULT 'system',
	onboarding_done INTEGER NOT NULL DEFAULT 0,
	pomodoro_on_focus_end TEXT NOT NULL DEFAULT 'ask'
		CHECK (pomodoro_on_focus_end IN ('ask', 'auto_complete'))
);
INSERT INTO app_state (id) VALUES (1);

CREATE TABLE addictions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	icon TEXT NOT NULL DEFAULT 'leaf',
	quit_at TEXT NOT NULL,
	created_at TEXT NOT NULL,
	archived_at TEXT
);

CREATE TABLE relapses (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	addiction_id INTEGER NOT NULL REFERENCES addictions(id) ON DELETE CASCADE,
	occurred_at TEXT NOT NULL,
	note TEXT
);
CREATE INDEX idx_relapses_addiction ON relapses(addiction_id, occurred_at);

CREATE TABLE imports (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	file_name TEXT NOT NULL,
	content_hash TEXT NOT NULL UNIQUE,
	imported_at TEXT NOT NULL
);

CREATE TABLE routine_blocks (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	weekdays INTEGER NOT NULL,
	start_time TEXT NOT NULL,
	end_time TEXT,
	title TEXT NOT NULL,
	notes TEXT,
	reminder_minutes INTEGER NOT NULL DEFAULT 10,
	import_id INTEGER REFERENCES imports(id) ON DELETE SET NULL
);

CREATE TABLE tasks (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	section TEXT NOT NULL,
	title TEXT NOT NULL,
	done INTEGER NOT NULL DEFAULT 0,
	import_id INTEGER REFERENCES imports(id) ON DELETE SET NULL
);

CREATE TABLE weekly_goals (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	activity TEXT NOT NULL,
	target_minutes INTEGER NOT NULL,
	note TEXT,
	import_id INTEGER REFERENCES imports(id) ON DELETE SET NULL
);

CREATE TABLE pomodoro_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	started_at TEXT NOT NULL,
	ended_at TEXT,
	kind TEXT NOT NULL CHECK (kind IN ('focus', 'break')),
	routine_block_id INTEGER REFERENCES routine_blocks(id) ON DELETE SET NULL,
	task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
	activity TEXT,
	completed INTEGER NOT NULL DEFAULT 0
);
`;
