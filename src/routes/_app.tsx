import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Inbox, Users, Settings, ListChecks, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function NavItem({ to, icon: Icon, label, exact }: { to: string; icon: typeof Inbox; label: string; exact?: boolean }) {
  const loc = useLocation();
  const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
        active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

function AppLayout() {
  const { user, loading, isStaff, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 border-r bg-sidebar flex flex-col p-4 sticky top-0 h-screen">
        <div className="px-2 py-2 mb-6"><Logo /></div>
        <nav className="space-y-1 flex-1">
          <NavItem to="/dashboard" icon={Inbox} label="My Tickets" exact />
          {isStaff && <NavItem to="/queue" icon={ListChecks} label="Support Queue" />}
          {isAdmin && <NavItem to="/admin/users" icon={Users} label="Manage Users" />}
          <NavItem to="/settings" icon={Settings} label="Settings" />
        </nav>
        <div className="border-t pt-3 mt-3">
          <div className="px-3 py-2 text-xs">
            <div className="font-medium text-foreground truncate">{user.email}</div>
            <div className="text-muted-foreground capitalize">
              {isAdmin ? "Admin" : isStaff ? "Support" : "User"}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
