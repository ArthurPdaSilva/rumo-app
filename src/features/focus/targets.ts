import type { FocusTarget } from "@/features/focus/stores/FocusStore";
import type { RoutineBlock, Task, WeeklyGoal } from "@/types";

export interface TargetOption {
	key: string;
	label: string;
	/** Nome da atividade; `null` é foco livre, que não conta para nenhuma meta. */
	activity: string | null;
	routineBlockId: number | null;
}

/**
 * Atividades que dá para escolher: o bloco da rotina em andamento primeiro,
 * depois as metas semanais e as seções de tarefas, sem repetir nomes.
 */
export function buildTargetOptions(
	currentBlock: RoutineBlock | null,
	goals: WeeklyGoal[],
	tasks: Task[],
): TargetOption[] {
	const options: TargetOption[] = [];
	const seen = new Set<string>();
	const add = (activity: string, routineBlockId: number | null) => {
		if (seen.has(activity)) return;
		seen.add(activity);
		options.push({
			key: `a:${activity}`,
			label: activity,
			activity,
			routineBlockId,
		});
	};

	if (currentBlock) add(currentBlock.title, currentBlock.id);
	for (const goal of goals) add(goal.activity, null);
	for (const task of tasks) add(task.section, null);
	options.push({
		key: "free",
		label: "Foco livre",
		activity: null,
		routineBlockId: null,
	});
	return options;
}

export function toTarget(
	option: TargetOption,
	taskId: number | null,
): FocusTarget {
	return {
		activity: option.activity,
		routineBlockId: option.routineBlockId,
		taskId,
	};
}
