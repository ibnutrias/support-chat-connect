import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Paperclip, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { formatTime, initials } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AiPanel } from "@/components/AiPanel";
import { SentimentArc } from "@/components/SentimentArc";

export const Route = createFileRoute("/_app/tickets/$ticketId")({
  component: TicketPage,
});

interface Ticket {
  id: string; subject: string; description: string | null;
  status: "open" | "pending" | "closed";
  user_id: string; assigned_to: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  sentiment_score: number | null; sentiment_summary: string | null;
  created_at: string; closed_at: string | null;
}
interface Message {
  id: string; ticket_id: string; sender_id: string | null;
  body: string | null; image_url: string | null; created_at: string;
}
interface Profile { id: string; display_name: string | null; email: string; avatar_url: string | null; }

function TicketPage() {
  const { ticketId } = Route.useParams();
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const loadAll = async () => {
    const { data: t, error } = await supabase.from("tickets").select("*").eq("id", ticketId).maybeSingle();
    if (error || !t) { toast.error("Ticket not found"); navigate({ to: "/dashboard" }); return; }
    setTicket(t as Ticket);
    const { data: msgs } = await supabase.from("messages").select("*").eq("ticket_id", ticketId).order("created_at");
    setMessages((msgs ?? []) as Message[]);
    const ids = Array.from(new Set([t.user_id, ...(msgs ?? []).map((m) => m.sender_id).filter(Boolean) as string[]]));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,display_name,email,avatar_url").in("id", ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p as Profile; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [ticketId]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase.channel(`ticket-${ticketId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
          // load missing profile if needed
          if (newMsg.sender_id && !profiles[newMsg.sender_id]) {
            supabase.from("profiles").select("id,display_name,email,avatar_url").eq("id", newMsg.sender_id).maybeSingle()
              .then(({ data }) => { if (data) setProfiles((p) => ({ ...p, [data.id]: data as Profile })); });
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets", filter: `id=eq.${ticketId}` },
        (payload) => setTicket(payload.new as Ticket))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  // autoscroll
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string, imageUrl?: string) => {
    const content = (text ?? body).trim();
    if (!content && !imageUrl) return;
    if (!user || !ticket) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      ticket_id: ticketId, sender_id: user.id, body: content || null, image_url: imageUrl || null,
    });
    if (error) toast.error(error.message);
    else {
      setBody("");
      // bump ticket updated_at + set pending if user replied to closed-ish flow
      if (isStaff && ticket.status === "open") {
        await supabase.from("tickets").update({ status: "pending" }).eq("id", ticketId);
      } else if (!isStaff && ticket.status === "pending") {
        await supabase.from("tickets").update({ status: "open" }).eq("id", ticketId);
      }
    }
    setSending(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/${ticketId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("ticket-attachments").upload(path, file);
    if (upErr) { toast.error(upErr.message); return; }
    const { data: { publicUrl } } = supabase.storage.from("ticket-attachments").getPublicUrl(path);
    await sendMessage("", publicUrl);
  };

  const closeTicket = async () => {
    if (!ticket) return;
    setClosing(true);
    await supabase.from("tickets").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", ticketId);
    // trigger sentiment analysis
    try {
      await supabase.functions.invoke("analyze-sentiment", { body: { ticketId } });
    } catch { /* non-blocking */ }
    toast.success("Ticket closed");
    setClosing(false);
  };

  if (loading || !ticket) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  const userProfile = profiles[ticket.user_id];

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b bg-card/50 backdrop-blur px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild>
              <Link to={isStaff ? "/queue" : "/dashboard"}><ArrowLeft className="size-4" /></Link>
            </Button>
            <div className="min-w-0">
              <h1 className="font-display text-xl text-foreground truncate">{ticket.subject}</h1>
              <p className="text-xs text-muted-foreground">
                {userProfile?.display_name ?? userProfile?.email ?? "Customer"} · #{ticket.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={ticket.status} />
            <Button variant="outline" size="sm" onClick={() => setAiOpen((v) => !v)}>
              <Sparkles className="size-4 mr-1.5" /> AI
            </Button>
            {isStaff && ticket.status !== "closed" && (
              <Button variant="default" size="sm" onClick={closeTicket} disabled={closing}>
                <CheckCircle2 className="size-4 mr-1.5" /> {closing ? "Closing..." : "Close"}
              </Button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-background">
          {ticket.status === "closed" && ticket.sentiment && (
            <div className="max-w-md mx-auto bg-card border rounded-2xl p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground text-center mb-2">Conversation sentiment</div>
              <SentimentArc label={ticket.sentiment} score={ticket.sentiment_score ?? 0.5} />
              {ticket.sentiment_summary && (
                <p className="text-sm text-muted-foreground text-center mt-3 italic">"{ticket.sentiment_summary}"</p>
              )}
            </div>
          )}

          {messages.map((m) => {
            const mine = m.sender_id === user!.id;
            const sender = m.sender_id ? profiles[m.sender_id] : null;
            const isStaffMsg = m.sender_id !== ticket.user_id && m.sender_id !== null;
            return (
              <div key={m.id} className={cn("flex gap-3", mine ? "flex-row-reverse" : "flex-row")}>
                <div className={cn(
                  "size-9 shrink-0 rounded-full flex items-center justify-center text-xs font-medium",
                  isStaffMsg ? "bg-primary/15 text-primary" : "bg-accent/20 text-accent-foreground"
                )}>
                  {initials(sender?.display_name ?? sender?.email)}
                </div>
                <div className={cn("max-w-[75%] space-y-1", mine ? "items-end" : "items-start", "flex flex-col")}>
                  <div className={cn(
                    "px-4 py-2.5 rounded-2xl shadow-sm",
                    mine ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border rounded-tl-sm",
                  )}>
                    {m.image_url && (
                      <a href={m.image_url} target="_blank" rel="noreferrer">
                        <img src={m.image_url} alt="attachment" className="max-h-64 rounded-lg mb-2" />
                      </a>
                    )}
                    {m.body && <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1">
                    {sender?.display_name ?? sender?.email ?? "Unknown"} · {formatTime(m.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        {ticket.status !== "closed" ? (
          <div className="border-t bg-card/50 p-4">
            <div className="flex items-end gap-2 max-w-4xl mx-auto">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
              <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} title="Attach image">
                <Paperclip className="size-5" />
              </Button>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type your message... (Enter to send)"
                rows={1}
                className="resize-none min-h-[44px] max-h-32"
              />
              <Button onClick={() => sendMessage()} disabled={sending || !body.trim()} size="icon">
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            This ticket is closed.
          </div>
        )}
      </div>

      {aiOpen && (
        <AiPanel
          ticket={ticket}
          messages={messages}
          isStaff={isStaff}
          onClose={() => setAiOpen(false)}
          onInsert={(text) => setBody((b) => (b ? b + "\n" : "") + text)}
        />
      )}
    </div>
  );
}
