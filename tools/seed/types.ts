export interface ParsedRoutineBlock {
	weekdays: number;
	startTime: string;
	endTime: string | null;
	title: string;
}

export interface ParsedTask {
	section: string;
	title: string;
	done: boolean;
}

export interface ParsedWeeklyGoal {
	activity: string;
	targetMinutes: number;
	note: string | null;
}

export interface ParsedMarkdown {
	routineBlocks: ParsedRoutineBlock[];
	tasks: ParsedTask[];
	weeklyGoals: ParsedWeeklyGoal[];
	/** Avisos sem conteúdo do arquivo: só contagens e nomes genéricos. */
	warnings: string[];
}
