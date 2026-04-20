import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export function NewTicketDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated?: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user || !subject.trim()) return;
    setSubmitting(true);
    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({ subject: subject.trim(), description: description.trim() || null, user_id: user.id })
      .select("id")
      .single();
    if (error || !ticket) {
      toast.error(error?.message ?? "Failed to create ticket");
      setSubmitting(false);
      return;
    }
    if (description.trim()) {
      await supabase.from("messages").insert({
        ticket_id: ticket.id, sender_id: user.id, body: description.trim(),
      });
    }
    toast.success("Ticket created");
    setSubject(""); setDescription("");
    onOpenChange(false);
    onCreated?.();
    navigate({ to: "/tickets/$ticketId", params: { ticketId: ticket.id } });
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">New ticket</DialogTitle>
          <DialogDescription>Tell us what's going on. You can attach images in the chat after creating the ticket.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" placeholder="Brief summary" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description (optional)</Label>
            <Textarea id="desc" placeholder="Describe the issue..." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !subject.trim()}>
            {submitting ? "Creating..." : "Create ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
