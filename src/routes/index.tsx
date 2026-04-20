import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { MessageSquare, Sparkles, Shield, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "CedarSupport — Realtime support tickets, with AI" },
      { name: "description", content: "Open a ticket, chat live with our support team, attach images, and get AI-assisted answers." },
      { property: "og:title", content: "CedarSupport — Realtime support, with AI" },
      { property: "og:description", content: "Realtime ticket chat with image support and an AI helper." },
    ],
  }),
});

function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background bg-grain">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <Logo />
        <nav className="flex items-center gap-3">
          {user ? (
            <Button asChild><Link to="/dashboard">Open dashboard</Link></Button>
          ) : (
            <>
              <Button variant="ghost" asChild><Link to="/login">Sign in</Link></Button>
              <Button asChild><Link to="/signup">Get started</Link></Button>
            </>
          )}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-10 pt-12 md:pt-20 pb-20">
        <section className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 text-accent-foreground text-xs font-medium mb-6">
            <Sparkles className="size-3.5" /> Now with AI assistance & MCP
          </div>
          <h1 className="font-display text-5xl md:text-6xl text-foreground text-balance leading-[1.05]">
            Support that feels like a <span className="text-primary">real conversation</span>.
          </h1>
          <p className="text-lg text-muted-foreground mt-6 text-balance">
            Open a ticket, chat with our team in realtime, drop in screenshots, and let our AI
            assistant help on both sides of the conversation.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to={user ? "/dashboard" : "/signup"}>
                {user ? "Go to dashboard" : "Open your first ticket"}
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="mt-24 grid md:grid-cols-4 gap-5">
          {[
            { Icon: MessageSquare, title: "Realtime chat", body: "Messages appear instantly — no refresh, no waiting." },
            { Icon: ImageIcon, title: "Image attachments", body: "Drop a screenshot to explain the issue faster." },
            { Icon: Sparkles, title: "AI side panel", body: "Get suggestions while writing — for users and agents alike." },
            { Icon: Shield, title: "MCP-ready", body: "Expose your tickets to your AI tools via Model Context Protocol." },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="bg-card border rounded-2xl p-6 hover:shadow-md transition-shadow">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Icon className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Built with Lovable Cloud · Realtime · AI
      </footer>
    </div>
  );
}
