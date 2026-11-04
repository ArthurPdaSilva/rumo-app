import { migrateDatabase } from "../../../../database/client";
import { getProfile } from "../../../../database/repositories/profileRepository";
import { useProfileStore } from "../../../../features/profile/stores/ProfileStore";
import { createTestDatabase } from "../../../helpers/createTestDatabase";

async function setup() {
	const db = createTestDatabase();
	await migrateDatabase(db);
	return db;
}

describe("useProfileStore", () => {
	beforeEach(() => {
		useProfileStore.setState({ profile: null, isLoaded: false });
	});

	test("load marca como carregado e deixa o perfil nulo quando não existe", async () => {
		const db = await setup();

		await useProfileStore.getState().load(db);

		expect(useProfileStore.getState().isLoaded).toBe(true);
		expect(useProfileStore.getState().profile).toBeNull();
		db.close();
	});

	test("saveDetails cria o perfil com as preferências padrão", async () => {
		const db = await setup();

		await useProfileStore.getState().saveDetails(db, { username: "Arthur" });

		expect(useProfileStore.getState().profile).toEqual({
			username: "Arthur",
			notificationsEnabled: true,
			dailyMessageTime: "08:30",
			discreetMode: false,
		});
		expect(await getProfile(db)).toEqual(useProfileStore.getState().profile);
		db.close();
	});

	test("saveDetails preserva as preferências ao mudar só o nome", async () => {
		const db = await setup();
		await useProfileStore.getState().saveDetails(db, { username: "Arthur" });
		await useProfileStore.getState().setDiscreetMode(db, true);

		await useProfileStore.getState().saveDetails(db, { username: "Art" });

		expect(useProfileStore.getState().profile).toMatchObject({
			username: "Art",
			discreetMode: true,
		});
		db.close();
	});

	test("saveDetails atualiza o horário da mensagem diária", async () => {
		const db = await setup();
		await useProfileStore.getState().saveDetails(db, { username: "Arthur" });

		await useProfileStore
			.getState()
			.saveDetails(db, { username: "Arthur", dailyMessageTime: "07:00" });

		expect((await getProfile(db))?.dailyMessageTime).toBe("07:00");
		db.close();
	});

	test("liga e desliga as notificações e o modo discreto", async () => {
		const db = await setup();
		await useProfileStore.getState().saveDetails(db, { username: "Arthur" });

		await useProfileStore.getState().setNotificationsEnabled(db, false);
		await useProfileStore.getState().setDiscreetMode(db, true);

		expect(await getProfile(db)).toMatchObject({
			notificationsEnabled: false,
			discreetMode: true,
		});
		db.close();
	});

	test("as alterações de preferência sem perfil não fazem nada", async () => {
		const db = await setup();

		await useProfileStore.getState().setNotificationsEnabled(db, false);
		await useProfileStore.getState().setDiscreetMode(db, true);

		expect(await getProfile(db)).toBeNull();
		expect(useProfileStore.getState().profile).toBeNull();
		db.close();
	});

	test("load recupera o perfil salvo", async () => {
		const db = await setup();
		await useProfileStore.getState().saveDetails(db, { username: "Arthur" });
		useProfileStore.setState({ profile: null, isLoaded: false });

		await useProfileStore.getState().load(db);

		expect(useProfileStore.getState().profile?.username).toBe("Arthur");
		db.close();
	});
});
