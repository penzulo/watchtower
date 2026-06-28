import type { AppEnvironment, LogQuery, TLogLevel } from "@watchtower/shared";
import { logLevels } from "@watchtower/shared";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Route } from "@/routes/_app/search";

const TIME_PRESETS = [
	{ label: "15m", ms: 15 * 60 * 1000 },
	{ label: "1h", ms: 60 * 60 * 1000 },
	{ label: "24h", ms: 24 * 60 * 60 * 1000 },
	{ label: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

const LIMIT_OPTIONS = [25, 50, 100, 250, 500] as const;

const LEVEL_COLORS: Record<TLogLevel, string> = {
	trace: "text-muted-foreground",
	debug: "text-blue-500",
	info: "text-green-500",
	warn: "text-yellow-500",
	error: "text-red-500",
	fatal: "text-red-700",
};

const ENVIRONMENTS: AppEnvironment[] = ["development", "staging", "production"];

function formatDate(date: Date) {
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function LogsFilters() {
	const navigate = Route.useNavigate();
	const search = Route.useSearch();

	// Local state for service input (debounced)
	const [serviceValue, setServiceValue] = useState(search.service ?? "");
	// Debounce via ref approach — navigates after 300ms of no typing
	const [debounceTimer, setDebounceTimer] = useState<ReturnType<
		typeof setTimeout
	> | null>(null);

	// Custom date range picker state
	const [calendarOpen, setCalendarOpen] = useState(false);
	const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>(
		{},
	);

	const activeLevels: TLogLevel[] = search.level ?? [];

	// Determine which preset is active (or "custom")
	const activePreset = (() => {
		if (!search.from || !search.to) return "7d";
		const ms = new Date(search.to).getTime() - new Date(search.from).getTime();
		const match = TIME_PRESETS.find((p) => Math.abs(p.ms - ms) < 60_000);
		return match ? match.label : "custom";
	})();

	// --- Handlers ---

	const handleServiceChange = (value: string) => {
		setServiceValue(value);
		if (debounceTimer) clearTimeout(debounceTimer);
		const t = setTimeout(() => {
			navigate({
				search: (old: LogQuery) => ({
					...old,
					service: value || undefined,
					cursor: undefined,
				}),
			});
		}, 300);
		setDebounceTimer(t);
	};

	const applyTimePreset = (ms: number) => {
		const to = new Date();
		const from = new Date(to.getTime() - ms);
		navigate({
			search: (old: LogQuery) => ({
				...old,
				from: from.toISOString(),
				to: to.toISOString(),
				cursor: undefined,
			}),
		});
	};

	const applyCustomRange = () => {
		if (!customRange.from || !customRange.to) return;
		navigate({
			search: (old: LogQuery) => ({
				...old,
				from: customRange.from?.toISOString(),
				to: customRange.to?.toISOString(),
				cursor: undefined,
			}),
		});
		setCalendarOpen(false);
	};

	const toggleLevel = (level: TLogLevel) => {
		const next = activeLevels.includes(level)
			? activeLevels.filter((l) => l !== level)
			: [...activeLevels, level];
		navigate({
			search: (old: LogQuery) => ({
				...old,
				level: next.length > 0 ? next : undefined,
				cursor: undefined,
			}),
		});
	};

	const handleEnvironmentChange = (value: string) => {
		navigate({
			search: (old: LogQuery) => ({
				...old,
				environment: value === "all" ? undefined : (value as AppEnvironment),
				cursor: undefined,
			}),
		});
	};

	const handleLimitChange = (value: string) => {
		navigate({
			search: (old: LogQuery) => ({
				...old,
				limit: Number(value),
				cursor: undefined,
			}),
		});
	};

	const clearAllFilters = () => {
		setServiceValue("");
		navigate({
			search: () => ({
				from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
				to: new Date().toISOString(),
				limit: 50,
			}),
		});
	};

	const hasActiveFilters =
		!!search.service ||
		(search.level && search.level.length > 0) ||
		!!search.environment;

	return (
		<div className="flex flex-col gap-2 border-b bg-muted/20 px-6 py-3">
			{/* Row 1: service input + time presets + custom picker */}
			<div className="flex flex-wrap items-center gap-3">
				{/* Service filter */}
				<Input
					placeholder="Filter by service..."
					value={serviceValue}
					onChange={(e) => handleServiceChange(e.target.value)}
					className="h-8 w-48 bg-background text-sm"
				/>

				{/* Time presets */}
				<div className="flex items-center gap-1 rounded-md border bg-background p-1">
					{TIME_PRESETS.map((preset) => (
						<Button
							key={preset.label}
							variant={activePreset === preset.label ? "secondary" : "ghost"}
							size="sm"
							className="h-6 px-2 text-xs"
							onClick={() => applyTimePreset(preset.ms)}
						>
							{preset.label}
						</Button>
					))}

					{/* Custom date range picker */}
					<Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
						<PopoverTrigger asChild>
							<Button
								variant={activePreset === "custom" ? "secondary" : "ghost"}
								size="sm"
								className={cn(
									"h-6 gap-1 px-2 text-xs",
									activePreset === "custom" && "font-medium",
								)}
							>
								<CalendarIcon className="size-3" />
								{activePreset === "custom" && search.from && search.to
									? `${formatDate(new Date(search.from))} – ${formatDate(new Date(search.to))}`
									: "Custom"}
							</Button>
						</PopoverTrigger>
						<PopoverContent align="start" className="w-auto p-0">
							<Calendar
								mode="range"
								selected={{ from: customRange.from, to: customRange.to }}
								onSelect={(range) =>
									setCustomRange({ from: range?.from, to: range?.to })
								}
								numberOfMonths={2}
								disabled={{ after: new Date() }}
							/>
							<div className="flex items-center justify-end gap-2 border-t px-4 py-2">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setCalendarOpen(false)}
								>
									Cancel
								</Button>
								<Button
									size="sm"
									disabled={!customRange.from || !customRange.to}
									onClick={applyCustomRange}
								>
									Apply
								</Button>
							</div>
						</PopoverContent>
					</Popover>
				</div>

				{/* Clear all */}
				{hasActiveFilters && (
					<Button
						variant="ghost"
						size="sm"
						className="h-8 gap-1 px-2 text-xs text-muted-foreground"
						onClick={clearAllFilters}
					>
						<X className="size-3" />
						Clear filters
					</Button>
				)}
			</div>

			{/* Row 2: level toggles + environment + limit */}
			<div className="flex flex-wrap items-center gap-3">
				{/* Level multi-select (toggle buttons) */}
				<div className="flex items-center gap-1 rounded-md border bg-background p-1">
					<span className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
						Level
					</span>
					{logLevels.map((level) => (
						<Button
							key={level}
							variant={activeLevels.includes(level) ? "secondary" : "ghost"}
							size="sm"
							className={cn(
								"h-6 px-2 text-xs capitalize",
								activeLevels.includes(level) && LEVEL_COLORS[level],
							)}
							onClick={() => toggleLevel(level)}
						>
							{level}
						</Button>
					))}
				</div>

				{/* Environment */}
				<Select
					value={search.environment ?? "all"}
					onValueChange={handleEnvironmentChange}
				>
					<SelectTrigger size="sm" className="h-8 text-xs">
						<SelectValue placeholder="Environment" />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectItem value="all">All environments</SelectItem>
							{ENVIRONMENTS.map((env) => (
								<SelectItem key={env} value={env} className="capitalize">
									{env}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>

				{/* Limit */}
				<Select
					value={String(search.limit ?? 50)}
					onValueChange={handleLimitChange}
				>
					<SelectTrigger size="sm" className="h-8 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{LIMIT_OPTIONS.map((n) => (
								<SelectItem key={n} value={String(n)}>
									{n} rows
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
