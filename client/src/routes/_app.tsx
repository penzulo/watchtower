import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Activity, Search, SquareTerminal } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_app")({
	component: AppLayout,
});

const NAV_ITEMS = [
	{ to: "/overview", label: "Overview", icon: SquareTerminal, exact: true },
	{ to: "/logs", label: "Live logs", icon: Activity, exact: false },
	{ to: "/search", label: "Search", icon: Search, exact: false },
] as const;

function AppLayout() {
	return (
		<SidebarProvider>
			<Sidebar collapsible="icon" className="border-r border-border/60">
				<SidebarHeader className="border-b border-border/60">
					<Link to="/" className="flex items-center gap-2 px-2 py-1.5">
						<span
							aria-hidden
							className="inline-flex h-2 w-2 shrink-0 rounded-full bg-[oklch(0.75_0.18_152)] shadow-[0_0_8px_oklch(0.75_0.18_152)]"
						/>
						<h1 className="font-mono text-sm font-medium tracking-tight text-foreground">
							watchtower
						</h1>
					</Link>
				</SidebarHeader>

				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								{NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
									<SidebarMenuItem key={to}>
										<SidebarMenuButton asChild>
											<Link
												to={to}
												activeOptions={{ exact }}
												activeProps={{ "data-active": true }}
											>
												<Icon className="size-4" />
												<span>{label}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>

				<SidebarFooter className="border-t border-border/60">
					<p className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
						v0.1.0 · self-hosted
					</p>
				</SidebarFooter>
			</Sidebar>

			<div className="flex min-h-screen flex-1 flex-col bg-background">
				<header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-3">
					<SidebarTrigger />
					<Separator orientation="vertical" className="h-4" />
					<span className="font-mono text-xs text-muted-foreground">
						/{location.pathname.split("/").filter(Boolean).join("/") || ""}
					</span>
				</header>

				<main className="flex-1 overflow-hidden">
					<Outlet />
				</main>
			</div>
		</SidebarProvider>
	);
}
