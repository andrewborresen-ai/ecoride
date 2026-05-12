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
  LogOut,
  Menu
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
];

export function Sidebar() {
  const [location] = useLocation();
  const { signOut } = useClerk();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-[#1C2126] text-white">
      <div className="flex h-16 items-center px-6 border-b border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl text-[#3DB324]">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="EcoRide" className="h-8 w-8" />
          <span>EcoRide</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#3DB324] text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-gray-800">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
          onClick={() => signOut()}
          data-testid="nav-signout"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useUser();

  return (
    <div className="flex min-h-[100dvh] w-full bg-gray-50">
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 lg:px-8">
          <div className="flex items-center gap-4 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 border-r-0">
                <Sidebar />
              </SheetContent>
            </Sheet>
            <span className="font-bold text-[#1C2126]">EcoRide Admin</span>
          </div>
          
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
            <div className="h-8 w-8 rounded-full bg-[#3DB324] flex items-center justify-center text-white font-bold text-sm">
              {user?.firstName?.charAt(0) || user?.primaryEmailAddress?.emailAddress?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
