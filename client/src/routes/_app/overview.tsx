import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowUpRight, Search, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_app/overview")({
	component: Index,
});

const STATUS_METRICS = [
	{ label: "ingest rate", value: "8,142", unit: "req/s" },
	{ label: "p99 latency", value: "41", unit: "ms" },
	{ label: "active streams", value: "3", unit: "" },
	{ label: "uptime", value: "14d 06h", unit: "" },
] as const;

const ACTIONS = [
	{
		to: "/logs" as const,
		title: "Live stream",
		description:
			"Watch logs land in the order the engine ingests them, with no polling delay.",
		icon: Activity,
		accent: "text-[oklch(0.75_0.18_152)]",
		ring: "ring-[oklch(0.75_0.18_152)]/20",
	},
	{
		to: "/search" as const,
		title: "Deep search",
		description:
			"Query millions of rows with ClickHouse-backed filters across service, level, and time range.",
		icon: Search,
		accent: "text-[oklch(0.72_0.15_290)]",
		ring: "ring-[oklch(0.72_0.15_290)]/20",
	},
] as const;

function Index() {
	return (
		<article className="flex h-full flex-col overflow-y-auto">
			{/* Signature element: terminal-style status strip */}
			<section
				aria-label="System status"
				className="border-b border-border/60 bg-[oklch(0.16_0.01_240)] px-6 py-5"
			>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span
							aria-hidden
							className="inline-flex h-1.5 w-1.5 rounded-full bg-[oklch(0.75_0.18_152)] shadow-[0_0_6px_oklch(0.75_0.18_152)]"
						/>
						<span className="font-mono text-xs uppercase tracking-widest text-[oklch(0.75_0.18_152)]">
							operational
						</span>
					</div>
					<time
						className="font-mono text-xs text-muted-foreground"
						dateTime="2026-06-28T00:00:00Z"
					>
						last event 2s ago
					</time>
				</div>

				<dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border/60 bg-border/60 sm:grid-cols-4">
					{STATUS_METRICS.map((metric) => (
						<div
							key={metric.label}
							className="bg-[oklch(0.16_0.01_240)] px-4 py-3"
						>
							<dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
								{metric.label}
							</dt>
							<dd className="mt-1 font-mono text-xl font-medium text-foreground">
								{metric.value}
								{metric.unit && (
									<span className="ml-1 text-xs font-normal text-muted-foreground">
										{metric.unit}
									</span>
								)}
							</dd>
						</div>
					))}
				</dl>
			</section>

			<div className="flex-1 px-6 py-8">
				<header className="mb-6">
					<h2 className="text-sm font-medium text-muted-foreground">Jump to</h2>
				</header>

				<nav aria-label="Primary actions">
					<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{ACTIONS.map(
							({ to, title, description, icon: Icon, accent, ring }) => (
								<li key={to}>
									<Link to={to} className="block focus-visible:outline-none">
										<Card
											className={`group h-full border-border/60 transition-colors hover:border-border focus-visible:ring-2 ${ring}`}
										>
											<CardHeader>
												<div className="flex items-center justify-between">
													<Icon className={`size-5 ${accent}`} aria-hidden />
													<ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
												</div>
												<CardTitle className="font-mono text-base">
													{title}
												</CardTitle>
												<CardDescription>{description}</CardDescription>
											</CardHeader>
										</Card>
									</Link>
								</li>
							),
						)}

						<li>
							<Card className="h-full border-border/60 opacity-60">
								<CardHeader>
									<div className="flex items-center justify-between">
										<ShieldAlert
											className="size-5 text-muted-foreground"
											aria-hidden
										/>
										<Badge
											variant="secondary"
											className="font-mono text-[10px]"
										>
											soon
										</Badge>
									</div>
									<CardTitle className="font-mono text-base">
										Alerting
									</CardTitle>
									<CardDescription>
										Set thresholds on any metric and get notified the moment
										something drifts.
									</CardDescription>
								</CardHeader>
							</Card>
						</li>
					</ul>
				</nav>

				<Separator className="my-10" />

				<section aria-labelledby="ingestion-heading">
					<header className="mb-4 flex items-baseline justify-between">
						<h2
							id="ingestion-heading"
							className="text-sm font-medium text-muted-foreground"
						>
							Quick ingestion example
						</h2>
						<Badge variant="outline" className="font-mono text-[10px]">
							POST /api/v1/logs/batch
						</Badge>
					</header>

					<Card className="overflow-hidden border-border/60 p-0">
						<CardContent className="p-0">
							<pre className="overflow-x-auto bg-[oklch(0.13_0.01_240)] p-5 text-[13px] leading-relaxed text-[oklch(0.85_0.02_240)]">
								<code className="font-mono">{`curl -X POST http://localhost:3000/api/v1/logs/batch \\
  -H "Content-Type: application/json" \\
  -d '[
    {
      "service": "api-server",
      "level": "info",
      "message": "User authenticated successfully",
      "environment": "production",
      "timestamp": "2026-06-28T00:00:00Z"
    }
  ]'`}</code>
							</pre>
						</CardContent>
					</Card>
				</section>
			</div>
		</article>
	);
}
