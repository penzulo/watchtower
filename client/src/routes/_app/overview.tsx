import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/overview")({
	component: Overview,
});

type LangKey = "curl" | "python" | "typescript" | "go" | "nushell";

const LANGUAGES: { key: LangKey; label: string }[] = [
	{ key: "curl", label: "cURL" },
	{ key: "python", label: "Python" },
	{ key: "typescript", label: "TypeScript" },
	{ key: "go", label: "Go" },
	{ key: "nushell", label: "Nushell" },
];

const BATCH_SNIPPETS: Record<LangKey, string> = {
	curl: `curl -X POST http://localhost:3000/api/v1/logs/batch \\
  -H "Content-Type: application/json" \\
  -d '[
    {
      "service": "api-server",
      "level": "info",
      "message": "User authenticated successfully",
      "environment": "production",
      "timestamp": "2026-06-28T00:00:00Z"
    }
  ]'`,
	python: `import requests
from datetime import datetime, timezone

logs = [
    {
        "service": "api-server",
        "level": "info",
        "message": "User authenticated successfully",
        "environment": "production",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
]

resp = requests.post(
    "http://localhost:3000/api/v1/logs/batch",
    json=logs,
)
resp.raise_for_status()`,
	typescript: `const logs = [
  {
    service: "api-server",
    level: "info",
    message: "User authenticated successfully",
    environment: "production",
    timestamp: new Date().toISOString(),
  },
];

await fetch("http://localhost:3000/api/v1/logs/batch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(logs),
});`,
	go: `package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"
)

type LogEntry struct {
	Service     string    \`json:"service"\`
	Level       string    \`json:"level"\`
	Message     string    \`json:"message"\`
	Environment string    \`json:"environment"\`
	Timestamp   time.Time \`json:"timestamp"\`
}

func main() {
	logs := []LogEntry{{
		Service:     "api-server",
		Level:       "info",
		Message:     "User authenticated successfully",
		Environment: "production",
		Timestamp:   time.Now().UTC(),
	}}

	body, _ := json.Marshal(logs)
	http.Post(
		"http://localhost:3000/api/v1/logs/batch",
		"application/json",
		bytes.NewReader(body),
	)
}`,
	nushell: `[{
    service: "api-server",
    level: "info",
    message: "User authenticated successfully",
    environment: "production",
    timestamp: (date now | format date "%+")
}] | to json
  | http post http://localhost:3000/api/v1/logs/batch --content-type application/json`,
};

const STREAM_SNIPPETS: Record<LangKey, string> = {
	curl: `curl -N http://localhost:3000/api/v1/stream`,
	python: `import httpx

with httpx.stream("GET", "http://localhost:3000/api/v1/stream") as resp:
    for line in resp.iter_lines():
        if line.startswith("data:"):
            print(line.removeprefix("data:").strip())`,
	typescript: `const events = new EventSource("http://localhost:3000/api/v1/stream");

events.onmessage = (event) => {
  console.log(JSON.parse(event.data));
};`,
	go: `package main

import (
	"bufio"
	"net/http"
	"strings"
)

func main() {
	resp, _ := http.Get("http://localhost:3000/api/v1/stream")
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data:") {
			println(strings.TrimPrefix(line, "data:"))
		}
	}
}`,
	nushell: `http get http://localhost:3000/api/v1/stream -N
  | lines
  | where ($it | str starts-with "data:")
  | each { |line| $line | str replace "data:" "" | str trim }`,
};

function Overview() {
	const [lang, setLang] = useState<LangKey>("curl");

	return (
		<article className="h-full overflow-y-auto bg-background">
			<div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
				<header>
					<div className="flex items-center gap-2">
						<img
							src="/favicon.svg"
							alt=""
							aria-hidden
							className="size-3.5 shrink-0"
						/>
						<span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
							usage
						</span>
					</div>
					<h1 className="mt-3 font-mono text-3xl font-medium tracking-tight text-foreground">
						Send logs, read them back
					</h1>
					<p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
						Two calls cover the whole pipeline: a batch write that lands on the
						cold path for search, and a stream read that taps the hot path for
						live tailing. Pick whatever you're scripting in.
					</p>
				</header>

				<Separator className="my-8" />

				<Tabs value={lang} onValueChange={(v) => setLang(v as LangKey)}>
					<TabsList className="font-mono text-xs">
						{LANGUAGES.map(({ key, label }) => (
							<TabsTrigger key={key} value={key} className="font-mono">
								{label}
							</TabsTrigger>
						))}
					</TabsList>

					<section aria-labelledby="batch-heading" className="mt-8">
						<header className="mb-3 flex items-baseline justify-between">
							<h2
								id="batch-heading"
								className="text-sm font-medium text-muted-foreground"
							>
								1. Write a batch
							</h2>
							<Badge variant="outline" className="font-mono text-[10px]">
								POST /api/v1/logs/batch
							</Badge>
						</header>

						{LANGUAGES.map(({ key }) => (
							<TabsContent key={key} value={key} className="mt-0">
								<Card className="overflow-hidden border-border/60 p-0">
									<CardContent className="p-0">
										<pre className="overflow-x-auto bg-card p-5 text-[13px] leading-relaxed text-foreground/90">
											<code className="font-mono">{BATCH_SNIPPETS[key]}</code>
										</pre>
									</CardContent>
								</Card>
							</TabsContent>
						))}
					</section>

					<section aria-labelledby="stream-heading" className="mt-10">
						<header className="mb-3 flex items-baseline justify-between">
							<h2
								id="stream-heading"
								className="text-sm font-medium text-muted-foreground"
							>
								2. Read the live stream
							</h2>
							<Badge variant="outline" className="font-mono text-[10px]">
								GET /api/v1/stream
							</Badge>
						</header>

						{LANGUAGES.map(({ key }) => (
							<TabsContent key={key} value={key} className="mt-0">
								<Card className="overflow-hidden border-border/60 p-0">
									<CardContent className="p-0">
										<pre className="overflow-x-auto bg-card p-5 text-[13px] leading-relaxed text-foreground/90">
											<code className="font-mono">{STREAM_SNIPPETS[key]}</code>
										</pre>
									</CardContent>
								</Card>
							</TabsContent>
						))}
					</section>
				</Tabs>

				<Separator className="my-10" />

				<p className="font-mono text-xs text-muted-foreground">
					Both endpoints are open — no auth, no API key. See{" "}
					<span className="text-foreground/80">the README</span> for why.
				</p>
			</div>
		</article>
	);
}
