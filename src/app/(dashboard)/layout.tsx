import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  Bell,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Settings,
  Webhook,
} from "lucide-react";
import Logo from "@/components/ui/Logo";
import LogoutButton from "@/components/dashboard/LogoutButton";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/incidents", label: "Incidents", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/5 bg-night-800/60 md:flex">
        <div className="flex h-16 items-center border-b border-white/5 px-5">
          <Logo href="/dashboard" />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/5 p-4">
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/5 bg-night/80 px-6 backdrop-blur-xl">
          <p className="text-sm font-medium text-slate-400">Monitoring Console</p>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="btn-ghost !py-2 text-xs">
              <KeyRound className="h-3.5 w-3.5" /> API keys
            </Link>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
