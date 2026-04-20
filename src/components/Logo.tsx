import { Link } from "@tanstack/react-router";

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm transition-transform group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
      </div>
      {!collapsed && (
        <span className="font-display text-xl text-primary">CedarSupport</span>
      )}
    </Link>
  );
}
