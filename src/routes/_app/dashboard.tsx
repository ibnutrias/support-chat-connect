import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquareText, Loader2 } from "lucide-react";
import { NewTicketDialog } from "@/components/NewTicketDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "My tickets — CedarSupport" }] }),
});

interface Ticket {
  id: string;
  subject: string;
  status: "open" | "pending" | "closed";
  created_at: string;
  updated_at: string;
}

function DashboardPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tickets")
      .select("id,subject,status,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // realtime: refresh when a ticket changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`my-tickets-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="max-w-5xl mx-auto p-8 md:p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-foreground">My Tickets</h1>
          <p className="text-sm text-muted-foreground mt-1">Your conversations with our support team.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4 mr-1.5" /> New ticket
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : tickets.length === 0 ? (
        <div className="border border-dashed rounded-2xl py-16 px-6 text-center">
          <MessageSquareText className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium text-foreground">No tickets yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Open your first ticket to start a conversation.</p>
          <Button className="mt-5" onClick={() => setOpen(true)}>
            <Plus className="size-4 mr-1.5" /> New ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Link
              key={t.id}
              to="/tickets/$ticketId"
              params={{ ticketId: t.id }}
              className="block bg-card border rounded-2xl p-5 hover:shadow-sm hover:border-primary/30 transition-all"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{t.subject}</div>
                  <div className="text-xs text-muted-foreground mt-1">Updated {formatRelative(t.updated_at)}</div>
                </div>
                <StatusBadge status={t.status} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <NewTicketDialog open={open} onOpenChange={setOpen} onCreated={load} />
    </div>
  );
}
