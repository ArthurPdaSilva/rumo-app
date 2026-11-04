import { migrateDatabase } from "../../../database/client";
import {
	getProfile,
	saveProfile,
	saveUsername,
} from "../../../database/repositories/profileRepository";
import { createTestDatabase } from "../../helpers/createTestDatabase";

describe("profileRepository", () => {
	test("retorna null enquanto não há perfil", async () => {
		const db = createTestDatabase();
		await migrateDatabase(db);

		expect(await getProfile(db)).toBeNull();
		db.close();
	});

	test("salva o nome de usuário com as preferências padrão", async () => {
		const db = createTestDatabase();
		await migrateDatabase(db);

		await saveUsername(db, "Arthur");

		expect(await getProfile(db)).toEqual({
			username: "Arthur",
			notificationsEnabled: true,
			dailyMessageTime: "08:30",
			discreetMode: false,
		});
		db.close();
	});

	test("atualiza o nome sem criar um segundo perfil", async () => {
		const db = createTestDatabase();
		await migrateDatabase(db);
		await saveUsername(db, "Arthur");

		await saveUsername(db, "Art");

		const count = await db.getFirstAsync<{ total: number }>(
			"SELECT COUNT(*) AS total FROM profile",
		);
		expect(count?.total).toBe(1);
		expect((await getProfile(db))?.username).toBe("Art");
		db.close();
	});

	test("salva e lê todas as preferências do perfil", async () => {
		const db = createTestDatabase();
		await migrateDatabase(db);

		await saveProfile(db, {
			username: "Arthur",
			notificationsEnabled: false,
			dailyMessageTime: "07:15",
			discreetMode: true,
		});

		expect(await getProfile(db)).toEqual({
			username: "Arthur",
			notificationsEnabled: false,
			dailyMessageTime: "07:15",
			discreetMode: true,
		});
		db.close();
	});

	test("saveProfile atualiza o perfil existente", async () => {
		const db = createTestDatabase();
		await migrateDatabase(db);
		await saveUsername(db, "Arthur");

		await saveProfile(db, {
			username: "Arthur",
			notificationsEnabled: true,
			dailyMessageTime: "09:00",
			discreetMode: false,
		});

		const count = await db.getFirstAsync<{ total: number }>(
			"SELECT COUNT(*) AS total FROM profile",
		);
		expect(count?.total).toBe(1);
		expect((await getProfile(db))?.dailyMessageTime).toBe("09:00");
		db.close();
	});
});
