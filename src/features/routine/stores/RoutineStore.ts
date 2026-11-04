import { create } from "zustand";
import type { Database } from "@/database/client";
import {
	type BlockInput,
	createBlock,
	deleteBlock,
	listBlocks,
	listGoals,
	listTasks,
	setTaskDone,
	updateBlock,
} from "@/database/repositories/routineRepository";
import type { RoutineBlock, Task, WeeklyGoal } from "@/types";

interface RoutineState {
	blocks: RoutineBlock[];
	tasks: Task[];
	goals: WeeklyGoal[];
	isLoaded: boolean;
	load: (db: Database) => Promise<void>;
	addBlock: (db: Database, input: BlockInput) => Promise<number>;
	editBlock: (db: Database, id: number, input: BlockInput) => Promise<void>;
	removeBlock: (db: Database, id: number) => Promise<void>;
	toggleTask: (db: Database, id: number) => Promise<boolean>;
}

export const useRoutineStore = create<RoutineState>((set, get) => ({
	blocks: [],
	tasks: [],
	goals: [],
	isLoaded: false,
	load: async (db) => {
		const [blocks, tasks, goals] = await Promise.all([
			listBlocks(db),
			listTasks(db),
			listGoals(db),
		]);
		set({ blocks, tasks, goals, isLoaded: true });
	},
	addBlock: async (db, input) => {
		const id = await createBlock(db, input);
		await get().load(db);
		return id;
	},
	editBlock: async (db, id, input) => {
		await updateBlock(db, id, input);
		await get().load(db);
	},
	removeBlock: async (db, id) => {
		await deleteBlock(db, id);
		await get().load(db);
	},
	/** Alterna o estado da tarefa e devolve o novo valor de `done`. */
	toggleTask: async (db, id) => {
		const task = get().tasks.find((item) => item.id === id);
		if (!task) throw new Error("Tarefa não encontrada");
		const done = !task.done;
		await setTaskDone(db, id, done);
		set({
			tasks: get().tasks.map((item) =>
				item.id === id ? { ...item, done } : item,
			),
		});
		return done;
	},
}));
