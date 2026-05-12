import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  LayoutDashboard,
  Users,
  Car,
  FileText,
  CalendarDays,
  Key,
  DollarSign,
  Bell,
  Settings,
  LogOut,
  Menu,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/drivers", label: "Drivers", icon: Users },
  { href: "/vehicles", label: "Vehicles", icon: Car },
  { href: "/agreements", label: "Agreements", icon: FileText },
  { href: "/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/fleet-access", label: "Fleet Access", icon: Key },
  { href: "/earnings", label: "Earnings", icon: DollarSign },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { signOut } = useClerk();

  return (
    <div className="flex h-full w-64 flex-col bg-[#1C2126] text-white">
      {/* Brand */}
      <div className="flex h-[68px] items-center gap-3 px-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-[10px] overflow-hidden">
            <img
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt="EcoRide"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-white leading-tight">EcoRide</div>
            <div className="text-[11px] font-semibold text-[#3DB324] leading-tight tracking-wide uppercase">
              Admin
            </div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-3">
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all ${
                  isActive
                    ? "bg-[#3DB324] text-white shadow-sm"
                    : "text-white/60 hover:bg-white/8 hover:text-white"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon
                  className={`h-[18px] w-[18px] flex-shrink-0 ${
                    isActive ? "text-white" : "text-white/50 group-hover:text-white"
                  }`}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-white/70" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10">
        <button
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-white/50 hover:bg-white/8 hover:text-white transition-all"
          onClick={() => signOut()}
          data-testid="nav-signout"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const initials =
    user?.firstName?.charAt(0) ||
    user?.primaryEmailAddress?.emailAddress?.charAt(0)?.toUpperCase() ||
    "A";
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <div className="flex min-h-[100dvh] w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block flex-shrink-0">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-border bg-card px-4 lg:px-6 shadow-none">
          {/* Mobile: hamburger + wordmark */}
          <div className="flex items-center gap-3 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-foreground">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 border-r-0">
                <Sidebar />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden">
                <img
                  src={`${import.meta.env.BASE_URL}logo.svg`}
                  alt="EcoRide"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-bold text-[15px] text-foreground">EcoRide</span>
            </div>
          </div>

          {/* Desktop: empty left to keep header aligned with content */}
          <div className="hidden lg:block" />

          {/* Right side: user info */}
          <div className="ml-auto flex items-center gap-3">
            {email && (
              <span className="hidden sm:block text-sm text-muted-foreground font-medium truncate max-w-[200px]">
                {email}
              </span>
            )}
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-sm shadow-sm select-none">
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 xl:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
