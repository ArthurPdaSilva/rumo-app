import { create } from "zustand";
import type { Database } from "@/database/client";
import {
	getProfile,
	saveProfile,
} from "@/database/repositories/profileRepository";
import { DEFAULT_DAILY_MESSAGE_TIME, type Profile } from "@/types";

interface ProfileState {
	profile: Profile | null;
	isLoaded: boolean;
	load: (db: Database) => Promise<void>;
	saveDetails: (
		db: Database,
		details: { username: string; dailyMessageTime?: string },
	) => Promise<void>;
	setNotificationsEnabled: (db: Database, enabled: boolean) => Promise<void>;
	setDiscreetMode: (db: Database, enabled: boolean) => Promise<void>;
}

const DEFAULT_PROFILE: Profile = {
	username: "",
	notificationsEnabled: true,
	dailyMessageTime: DEFAULT_DAILY_MESSAGE_TIME,
	discreetMode: false,
};

export const useProfileStore = create<ProfileState>((set, get) => {
	async function persist(db: Database, next: Profile) {
		await saveProfile(db, next);
		set({ profile: next, isLoaded: true });
	}

	return {
		profile: null,
		isLoaded: false,
		load: async (db) => {
			const profile = await getProfile(db);
			set({ profile, isLoaded: true });
		},
		saveDetails: async (db, details) => {
			const current = get().profile ?? DEFAULT_PROFILE;
			await persist(db, {
				...current,
				username: details.username,
				dailyMessageTime: details.dailyMessageTime ?? current.dailyMessageTime,
			});
		},
		setNotificationsEnabled: async (db, enabled) => {
			const current = get().profile;
			if (!current) return;
			await persist(db, { ...current, notificationsEnabled: enabled });
		},
		setDiscreetMode: async (db, enabled) => {
			const current = get().profile;
			if (!current) return;
			await persist(db, { ...current, discreetMode: enabled });
		},
	};
});
