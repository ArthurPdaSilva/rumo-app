import type { Database } from "@/database/client";
import type { Profile } from "@/types";

interface ProfileRow {
	username: string;
	notifications_enabled: number;
	daily_message_time: string;
	discreet_mode: number;
}

export async function getProfile(db: Database): Promise<Profile | null> {
	const row = await db.getFirstAsync<ProfileRow>(
		"SELECT username, notifications_enabled, daily_message_time, discreet_mode FROM profile WHERE id = 1",
	);
	if (!row) return null;

	return {
		username: row.username,
		notificationsEnabled: row.notifications_enabled === 1,
		dailyMessageTime: row.daily_message_time,
		discreetMode: row.discreet_mode === 1,
	};
}

export async function saveUsername(
	db: Database,
	username: string,
): Promise<void> {
	await db.runAsync(
		`INSERT INTO profile (id, username) VALUES (1, ?)
		ON CONFLICT(id) DO UPDATE SET username = excluded.username`,
		username,
	);
}

export async function saveProfile(
	db: Database,
	profile: Profile,
): Promise<void> {
	await db.runAsync(
		`INSERT INTO profile (id, username, notifications_enabled, daily_message_time, discreet_mode)
		VALUES (1, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			username = excluded.username,
			notifications_enabled = excluded.notifications_enabled,
			daily_message_time = excluded.daily_message_time,
			discreet_mode = excluded.discreet_mode`,
		profile.username,
		profile.notificationsEnabled ? 1 : 0,
		profile.dailyMessageTime,
		profile.discreetMode ? 1 : 0,
	);
}
