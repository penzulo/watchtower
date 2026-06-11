import { t } from "elysia";

export const DeadLetterSchema = t.Object({
	raw: t.Unknown(),
	error: t.String(),
	received_at: t.String({ format: "date-time" }),
	source_ip: t.Optional(t.String()),
});

export type DeadLetter = typeof DeadLetterSchema.static;
