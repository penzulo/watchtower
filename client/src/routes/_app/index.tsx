import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, GitGraph } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_app/")({
	component: Readme,
});

function Readme() {
	return (
		<main className="min-h-screen bg-background">
			<div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
				<header>
					<div className="flex items-center gap-2">
						<img
							src="/favicon.svg"
							alt=""
							aria-hidden
							className="size-3.5 shrink-0"
						/>
						<span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
							README.md
						</span>
					</div>
					<h1 className="mt-3 font-mono text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
						watchtower
					</h1>
					<p className="mt-3 text-base leading-relaxed text-muted-foreground">
						A log ingestion and observability dashboard I built to find out how
						the tools I use every day actually work underneath.
					</p>
				</header>

				<Separator className="my-8" />

				<section aria-labelledby="what-heading" className="space-y-3">
					<h2
						id="what-heading"
						className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
					>
						## what this is
					</h2>
					<p className="leading-relaxed text-foreground/90">
						Logs come in over HTTP, get pushed onto Redis, and stream out to
						every connected client over SSE while they're simultaneously written
						to ClickHouse for the search side. It's the same shape as a real
						observability pipeline, just sized for one person's curiosity
						instead of one company's infrastructure budget.
					</p>
					<p className="leading-relaxed text-foreground/90">
						I wrote it to actually understand ring buffers, event loops, and
						backpressure rather than just knowing the words for an interview.
						The benchmarking arc that came out of it{" "}
						<span className="font-mono text-sm text-foreground">
							(8,000+ req/s, fixing a zombie connection bug, a BullMQ lock-TTL
							race under real network latency)
						</span>{" "}
						taught me more than the feature work did.
					</p>
				</section>

				<Separator className="my-8" />

				<section aria-labelledby="catch-heading" className="space-y-3">
					<h2
						id="catch-heading"
						className="font-mono text-xs uppercase tracking-widest text-[oklch(0.72_0.18_55)]"
					>
						## the catch
					</h2>
					<div className="rounded-md border border-[oklch(0.72_0.18_55)]/25 bg-[oklch(0.72_0.18_55)]/[0.06] p-4">
						<p className="leading-relaxed text-foreground/90">
							There's no auth on this instance. None. Anyone with the link can
							post logs and run searches.
						</p>
						<p className="mt-2 leading-relaxed text-foreground/90">
							That's a deliberate scope cut, not an oversight. Auth doesn't
							teach me anything I haven't already built before, and I'd rather
							spend the hours on the pipeline. The actual tradeoff: this runs on
							a free-tier box I pay for out of a student budget, so if you
							<span className="italic">do</span> decide to load-test it for fun,
							you'll mostly just be DDoSing a college student. Please don't.
							Poke around, post a few logs, watch the stream work, and that's
							plenty.
						</p>
					</div>
				</section>

				<Separator className="my-8" />

				<section aria-labelledby="next-heading" className="space-y-3">
					<h2
						id="next-heading"
						className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
					>
						## todo
					</h2>
					<ul className="space-y-2">
						{[
							"API keys per ingest source, rate-limited per key",
							"Alerting on threshold breaches (the card you'll see is honestly a placeholder)",
							"Horizontal scaling past a single Bun process",
						].map((item) => (
							<li key={item} className="flex gap-3 text-foreground/90">
								<span aria-hidden className="font-mono text-muted-foreground">
									—
								</span>
								<span className="leading-relaxed">{item}</span>
							</li>
						))}
					</ul>
				</section>

				<Separator className="my-8" />

				<footer className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<a
						href="https://github.com/penzulo/watchtower"
						className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						<GitGraph className="size-4" aria-hidden />
						source
					</a>

					<Link
						to="/search"
						search={{
							from: new Date(
								Date.now() - 7 * 24 * 60 * 60 * 1000,
							).toISOString(),
							to: new Date().toISOString(),
							limit: 50,
						}}
						className="group inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 font-mono text-sm text-foreground transition-colors hover:border-[oklch(0.75_0.18_152)]/50 hover:bg-[oklch(0.75_0.18_152)]/[0.06]"
					>
						$ open dashboard
						<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
					</Link>
				</footer>

				<p className="mt-10 text-center font-mono text-[11px] text-muted-foreground/60">
					<Badge variant="outline" className="font-mono text-[10px]">
						no cookies · no tracking · no auth
					</Badge>
				</p>
			</div>
		</main>
	);
}
