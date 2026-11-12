import type { Database } from "@/database/client";
import {
	applyPomodoroAction,
	parsePomodoroAction,
} from "@/features/focus/pomodoroActions";
import { actionIdentifierOf } from "@/features/notifications/notificationsClient";

/**
 * Corpo da tarefa que roda quando um botão da notificação fixa é tocado com o
 * app fechado. Abre o próprio banco, aplica a ação e o fecha de novo; não há
 * store nem tela, e qualquer falha aqui só perde aquele toque.
 */
export async function runPomodoroTask(
	payload: unknown,
	openDatabase: () => Promise<Database & { closeAsync: () => Promise<void> }>,
	nowMs: number = Date.now(),
): Promise<void> {
	const identifier = actionIdentifierOf(payload);
	const action = identifier ? parsePomodoroAction(identifier) : null;
	if (!action) return;

	const db = await openDatabase();
	try {
		await applyPomodoroAction(db, action, nowMs);
	} finally {
		await db.closeAsync();
	}
}
