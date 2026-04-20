import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-transparent",
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-transparent",
  closed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-transparent",
};

export function StatusBadge({ status }: { status: "open" | "pending" | "closed" }) {
  return <Badge className={cn("capitalize font-medium", styles[status])}>{status}</Badge>;
}
