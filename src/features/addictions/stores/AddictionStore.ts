import { create } from "zustand";
import type { Database } from "@/database/client";
import {
	createAddiction,
	deleteAddiction,
	getBestStreakMs,
	listAddictions,
	listRelapses,
	registerRelapse,
} from "@/database/repositories/addictionRepository";
import type { Addiction, AddictionDetails } from "@/types";

export interface NewAddictionInput {
	name: string;
	icon: string;
	quitAt: string;
}

interface AddictionState {
	addictions: Addiction[];
	details: Record<number, AddictionDetails>;
	isLoaded: boolean;
	load: (db: Database) => Promise<void>;
	add: (db: Database, input: NewAddictionInput, now?: Date) => Promise<number>;
	loadDetails: (db: Database, id: number, now?: Date) => Promise<void>;
	registerRelapse: (
		db: Database,
		id: number,
		note: string | null,
		now?: Date,
	) => Promise<void>;
	remove: (db: Database, id: number) => Promise<void>;
}

export const useAddictionStore = create<AddictionState>((set, get) => ({
	addictions: [],
	details: {},
	isLoaded: false,
	load: async (db) => {
		const addictions = await listAddictions(db);
		set({ addictions, isLoaded: true });
	},
	add: async (db, input, now = new Date()) => {
		const id = await createAddiction(db, {
			name: input.name,
			icon: input.icon,
			quitAt: input.quitAt,
			createdAt: now.toISOString(),
		});
		await get().load(db);
		return id;
	},
	loadDetails: async (db, id, now = new Date()) => {
		const [relapses, bestStreakMs] = await Promise.all([
			listRelapses(db, id),
			getBestStreakMs(db, id, now),
		]);
		set((state) => ({
			details: { ...state.details, [id]: { relapses, bestStreakMs } },
		}));
	},
	registerRelapse: async (db, id, note, now = new Date()) => {
		await registerRelapse(db, id, now.toISOString(), note);
		await get().load(db);
		await get().loadDetails(db, id, now);
	},
	remove: async (db, id) => {
		await deleteAddiction(db, id);
		set((state) => {
			const { [id]: _removed, ...details } = state.details;
			return {
				addictions: state.addictions.filter((item) => item.id !== id),
				details,
			};
		});
	},
}));
