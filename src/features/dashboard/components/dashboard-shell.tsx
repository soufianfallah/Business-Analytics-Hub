"use client";

import {
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Database,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  ScrollText,
  Settings,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";

type DashboardUser = { name: string; email: string; image?: string | null };

const primaryNavigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Dashboards", href: "/dashboard/dashboards", icon: BarChart3 },
  { label: "Reports", href: "/dashboard/reports", icon: FileBarChart },
  { label: "Datasets", href: "/dashboard/datasets", icon: Database },
  { label: "AI Assistant", href: "/dashboard/ai", icon: Bot },
];

const workspaceNavigation = [
  { label: "Organizations", href: "/dashboard/organizations", icon: Users },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { label: "Audit logs", href: "/dashboard/audit", icon: ScrollText },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function DashboardShell({
  children,
  user,
}: {
  children: ReactNode;
  user: DashboardUser;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen bg-[#fafafa] dark:bg-background">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-background lg:block">
          <Sidebar user={user} />
        </aside>
        <div className="lg:pl-64">
          <TopNavigation
            user={user}
            mobileOpen={mobileOpen}
            onMobileOpenChange={setMobileOpen}
          />
          <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Sidebar({
  user,
  onNavigate,
}: {
  user: DashboardUser;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
          <Sparkles className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">
            Business Analytics
          </p>
          <p className="text-[11px] text-muted-foreground">Workspace</p>
        </div>
      </div>
      <Separator />
      <nav
        className="flex-1 space-y-7 overflow-y-auto px-3 py-5"
        aria-label="Main navigation"
      >
        <NavigationGroup items={primaryNavigation} onNavigate={onNavigate} />
        <div>
          <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
          <NavigationGroup
            items={workspaceNavigation}
            onNavigate={onNavigate}
          />
        </div>
      </nav>
      <div className="border-t p-3">
        <Link
          className="mb-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          href="/dashboard/help"
          onClick={onNavigate}
        >
          <CircleHelp className="size-4" />
          Help & support
        </Link>
        <ProfileMenu user={user} fullWidth />
      </div>
    </div>
  );
}

function NavigationGroup({
  items,
  onNavigate,
}: {
  items: typeof primaryNavigation;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
              )}
              href={item.href}
              onClick={onNavigate}
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TopNavigation({
  user,
  mobileOpen,
  onMobileOpenChange,
}: {
  user: DashboardUser;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  return (
    <header className="sticky top-0 z-30 h-16 border-b bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetTrigger asChild>
            <Button
              className="lg:hidden"
              size="icon"
              variant="ghost"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[290px] p-0" side="left">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar user={user} onNavigate={() => onMobileOpenChange(false)} />
          </SheetContent>
        </Sheet>
        <DashboardBreadcrumb />
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <SearchBox />
          <ThemeToggle />
          <NotificationMenu />
          <div className="hidden sm:block">
            <ProfileMenu user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}

function DashboardBreadcrumb() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean).slice(1);
  return (
    <Breadcrumb className="hidden min-w-0 md:block">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {parts.map((part, index) => {
          const href = `/dashboard/${parts.slice(0, index + 1).join("/")}`;
          const label = part
            .replaceAll("-", " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
          const last = index === parts.length - 1;
          return (
            <span className="contents" key={href}>
              <BreadcrumbSeparator />{" "}
              <BreadcrumbItem>
                {last ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function SearchBox() {
  return (
    <div className="relative hidden w-48 xl:block 2xl:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-9 bg-muted/40 pl-9 pr-12"
        placeholder="Search…"
        aria-label="Search dashboard"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground 2xl:inline">
        ⌘ K
      </kbd>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Toggle color theme"
          disabled={!mounted}
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Toggle theme</TooltipContent>
    </Tooltip>
  );
}

function NotificationMenu() {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              className="relative"
              size="icon"
              variant="ghost"
              aria-label="Open notifications"
            >
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-blue-500 ring-2 ring-background" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <span className="text-xs font-normal text-muted-foreground">
            1 unread
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-2">
          <div className="rounded-md bg-accent/60 p-3">
            <div className="flex gap-3">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-blue-500" />
              <div>
                <p className="text-sm font-medium">
                  Welcome to your analytics hub
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Create an organization to start collaborating with your team.
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Just now
                </p>
              </div>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileMenu({
  user,
  fullWidth = false,
}: {
  user: DashboardUser;
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn("h-10 gap-2 px-2", fullWidth && "w-full justify-start")}
          variant="ghost"
        >
          <Avatar className="size-7">
            <AvatarImage alt="" src={user.image ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {initials || "U"}
            </AvatarFallback>
          </Avatar>
          {fullWidth ? (
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-xs font-medium">{user.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {user.email}
              </p>
            </div>
          ) : null}
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={fullWidth ? "start" : "end"} className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings className="size-4" />
            Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={async () => {
            await authClient.signOut();
            router.push("/login");
            router.refresh();
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
