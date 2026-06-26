import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import type { LogQuery, LogRecord } from "@watchtower/shared";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Route } from "@/routes/_protected/search";

const columnHelper = createColumnHelper<LogRecord>();
const LEVEL_STYLES: Record<string, string> = {
	trace: "bg-slate-500",
	debug: "bg-blue-500",
	info: "bg-green-500",
	warn: "bg-yellow-500",
	error: "bg-red-500",
	fatal: "bg-red-900",
};

const columns = [
	columnHelper.accessor("timestamp", {
		header: "Time",
		enableSorting: true,
		cell: (info) => {
			const date = new Date(info.getValue());
			return (
				<span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
					{date.toLocaleTimeString([], { hour12: false })}
					<span className="opacity-50">
						.{date.getMilliseconds().toString().padStart(3, "0")}
					</span>
				</span>
			);
		},
		size: 110,
	}),
	columnHelper.accessor("level", {
		header: "Level",
		enableSorting: true,
		cell: (info) => {
			const level = info.getValue();
			return (
				<Badge
					variant="outline"
					className={`border-transparent font-mono text-xs uppercase text-white ${LEVEL_STYLES[level] ?? "bg-gray-500"}`}
				>
					{level}
				</Badge>
			);
		},
		size: 75,
	}),
	columnHelper.accessor("service", {
		header: "Service",
		enableSorting: false,
		cell: (info) => (
			<span className="font-medium text-foreground">{info.getValue()}</span>
		),
		size: 140,
	}),
	columnHelper.accessor("environment", {
		header: "Env",
		enableSorting: false,
		cell: (info) => (
			<span className="font-mono text-xs text-muted-foreground">
				{info.getValue()}
			</span>
		),
		size: 90,
	}),
	columnHelper.accessor("message", {
		header: "Message",
		enableSorting: false,
		cell: (info) => (
			<span className="font-mono text-xs">{info.getValue()}</span>
		),
	}),
];

export function LogsTable({
	data,
	nextCursor,
}: {
	data: LogRecord[];
	nextCursor: string | null;
}) {
	const navigate = Route.useNavigate();
	const search = Route.useSearch();

	const sorting: SortingState = search.sortBy
		? [{ id: search.sortBy, desc: search.sortDirection === "desc" }]
		: [{ id: "timestamp", desc: true }];

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualSorting: true,
		state: {
			sorting,
		},
		onSortingChange: (updater) => {
			const newSorting =
				typeof updater === "function" ? updater(sorting) : updater;
			const sort = newSorting[0];

			navigate({
				search: (old: LogQuery) => ({
					...old,
					sortBy: (sort?.id as "timestamp" | "level") || undefined,
					sortDirection: sort ? (sort.desc ? "desc" : "asc") : undefined,
					cursor: undefined, // reset pagination on sort change
				}),
			});
		},
	});

	return (
		<div className="flex h-full flex-col">
			<table className="w-full caption-bottom text-sm flex-1">
				<TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} className="hover:bg-transparent">
							{headerGroup.headers.map((header) => {
								const isSorted = header.column.getIsSorted();
								return (
									<TableHead
										key={header.id}
										style={{ width: header.column.getSize() }}
										className="bg-card font-semibold text-foreground group"
									>
										{header.isPlaceholder ? null : header.column.getCanSort() ? (
											<button
												type="button"
												className="flex items-center gap-1 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
												onClick={header.column.getToggleSortingHandler()}
											>
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
												<span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
													{isSorted === "asc" ? (
														<ArrowUp className="h-3 w-3 opacity-100" />
													) : isSorted === "desc" ? (
														<ArrowDown className="h-3 w-3 opacity-100" />
													) : (
														<ArrowUpDown className="h-3 w-3 text-muted-foreground" />
													)}
												</span>
											</button>
										) : (
											<div className="flex items-center gap-1">
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
											</div>
										)}
									</TableHead>
								);
							})}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.map((row) => (
						<TableRow
							key={row.original.id}
							className="border-b border-border/40 transition-colors hover:bg-muted/50"
						>
							{row.getVisibleCells().map((cell) => (
								<TableCell
									key={cell.id}
									style={{ width: cell.column.getSize() }}
									className="py-2"
								>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))}
					{data.length === 0 && (
						<TableRow>
							<TableCell colSpan={columns.length} className="h-24 text-center">
								No results found.
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</table>
			<div className="border-t p-4 flex items-center justify-between bg-card sticky bottom-0">
				<div className="text-sm text-muted-foreground">
					Showing {data.length} results
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={!nextCursor}
						onClick={() => {
							if (nextCursor) {
								navigate({
									search: (old: LogQuery) => ({
										...old,
										cursor: nextCursor,
									}),
								});
							}
						}}
					>
						Next Page
					</Button>
				</div>
			</div>
		</div>
	);
}
