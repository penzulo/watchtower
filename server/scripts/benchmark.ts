/**
 * Watchtower — Log Ingestion Benchmark
 *
 * Measures throughput and latency of POST /api/v1/logs across three phases:
 *
 *   1. Warm-up     — low concurrency, discarded from results
 *   2. Ramp-up     — concurrency doubles every step until errors/latency spike
 *                    This locates the saturation point.
 *   3. Sustained   — holds the last stable concurrency for a full window
 *                    to measure peak steady-state throughput and percentiles.
 *
 * Usage:
 *   bun run server/scripts/benchmark.ts
 *   bun run server/scripts/benchmark.ts --url http://my-server:3000 --sustained 30
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_URL = "http://localhost:3000";
const ENDPOINT = "/api/v1/logs";

const WARMUP_CONCURRENCY = 5;
const WARMUP_DURATION_MS = 3_000;

const RAMP_STEP_DURATION_MS = 4_000; // how long to hold each concurrency level
const RAMP_START_CONCURRENCY = 10;
const RAMP_MAX_CONCURRENCY = 512;
const RAMP_STEP_MULTIPLIER = 2; // double concurrency each step

// Thresholds that define "saturation"
const ERROR_RATE_THRESHOLD = 0.05; // >5% errors → saturated
const P99_THRESHOLD_MS = 2_000; // p99 >2 s     → saturated

const SUSTAINED_DURATION_MS = Number(Bun.env.SUSTAINED_DURATION ?? 15) * 1_000;

const SERVER_URL = Bun.argv.includes("--url")
	? Bun.argv[Bun.argv.indexOf("--url") + 1]
	: (Bun.env.SERVER_URL ?? DEFAULT_URL);

// ─── Payload generation ───────────────────────────────────────────────────────

const LEVELS = [
	"trace",
	"debug",
	"info",
	"info",
	"info",
	"warn",
	"error",
	"fatal",
] as const;
const SERVICES = [
	"auth-service",
	"api-gateway",
	"worker",
	"scheduler",
	"mailer",
] as const;
const ENVS = ["production", "staging"] as const;
const MESSAGES = [
	"Request received for user session validation",
	"Cache miss — querying primary database",
	"Rate limit applied to IP 203.0.113.42",
	"Job enqueued: send-weekly-digest",
	"OAuth token refreshed successfully",
	"Database connection pool exhausted — waiting",
	"Health check passed",
	"Deployment hook triggered by CI pipeline",
];

function makePayload() {
	return {
		timestamp: new Date().toISOString(),
		level: LEVELS[Math.floor(Math.random() * LEVELS.length)],
		service: SERVICES[Math.floor(Math.random() * SERVICES.length)],
		environment: ENVS[Math.floor(Math.random() * ENVS.length)],
		message: MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
		version: "1.0.0",
		extras: { requestId: crypto.randomUUID() },
	};
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestResult {
	durationMs: number;
	status: number;
	ok: boolean;
}

interface PhaseResult {
	concurrency: number;
	durationMs: number;
	totalRequests: number;
	successCount: number;
	errorCount: number;
	rps: number;
	errorRate: number;
	p50: number;
	p95: number;
	p99: number;
	p999: number;
	minMs: number;
	maxMs: number;
	meanMs: number;
}

// ─── Core worker ─────────────────────────────────────────────────────────────

const TARGET = `${SERVER_URL}${ENDPOINT}`;
const HEADERS = { "Content-Type": "application/json" };

/** Fire a single POST and return timing + status. */
async function sendOne(): Promise<RequestResult> {
	const start = performance.now();
	let status = 0;
	let ok = false;
	try {
		const res = await fetch(TARGET, {
			method: "POST",
			headers: HEADERS,
			body: JSON.stringify(makePayload()),
		});
		status = res.status;
		ok = res.status === 202;
		// Drain the body to free the socket
		await res.text();
	} catch {
		// Network error counts as a failure
	}
	return { durationMs: performance.now() - start, status, ok };
}

/**
 * Run N workers in parallel for `durationMs` milliseconds.
 * Each worker loops: send → await → send → …
 * Returns all individual request results collected during the window.
 */
async function runPhase(
	concurrency: number,
	durationMs: number,
): Promise<RequestResult[]> {
	const results: RequestResult[] = [];
	const deadline = Date.now() + durationMs;

	async function worker() {
		while (Date.now() < deadline) {
			results.push(await sendOne());
		}
	}

	await Promise.all(Array.from({ length: concurrency }, worker));
	return results;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, idx)] ?? 0;
}

