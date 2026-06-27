import { createFileRoute } from "@tanstack/react-router";
import type { LogQuery } from "@watchtower/shared";
import { z } from "zod";
import { SearchPage } from "@/features/search/pages/search-page";
import { logsQueryOptions } from "@/hooks/use-filter-logs";

// --- URL Validation ---
const searchSchema = z.object({
	service: z.string().optional(),
	level: z
		.array(z.enum(["trace", "debug", "info", "warn", "error", "fatal"]))
		.optional(),
	environment: z.enum(["development", "staging", "production"]).optional(),
	from: z
		.string()
		.default(() =>
			new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
		),
	to: z.string().default(() => new Date().toISOString()),
	limit: z.number().default(50),
	cursor: z.string().optional(),
	sortBy: z.enum(["timestamp", "level"]).optional(),
	sortDirection: z.enum(["asc", "desc"]).optional(),
});

export const Route = createFileRoute("/_app/search")({
	validateSearch: (search) => searchSchema.parse(search) as LogQuery,
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps }) =>
		context.queryClient.ensureQueryData(logsQueryOptions(deps)),
	component: SearchPage,
});
