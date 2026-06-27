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



function AppLayout() {
	return (
		<SidebarProvider>
			<Sidebar collapsible="icon" className="border-r border-border/60">
				<SidebarHeader className="border-b border-border/60">
					<Link to="/" className="flex items-center gap-2 px-2 py-1.5">
						<img
							src="/favicon.svg"
							alt="Watchtower"
							className="size-5 shrink-0"
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
								<SidebarMenuItem>
									<SidebarMenuButton asChild>
										<Link
											to="/overview"
											activeOptions={{ exact: true }}
											activeProps={{ "data-active": true }}
										>
											<SquareTerminal className="size-4" />
											<span>Overview</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								
								<SidebarMenuItem>
									<SidebarMenuButton asChild>
										<Link
											to="/logs"
											activeOptions={{ exact: false }}
											activeProps={{ "data-active": true }}
										>
											<Activity className="size-4" />
											<span>Live logs</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								
								<SidebarMenuItem>
									<SidebarMenuButton asChild>
										<Link
											to="/search"
											search={{
												from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
												to: new Date().toISOString(),
												limit: 50,
											}}
											activeOptions={{ exact: false }}
											activeProps={{ "data-active": true }}
										>
											<Search className="size-4" />
											<span>Search</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
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
