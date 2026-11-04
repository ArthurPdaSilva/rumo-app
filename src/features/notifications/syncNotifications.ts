import type { Database } from "@/database/client";
import { listAddictions } from "@/database/repositories/addictionRepository";
import { getProfile } from "@/database/repositories/profileRepository";
import { listBlocks } from "@/database/repositories/routineRepository";
import {
	createChannels,
	getNotificationPermission,
	replaceAppScheduled,
	requestNotificationPermission,
} from "@/features/notifications/notificationsClient";
import { planNotifications } from "@/features/notifications/planner";

let queue: Promise<unknown> = Promise.resolve();
let askedThisLaunch = false;

async function ensurePermission(): Promise<boolean> {
	let state = await getNotificationPermission();
	if (state === "undetermined" && !askedThisLaunch) {
		// Pede uma vez por abertura do app, para não insistir depois de uma recusa.
		askedThisLaunch = true;
		state = await requestNotificationPermission();
	}
	return state === "granted";
}

async function run(db: Database, now: Date): Promise<void> {
	const profile = await getProfile(db);
	const [addictions, blocks] = await Promise.all([
		listAddictions(db),
		listBlocks(db),
	]);
	const plan = planNotifications({ profile, addictions, blocks, now });

	if (plan.length > 0 && !(await ensurePermission())) {
		await replaceAppScheduled([]);
		return;
	}
	await createChannels();
	await replaceAppScheduled(plan);
}

/**
 * Recalcula do zero o que está agendado (perfil, vícios e rotina) lendo o banco.
 * As chamadas entram em fila para duas sincronizações nunca se sobreporem.
 */
export function syncNotifications(
	db: Database,
	now: Date = new Date(),
): Promise<void> {
	const next = queue.then(() => run(db, now));
	queue = next.catch(() => undefined);
	return next;
}

export function resetSyncStateForTests(): void {
	queue = Promise.resolve();
	askedThisLaunch = false;
}
