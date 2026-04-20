import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Loader2, Copy, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Ticket {
  id: string; subject: string; description: string | null; status: string;
}
interface Message {
  id: string; sender_id: string | null; body: string | null; image_url: string | null;
}

export function AiPanel({
  ticket, messages, isStaff, onClose, onInsert,
}: {
  ticket: Ticket;
  messages: Message[];
  isStaff: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (preset?: string) => {
    const userPrompt = preset ?? prompt;
    if (!userPrompt.trim()) return;
    setLoading(true);
    setResponse("");
    try {
      const transcript = messages
        .map((m) => `${m.sender_id === ticket["user_id" as keyof Ticket] ? "Customer" : "Agent"}: ${m.body ?? "[image]"}`)
        .join("\n");
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          role: isStaff ? "agent" : "user",
          ticket: { subject: ticket.subject, description: ticket.description, status: ticket.status },
          transcript,
          prompt: userPrompt,
        },
      });
      if (error) throw error;
      setResponse(data?.text ?? "(no response)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  const presets = isStaff
    ? [
        { label: "Suggest a reply", prompt: "Draft a helpful, professional reply to the customer based on the conversation so far." },
        { label: "Summarize ticket", prompt: "Summarize this ticket in 2-3 sentences for handoff." },
        { label: "Identify next step", prompt: "What's the next best action to resolve this ticket?" },
      ]
    : [
        { label: "Help me describe this", prompt: "Help me write a clearer description of my problem." },
        { label: "Suggest a fix", prompt: "Based on what I've shared, what could I try myself first?" },
        { label: "Polish my message", prompt: "Make my last message clearer and more polite." },
      ];

  return (
    <aside className="w-96 border-l bg-card flex flex-col h-screen">
      <header className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-accent/20 text-accent-foreground flex items-center justify-center">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="font-display text-base">AI Assistant</div>
            <div className="text-xs text-muted-foreground">{isStaff ? "Agent helper" : "Self-service helper"}</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
      </header>

      <div className="px-5 py-4 space-y-2 border-b">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Quick prompts</div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Button key={p.label} variant="secondary" size="sm" onClick={() => send(p.prompt)} disabled={loading}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Thinking...
          </div>
        ) : response ? (
          <div className="space-y-3">
            <div className="prose prose-sm max-w-none text-foreground">
              <ReactMarkdown>{response}</ReactMarkdown>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(response); toast.success("Copied"); }}>
                <Copy className="size-3.5 mr-1.5" /> Copy
              </Button>
              <Button size="sm" onClick={() => onInsert(response)}>
                <ArrowDown className="size-3.5 mr-1.5" /> Insert
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Pick a quick prompt or ask anything below.</p>
        )}
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Ask the AI..."
            className="flex-1 px-3 py-2 text-sm border rounded-lg bg-background"
          />
          <Button size="sm" onClick={() => send()} disabled={loading || !prompt.trim()}>Send</Button>
        </div>
      </div>
    </aside>
  );
}
