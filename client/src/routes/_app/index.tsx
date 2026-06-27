import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
	component: Index,
});

function Index() {
	return (
		<main className="flex h-svh flex-col bg-background">
			<header className="border-b px-6 py-4">
				<h1 className="text-2xl font-semibold tracking-tight">Live Logs</h1>
				<p className="text-sm text-muted-foreground">
					Real-time log stream from the server.
				</p>
			</header>

			<div className="flex-1 overflow-hidden p-6">
				<div className="h-full rounded-md border">
					{/* Table will go here */}
					<div className="flex h-full items-center justify-center text-muted-foreground">
						Logs table placeholder
					</div>
				</div>
			</div>
		</main>
	);
}
