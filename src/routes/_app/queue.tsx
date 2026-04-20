import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { formatRelative, initials } from "@/lib/format";
import { Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/queue")({
  component: QueuePage,
  head: () => ({ meta: [{ title: "Support queue — CedarSupport" }] }),
});

interface Row {
  id: string; subject: string; status: "open" | "pending" | "closed";
  user_id: string; assigned_to: string | null; updated_at: string;
}

function QueuePage() {
  const { user, isStaff } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string | null; email: string }>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "pending" | "closed" | "mine">("all");

  const load = async () => {
    const { data } = await supabase.from("tickets").select("id,subject,status,user_id,assigned_to,updated_at").order("updated_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    const ids = Array.from(new Set((data ?? []).flatMap((r) => [r.user_id, r.assigned_to]).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,display_name,email").in("id", ids);
      const map: Record<string, { display_name: string | null; email: string }> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { if (isStaff) load(); }, [isStaff]);

  useEffect(() => {
    const ch = supabase.channel("queue-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const assign = async (id: string) => {
    if (!user) return;
    await supabase.from("tickets").update({ assigned_to: user.id }).eq("id", id);
  };

  if (!isStaff) return <div className="p-10 text-muted-foreground">You don't have access to this page.</div>;

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "mine") return r.assigned_to === user?.id;
    return r.status === filter;
  });

  return (
    <div className="max-w-7xl mx-auto p-8 md:p-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-foreground">Support Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">All customer conversations across the team.</p>
      </div>
      <div className="flex gap-2 mb-5">
        {(["all", "open", "pending", "closed", "mine"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed rounded-2xl py-16 text-center">
          <Inbox className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No tickets match this filter.</p>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="text-left px-5 py-3">Subject</th>
                <th className="text-left px-5 py-3">Customer</th>
                <th className="text-left px-5 py-3">Assigned</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const c = profiles[r.user_id];
                const a = r.assigned_to ? profiles[r.assigned_to] : null;
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/40 transition-colors">
                    <td className="px-5 py-4">
                      <Link to="/tickets/$ticketId" params={{ ticketId: r.id }} className="font-medium text-foreground hover:text-primary">
                        {r.subject}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-full bg-accent/20 text-accent-foreground flex items-center justify-center text-xs font-medium">
                          {initials(c?.display_name ?? c?.email)}
                        </div>
                        <span className="text-sm">{c?.display_name ?? c?.email ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {a ? (
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-medium">
                            {initials(a.display_name ?? a.email)}
                          </div>
                          <span className="text-sm">{a.display_name ?? a.email}</span>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => assign(r.id)}>Assign me</Button>
                      )}
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-4 text-right text-muted-foreground">{formatRelative(r.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
