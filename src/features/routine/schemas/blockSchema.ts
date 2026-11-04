import { z } from "zod";
import { isValidTime, minutesOfDay } from "@/utils/time";

export const BLOCK_TITLE_MAX_LENGTH = 80;
export const BLOCK_NOTES_MAX_LENGTH = 200;
export const BLOCK_REMINDER_MAX_MINUTES = 180;

export const blockFormSchema = z
	.object({
		title: z
			.string()
			.trim()
			.min(1, "Dê um nome ao bloco")
			.max(
				BLOCK_TITLE_MAX_LENGTH,
				`Use no máximo ${BLOCK_TITLE_MAX_LENGTH} caracteres`,
			),
		startTime: z.string().trim().refine(isValidTime, "Use o formato HH:MM"),
		endTime: z
			.string()
			.trim()
			.refine(
				(value) => value === "" || isValidTime(value),
				"Use o formato HH:MM",
			),
		weekdays: z.number().int().min(1, "Escolha pelo menos um dia").max(127),
		reminderMinutes: z
			.string()
			.trim()
			.regex(/^\d{1,3}$/, "Use um número de minutos")
			.refine(
				(value) => Number(value) <= BLOCK_REMINDER_MAX_MINUTES,
				`Use de 0 a ${BLOCK_REMINDER_MAX_MINUTES} minutos`,
			),
		notes: z
			.string()
			.trim()
			.max(
				BLOCK_NOTES_MAX_LENGTH,
				`Use no máximo ${BLOCK_NOTES_MAX_LENGTH} caracteres`,
			),
	})
	.superRefine((values, context) => {
		if (
			values.endTime !== "" &&
			minutesOfDay(values.endTime) === minutesOfDay(values.startTime)
		) {
			context.addIssue({
				code: "custom",
				path: ["endTime"],
				message: "O fim deve ser diferente do início",
			});
		}
	});

export type BlockFormValues = z.infer<typeof blockFormSchema>;
