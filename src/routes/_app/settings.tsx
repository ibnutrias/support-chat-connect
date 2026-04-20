import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — CedarSupport" }] }),
});

function SettingsPage() {
  const { user, isAdmin } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.display_name ?? ""));
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    if (error) toast.error(error.message); else toast.success("Saved");
    setSaving(false);
  };

  const mcpUrl = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";

  return (
    <div className="max-w-3xl mx-auto p-8 md:p-10 space-y-8">
      <div>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and integrations.</p>
      </div>

      <section className="bg-card border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dn">Display name</Label>
          <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
      </section>

      {isAdmin && (
        <section className="bg-card border rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-semibold">MCP Server endpoint</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Connect MCP-compatible AI clients (Claude Desktop, Cursor, etc.) to your tickets via the
              Streamable HTTP transport. For STDIO-based desktop clients, use the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">mcp-remote</code> bridge.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Endpoint URL</Label>
            <div className="flex gap-2">
              <Input value={mcpUrl} readOnly />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(mcpUrl); toast.success("Copied"); }}>
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <div className="bg-muted/40 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap">
{`# Claude Desktop config (stdio bridge):
{
  "mcpServers": {
    "cedar-support": {
      "command": "npx",
      "args": ["mcp-remote", "${mcpUrl}"]
    }
  }
}`}
          </div>
        </section>
      )}
    </div>
  );
}
