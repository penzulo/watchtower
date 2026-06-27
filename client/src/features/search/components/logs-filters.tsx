import type { LogQuery } from "@watchtower/shared";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Route } from "@/routes/_app/search";

const TIME_PRESETS = [
	{ label: "15m", ms: 15 * 60 * 1000 },
	{ label: "1h", ms: 60 * 60 * 1000 },
	{ label: "24h", ms: 24 * 60 * 60 * 1000 },
	{ label: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
];

export function LogsFilters() {
	const navigate = Route.useNavigate();
	const search = Route.useSearch();
	const [value, setValue] = useState(search.service ?? "");
	const [activePreset, setActivePreset] = useState<string | null>("7d"); // default

	// Basic debounce for text input
	useEffect(() => {
		const timeout = setTimeout(() => {
			navigate({
				search: (old: LogQuery) => ({
					...old,
					service: value || undefined,
					cursor: undefined, // Reset cursor on new search
				}),
			});
		}, 300);
		return () => clearTimeout(timeout);
	}, [value, navigate]);

	const applyTimePreset = (label: string, ms: number) => {
		setActivePreset(label);
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

	return (
		<div className="flex items-center gap-4 border-b bg-muted/20 px-6 py-3">
			<div className="flex-1 max-w-sm">
				<Input
					placeholder="Filter by service..."
					value={value}
					onChange={(e) => setValue(e.target.value)}
					className="bg-background"
				/>
			</div>

			<div className="flex items-center gap-1 border rounded-md p-1 bg-background">
				{TIME_PRESETS.map((preset) => (
					<Button
						key={preset.label}
						variant={activePreset === preset.label ? "secondary" : "ghost"}
						size="sm"
						className="h-7 px-2 text-xs"
						onClick={() => applyTimePreset(preset.label, preset.ms)}
					>
						{preset.label}
					</Button>
				))}
				<Button
					variant={activePreset === "custom" ? "secondary" : "ghost"}
					size="sm"
					className="h-7 px-2 text-xs"
					onClick={() => setActivePreset("custom")}
				>
					Custom
				</Button>
			</div>
		</div>
	);
}