function analyse(
	results: RequestResult[],
	concurrency: number,
	durationMs: number,
): PhaseResult {
	const total = results.length;
	const success = results.filter((r) => r.ok).length;
	const errors = total - success;
	const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
	const mean = durations.reduce((a, b) => a + b, 0) / (durations.length || 1);

	return {
		concurrency,
		durationMs,
		totalRequests: total,
		successCount: success,
		errorCount: errors,
		rps: Math.round((total / durationMs) * 1000),
		errorRate: total > 0 ? errors / total : 0,
		p50: Math.round(percentile(durations, 50)),
		p95: Math.round(percentile(durations, 95)),
		p99: Math.round(percentile(durations, 99)),
		p999: Math.round(percentile(durations, 99.9)),
		minMs: Math.round(durations[0] ?? 0),
		maxMs: Math.round(durations[durations.length - 1] ?? 0),
		meanMs: Math.round(mean),
	};
}

// ─── Rendering ────────────────────────────────────────────────────────────────

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function bar(value: number, max: number, width = 20): string {
	const filled = Math.round((value / max) * width);
	return "█".repeat(filled) + "░".repeat(width - filled);
}

function fmt(r: PhaseResult, isSaturated: boolean): string {
	const errColor =
		r.errorRate > ERROR_RATE_THRESHOLD
			? RED
			: r.errorRate > 0.01
				? YELLOW
				: GREEN;
	const satLabel = isSaturated ? `${RED} ← SATURATED${RESET}` : "";
	return [
		`  concurrency : ${BOLD}${r.concurrency}${RESET}${satLabel}`,
		`  requests    : ${r.totalRequests.toLocaleString()} total  |  ${GREEN}${r.successCount.toLocaleString()} ok${RESET}  |  ${errColor}${r.errorCount.toLocaleString()} err${RESET}`,
		`  throughput  : ${BOLD}${CYAN}${r.rps.toLocaleString()} req/s${RESET}`,
		`  error rate  : ${errColor}${(r.errorRate * 100).toFixed(2)}%${RESET}`,
		`  latency     : p50=${r.p50}ms  p95=${r.p95}ms  p99=${r.p99}ms  p99.9=${r.p999}ms`,
		`  range       : min=${r.minMs}ms  mean=${r.meanMs}ms  max=${r.maxMs}ms`,
	].join("\n");
}

function printHeader(title: string) {
	console.log(`\n${BOLD}${CYAN}${"─".repeat(60)}${RESET}`);
	console.log(`${BOLD}  ${title}${RESET}`);
	console.log(`${CYAN}${"─".repeat(60)}${RESET}`);
}

