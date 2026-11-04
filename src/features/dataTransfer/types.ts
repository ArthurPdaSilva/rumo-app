import type {
	Addiction,
	PomodoroOnFocusEnd,
	Relapse,
	ThemeMode,
} from "@/types";

export interface FileRoutineBlock {
	id: number;
	weekdays: number;
	startTime: string;
	endTime: string | null;
	title: string;
	notes: string | null;
	reminderMinutes: number;
}

export interface FileTask {
	id: number;
	section: string;
	title: string;
	done: boolean;
}

export interface FileWeeklyGoal {
	activity: string;
	targetMinutes: number;
	note: string | null;
}

export type FileAddiction = Pick<
	Addiction,
	"id" | "name" | "icon" | "quitAt" | "createdAt" | "archivedAt"
>;

export type FileRelapse = Relapse & { addictionId: number };

export interface FilePomodoroSession {
	id: number;
	startedAt: string;
	endedAt: string | null;
	kind: "focus" | "break";
	routineBlockId: number | null;
	taskId: number | null;
	activity: string | null;
	completed: boolean;
}

export interface FileProfile {
	username: string;
	notificationsEnabled: boolean;
	dailyMessageTime: string;
	discreetMode: boolean;
	themeMode: ThemeMode;
	pomodoroOnFocusEnd: PomodoroOnFocusEnd;
}

/** Tudo o que um arquivo `.db` do Rumo traz, já em memória. */
export interface RumoFileData {
	routineBlocks: FileRoutineBlock[];
	tasks: FileTask[];
	weeklyGoals: FileWeeklyGoal[];
	addictions: FileAddiction[];
	relapses: FileRelapse[];
	pomodoroSessions: FilePomodoroSession[];
	profile: FileProfile | null;
}

export type TransferCategory =
	| "routineBlocks"
	| "tasks"
	| "weeklyGoals"
	| "addictions"
	| "relapses"
	| "pomodoroSessions"
	| "profile";

export interface PreviewLine {
	category: TransferCategory;
	label: string;
	incoming: number;
	current: number;
}

export interface TransferPreview {
	fileName: string;
	lines: PreviewLine[];
	/** Backup completo (traz vícios ou perfil): vira cópia exata do arquivo. */
	isFullBackup: boolean;
	/** Algum dado atual será substituído. */
	replacesExistingData: boolean;
	/** Tarefas já concluídas que continuam concluídas (só em arquivos de plano). */
	keptDone: number;
}
