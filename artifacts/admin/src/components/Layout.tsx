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
    <div className="flex h-full w-60 flex-col bg-white border-r border-slate-100">
      {/* Brand */}
      <div className="flex h-[68px] items-center gap-3 px-5 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-[9px] overflow-hidden shadow-sm">
            <img
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt="EcoRide"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-slate-800 leading-tight tracking-tight">EcoRide</div>
            <div className="text-[10px] font-semibold text-[#3DB324] leading-tight tracking-widest uppercase">
              Admin
            </div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <p className="px-2 mb-2 text-[10.5px] font-semibold text-slate-400 uppercase tracking-widest">Menu</p>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-[#3DB324]/10 text-[#2d9119]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon
                  className={`h-[16px] w-[16px] flex-shrink-0 transition-colors ${
                    isActive ? "text-[#3DB324]" : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3DB324] flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-100">
        <button
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all"
          onClick={() => signOut()}
          data-testid="nav-signout"
        >
          <LogOut className="h-[16px] w-[16px] flex-shrink-0" />
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
    <div className="flex min-h-[100dvh] w-full bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block flex-shrink-0">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-slate-100 bg-white px-4 lg:px-6 shadow-none">
          {/* Mobile: hamburger + wordmark */}
          <div className="flex items-center gap-3 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-600">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-60 p-0 border-r-0">
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
              <span className="font-bold text-[15px] text-slate-800">EcoRide</span>
            </div>
          </div>

          <div className="hidden lg:block" />

          {/* Right side: user info */}
          <div className="ml-auto flex items-center gap-3">
            {email && (
              <span className="hidden sm:block text-sm text-slate-400 font-medium truncate max-w-[200px]">
                {email}
              </span>
            )}
            <div className="h-8 w-8 rounded-full bg-[#3DB324] flex items-center justify-center text-white font-bold text-sm select-none">
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
