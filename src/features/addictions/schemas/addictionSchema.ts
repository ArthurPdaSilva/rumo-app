import { z } from "zod";
import {
	ADDICTION_ICONS,
	ADDICTION_NAME_MAX_LENGTH,
	ADDICTION_NAME_MIN_LENGTH,
} from "@/types";
import { parseLocalDateTime } from "@/utils/dateInput";

/** O relógio é injetado para que a regra "não pode ser no futuro" seja testável. */
export function createAddictionFormSchema(getNow: () => Date) {
	return z
		.object({
			name: z
				.string()
				.trim()
				.min(
					ADDICTION_NAME_MIN_LENGTH,
					`Use pelo menos ${ADDICTION_NAME_MIN_LENGTH} caracteres`,
				)
				.max(
					ADDICTION_NAME_MAX_LENGTH,
					`Use no máximo ${ADDICTION_NAME_MAX_LENGTH} caracteres`,
				),
			icon: z.enum(ADDICTION_ICONS),
			quitDate: z
				.string()
				.trim()
				.regex(/^\d{2}\/\d{2}\/\d{4}$/, "Use o formato DD/MM/AAAA"),
			quitTime: z
				.string()
				.trim()
				.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM"),
		})
		.superRefine((values, context) => {
			if (
				!/^\d{2}\/\d{2}\/\d{4}$/.test(values.quitDate) ||
				!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.quitTime)
			) {
				return;
			}
			const quitAt = parseLocalDateTime(values.quitDate, values.quitTime);
			if (!quitAt) {
				context.addIssue({
					code: "custom",
					path: ["quitDate"],
					message: "Data inválida",
				});
			} else if (quitAt.getTime() > getNow().getTime()) {
				context.addIssue({
					code: "custom",
					path: ["quitDate"],
					message: "A data não pode estar no futuro",
				});
			}
		});
}

export const addictionFormSchema = createAddictionFormSchema(() => new Date());

export type AddictionFormValues = z.infer<typeof addictionFormSchema>;
