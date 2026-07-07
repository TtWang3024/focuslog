import * as React from "react";

// Trash/bin icon, matching the one used on the break/pause/session rows.
export function Trash({ size = 13 }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

// A small info icon that reveals a formatted hover card anchored under its top-right corner —
// the same pattern as the Timeline's how-it-works intro. The card content is the children.
export function InfoHover({ C, label, width = 330, children }: any) {
  const [open, setOpen] = React.useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span aria-label={open ? undefined : label} style={{ display: "inline-flex", color: C.muted }}>
        <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
      </span>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 22, width, maxWidth: "84vw", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 16px", zIndex: 60, boxShadow: "0 6px 24px rgba(0,0,0,0.16)", fontSize: 12.5, fontWeight: 400, color: C.ink, lineHeight: 1.5, textAlign: "left" }}>
          {children}
        </div>
      )}
    </span>
  );
}
