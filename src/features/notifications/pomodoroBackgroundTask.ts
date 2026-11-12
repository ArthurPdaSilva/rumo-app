import * as SQLite from "expo-sqlite";
import * as TaskManager from "expo-task-manager";
import { DATABASE_NAME, initializeDatabase } from "@/database/client";
import { runPomodoroTask } from "@/features/focus/pomodoroTask";
import { registerNotificationTask } from "@/features/notifications/notificationsClient";

/**
 * Importado pelo `index.ts` na raiz: a tarefa precisa estar definida assim que
 * o JavaScript carrega, inclusive quando o sistema o inicia só para tratar o
 * toque num botão da notificação.
 */
export const POMODORO_TASK_NAME = "RUMO-POMODORO-NOTIFICATION-ACTION";

TaskManager.defineTask(POMODORO_TASK_NAME, async ({ data, error }) => {
	if (error) return;
	await runPomodoroTask(data, async () => {
		const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
		await initializeDatabase(db);
		return db;
	});
});

registerNotificationTask(POMODORO_TASK_NAME).catch(() => undefined);