function printSummaryTable(
	rampResults: PhaseResult[],
	sustainedResult: PhaseResult,
	saturationPoint: PhaseResult | null,
) {
	printHeader("BENCHMARK SUMMARY");

	// Table header
	const COL = [10, 8, 8, 8, 8, 8, 8, 8];
	const headers = ["Conc.", "RPS", "Err%", "p50", "p95", "p99", "Min", "Max"];
	const h = headers.map((h, i) => h.padStart(COL[i] ?? 0)).join(" ");
	console.log(`\n${DIM}  ${h}${RESET}`);
	console.log(
		`  ${DIM}${"─".repeat(COL.reduce((a, b) => a + b + 1, 0))}${RESET}`,
	);

	for (const r of rampResults) {
		const isSat = saturationPoint?.concurrency === r.concurrency;
		const color = isSat ? RED : r.errorRate > 0.01 ? YELLOW : GREEN;
		const row = [
			r.concurrency.toString(),
			`${r.rps}`,
			`${(r.errorRate * 100).toFixed(1)}%`,
			`${r.p50}ms`,
			`${r.p95}ms`,
			`${r.p99}ms`,
			`${r.minMs}ms`,
			`${r.maxMs}ms`,
		]
			.map((v, i) => v.padStart(COL[i] ?? 0))
			.join(" ");
		const tag = isSat ? `  ${RED}← sat${RESET}` : "";
		console.log(`${color}  ${row}${RESET}${tag}`);
	}

	console.log(
		`\n${BOLD}  Sustained phase (${SUSTAINED_DURATION_MS / 1000}s at peak stable concurrency):${RESET}`,
	);
	console.log(fmt(sustainedResult, false));

	if (saturationPoint) {
		console.log(
			`\n${BOLD}${RED}  ⚡ Saturation reached at concurrency = ${saturationPoint.concurrency}${RESET}`,
		);
		console.log(
			`${DIM}     (error rate ${(saturationPoint.errorRate * 100).toFixed(2)}% or p99 ${saturationPoint.p99}ms exceeded thresholds)${RESET}`,
		);
	} else {
		console.log(
			`\n${BOLD}${GREEN}  ✓ No saturation detected up to concurrency = ${RAMP_MAX_CONCURRENCY}${RESET}`,
		);
	}

	// RPS trend bar chart
	console.log(`\n${BOLD}  RPS by concurrency:${RESET}`);
	const maxRps = Math.max(...rampResults.map((r) => r.rps));
	for (const r of rampResults) {
		const isSat = saturationPoint?.concurrency === r.concurrency;
		const color = isSat ? RED : GREEN;
		const label = String(r.concurrency).padStart(4);
		console.log(
			`  ${DIM}${label}${RESET} ${color}${bar(r.rps, maxRps)}${RESET} ${BOLD}${r.rps}${RESET} req/s`,
		);
	}
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	console.log(`\n${BOLD}Watchtower — Log Ingestion Benchmark${RESET}`);
	console.log(`${DIM}Target : ${TARGET}${RESET}`);
	console.log(
		`${DIM}Thresholds : error rate >${(ERROR_RATE_THRESHOLD * 100).toFixed(0)}%  |  p99 >${P99_THRESHOLD_MS}ms${RESET}`,
	);

	// ── Connectivity check ─────────────────────────────────────────────────
	try {
		const probe = await fetch(`${SERVER_URL}/api/auth/ok`);
		if (!probe.ok) throw new Error(`Server returned ${probe.status}`);
		console.log(`${GREEN}✓ Server reachable${RESET}`);
	} catch (e) {
		console.error(
			`${RED}✗ Cannot reach server at ${SERVER_URL} — is it running?${RESET}`,
		);
		console.error(`  ${(e as Error).message}`);
		process.exit(1);
	}

	// ── Phase 1: Warm-up ───────────────────────────────────────────────────
	printHeader(
		`PHASE 1 — WARM-UP  (${WARMUP_CONCURRENCY} workers, ${WARMUP_DURATION_MS / 1000}s)`,
	);
	const warmupResults = await runPhase(WARMUP_CONCURRENCY, WARMUP_DURATION_MS);
	const warmup = analyse(warmupResults, WARMUP_CONCURRENCY, WARMUP_DURATION_MS);
	console.log(fmt(warmup, false));

	// ── Phase 2: Ramp-up ───────────────────────────────────────────────────
	printHeader("PHASE 2 — RAMP-UP  (finding saturation point)");

	const rampResults: PhaseResult[] = [];
	let saturationPoint: PhaseResult | null = null;
	let lastStableResult: PhaseResult = warmup;

	let concurrency = RAMP_START_CONCURRENCY;
	while (concurrency <= RAMP_MAX_CONCURRENCY) {
		Bun.stdout.write(
			`\n  Testing concurrency = ${BOLD}${concurrency}${RESET} … `,
		);
		const raw = await runPhase(concurrency, RAMP_STEP_DURATION_MS);
		const result = analyse(raw, concurrency, RAMP_STEP_DURATION_MS);
		rampResults.push(result);

		const saturated =
			result.errorRate > ERROR_RATE_THRESHOLD || result.p99 > P99_THRESHOLD_MS;

		if (saturated) {
			Bun.stdout.write(
				`${RED}SATURATED${RESET} (err=${(result.errorRate * 100).toFixed(1)}% p99=${result.p99}ms)\n`,
			);
			saturationPoint = result;
			break;
		}

		Bun.stdout.write(
			`${GREEN}OK${RESET}  ${CYAN}${result.rps} req/s${RESET}  p99=${result.p99}ms  err=${(result.errorRate * 100).toFixed(2)}%\n`,
		);
		lastStableResult = result;
		concurrency = Math.min(
			concurrency * RAMP_STEP_MULTIPLIER,
			RAMP_MAX_CONCURRENCY + 1,
		);
	}

	if (rampResults.length === 0) {
		console.error(
			`${RED}All ramp steps failed immediately. Check server logs.${RESET}`,
		);
		process.exit(1);
	}

	// ── Phase 3: Sustained peak ────────────────────────────────────────────
	printHeader(
		`PHASE 3 — SUSTAINED PEAK  (${lastStableResult.concurrency} workers, ${SUSTAINED_DURATION_MS / 1000}s)`,
	);
	console.log(
		`${DIM}  Running at last stable concurrency for a full window…${RESET}\n`,
	);

	const sustainedRaw = await runPhase(
		lastStableResult.concurrency,
		SUSTAINED_DURATION_MS,
	);
	const sustainedResult = analyse(
		sustainedRaw,
		lastStableResult.concurrency,
		SUSTAINED_DURATION_MS,
	);
	console.log(fmt(sustainedResult, false));

	// ── Final summary ──────────────────────────────────────────────────────
	printSummaryTable(rampResults, sustainedResult, saturationPoint);

	console.log(
		`\n${DIM}  Tip: Re-run with SUSTAINED_DURATION=60 for a longer soak test.${RESET}`,
	);
	console.log(
		`${DIM}  Tip: Set SERVER_URL=https://your-prod-host to benchmark production.${RESET}\n`,
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
