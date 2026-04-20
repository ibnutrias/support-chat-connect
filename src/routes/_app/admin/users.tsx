import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, UserCog, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/format";

export const Route = createFileRoute("/_app/admin/users")({
  component: AdminUsers,
  head: () => ({ meta: [{ title: "Manage users — CedarSupport" }] }),
});

interface Row { id: string; email: string; display_name: string | null; roles: string[]; }

function AdminUsers() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: profs } = await supabase.from("profiles").select("id,email,display_name").order("created_at", { ascending: false });
    const { data: roles } = await supabase.from("user_roles").select("user_id,role");
    const map: Record<string, string[]> = {};
    (roles ?? []).forEach((r) => { (map[r.user_id] ??= []).push(r.role); });
    setRows((profs ?? []).map((p) => ({ ...p, roles: map[p.id] ?? [] })));
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const setRole = async (userId: string, role: "support" | "admin", on: boolean) => {
    if (on) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
    }
    toast.success("Updated");
    load();
  };

  if (!isAdmin) return <div className="p-10 text-muted-foreground">Admins only.</div>;

  return (
    <div className="max-w-5xl mx-auto p-8 md:p-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-foreground">Manage Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Promote users to support or admin.</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-card border rounded-2xl overflow-hidden">
          {rows.map((r) => {
            const isSupport = r.roles.includes("support");
            const isAdminRole = r.roles.includes("admin");
            return (
              <div key={r.id} className="flex items-center justify-between gap-4 p-5 border-b last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-full bg-accent/20 text-accent-foreground flex items-center justify-center text-sm font-medium">
                    {initials(r.display_name ?? r.email)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.display_name ?? r.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={isSupport ? "default" : "outline"} size="sm" onClick={() => setRole(r.id, "support", !isSupport)}>
                    <UserCog className="size-3.5 mr-1.5" /> Support
                  </Button>
                  <Button variant={isAdminRole ? "default" : "outline"} size="sm" onClick={() => setRole(r.id, "admin", !isAdminRole)}>
                    <ShieldCheck className="size-3.5 mr-1.5" /> Admin
                  </Button>
                  {!isSupport && !isAdminRole && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><UserIcon className="size-3.5"/> User</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
