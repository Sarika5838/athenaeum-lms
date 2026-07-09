import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ArrowLeftRight,
  Clock,
  FileBarChart,
  Settings as SettingsIcon,
  Moon,
  Sun,
  LogOut,
  Library,
  Search,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/lms/auth";
import { useTheme } from "@/lib/lms/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/books", label: "Books", icon: BookOpen },
  { to: "/students", label: "Students", icon: Users },
  { to: "/issues", label: "Issue & Return", icon: ArrowLeftRight },
  { to: "/queue", label: "Waiting Queue", icon: Clock },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    navigate({ to: "/books", search: { q: search.trim() } as never });
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center">
              <Library className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg leading-tight">Athenaeum</div>
              <div className="text-xs opacity-70">Library System</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "hover:bg-sidebar-accent/60"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border text-xs opacity-80">
          <div className="px-3 py-2">
            <div className="font-medium truncate">{user?.fullName}</div>
            <div className="opacity-70 truncate">{user?.email}</div>
            <div className="mt-1 inline-block px-2 py-0.5 rounded bg-sidebar-primary/20 text-sidebar-primary-foreground text-[10px] uppercase tracking-wide">
              {isAdmin ? "Admin" : "Librarian"}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card/50 backdrop-blur flex items-center gap-4 px-4 md:px-6">
          <form onSubmit={handleSearch} className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search books, authors, ISBN…"
              className="pl-9"
            />
          </form>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <nav className="md:hidden flex overflow-x-auto border-b bg-card/50">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-4 py-3 text-xs whitespace-nowrap ${active ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-4 md:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
