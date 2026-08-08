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
// Every view's sub-navigation bar: the segmented control on the left, anything else and the
// info button on the right. Shared so the info button lands on exactly the same spot, and the
// bar keeps the same height, whichever view you switch to - including views with no control.
export const SUBBAR: any = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 32, marginBottom: 16, flexWrap: "wrap" };

// Sub-level tabs: quiet text with a terracotta underline - deliberately NOT the pill track,
// so the two navigation levels stop dressing alike (pills = where in the app, underline =
// which section of the place you are in).
export const subTab = (on: boolean): any => ({
  padding: "5px 2px", border: "none", borderBottom: `2px solid ${on ? "#C57B5A" : "transparent"}`,
  background: "transparent", boxShadow: "none", borderRadius: 0,
  color: on ? "#2b2723" : "#8a8175", fontSize: 13, fontWeight: on ? 700 : 500,
  cursor: "pointer", fontFamily: "var(--fl-display)",
  display: "inline-flex", alignItems: "center", gap: 5 });
export const SUBTAB_ROW: any = { display: "inline-flex", alignItems: "center", gap: 14, flexShrink: 0, marginLeft: -2 };

// Two-weight glyphs shared across views (the Focus/Sky tomato, the surf/Sky water):
// the regular outline resting, the heavier cut when that tab is the open one.
export function TomatoIcon({ size = 14, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d={on ? "M15.8,5.016c1.047-.61,3.313-3.1,1.513-3.964a1,1,0,0,0-1.265.632A3.465,3.465,0,0,1,13,3.93V1a1,1,0,0,0-2,0V3.93A3.462,3.462,0,0,1,7.949,1.684a1,1,0,0,0-1.265-.632C4.882,1.92,7.147,4.4,8.2,5.016A8.786,8.786,0,0,0,0,14c0,4.721,4.276,10,10,10h4C26.507,24.063,27.352,5.878,15.8,5.016ZM16.97,9.242c-.738,2.131-4.747-.973-4.97-1.562-.211.579-4.235,3.7-4.97,1.562A1,1,0,0,1,7.757,8.03,4.188,4.188,0,0,0,10.711,6h2.577a4.187,4.187,0,0,0,2.954,2.03A1,1,0,0,1,16.97,9.242Z" : "M16.686,5.1c.952-.99,2.3-3.786.314-4.1a1,1,0,0,0-1,1c0,1.235-1.127,2.546-3,2.9V1a1,1,0,0,0-2,0V4.9C9.127,4.546,8,3.235,8,2A1,1,0,0,0,7,1c-1.983.312-.642,3.106.31,4.1A8.854,8.854,0,0,0,0,14c0,4.721,4.276,10,10,10h4C25.992,24.128,27.457,6.975,16.686,5.1ZM14,22H10a8.322,8.322,0,0,1-8-8c-.052-4.611,4.3-8.172,8.5-6.648A4.471,4.471,0,0,1,7.757,9.03a1,1,0,0,0-.727,1.212c.741,2.132,4.745-.975,4.968-1.565.209.579,4.237,3.7,4.972,1.565a1,1,0,0,0-.728-1.212A4.472,4.472,0,0,1,13.5,7.352C23.917,4.589,25.406,21.99,14,22Z"} />
    </svg>
  );
}
export function WaterIcon({ size = 14, on = false }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ display: "block" }}>
      <path d={on ? "M21,17a4.875,4.875,0,0,1-2.8-.9.333.333,0,0,0-.406,0,4.91,4.91,0,0,1-5.594,0,.333.333,0,0,0-.406,0,4.91,4.91,0,0,1-5.594,0,.333.333,0,0,0-.406,0,4.759,4.759,0,0,1-5.051.3A1.5,1.5,0,1,1,2.254,13.8a1.707,1.707,0,0,0,1.805-.149,3.354,3.354,0,0,1,3.882,0,1.854,1.854,0,0,0,2.118,0,3.354,3.354,0,0,1,3.882,0,1.854,1.854,0,0,0,2.118,0,3.354,3.354,0,0,1,3.882,0,1.706,1.706,0,0,0,1.8.149,1.5,1.5,0,1,1,1.508,2.594A4.485,4.485,0,0,1,21,17Zm2.254,5.394A1.5,1.5,0,0,0,21.746,19.8a1.7,1.7,0,0,1-1.8-.149,3.352,3.352,0,0,0-3.882,0,1.854,1.854,0,0,1-2.118,0,3.352,3.352,0,0,0-3.882,0,1.854,1.854,0,0,1-2.118,0,3.352,3.352,0,0,0-3.882,0,1.7,1.7,0,0,1-1.805.149A1.5,1.5,0,0,0,.746,22.394,4.759,4.759,0,0,0,5.8,22.1a.333.333,0,0,1,.406,0,4.91,4.91,0,0,0,5.594,0,.333.333,0,0,1,.406,0,4.91,4.91,0,0,0,5.594,0,.333.333,0,0,1,.406,0A4.875,4.875,0,0,0,21,23,4.485,4.485,0,0,0,23.254,22.394Zm0-18A1.5,1.5,0,0,0,21.746,1.8a1.706,1.706,0,0,1-1.8-.149,3.352,3.352,0,0,0-3.882,0,1.854,1.854,0,0,1-2.118,0,3.352,3.352,0,0,0-3.882,0,1.854,1.854,0,0,1-2.118,0,3.352,3.352,0,0,0-3.882,0A1.707,1.707,0,0,1,2.254,1.8,1.5,1.5,0,1,0,.746,4.394,4.759,4.759,0,0,0,5.8,4.1a.333.333,0,0,1,.406,0,4.91,4.91,0,0,0,5.594,0,.333.333,0,0,1,.406,0,4.91,4.91,0,0,0,5.594,0,.333.333,0,0,1,.406,0A4.875,4.875,0,0,0,21,5,4.485,4.485,0,0,0,23.254,4.394Zm0,6A1.5,1.5,0,0,0,21.746,7.8a1.708,1.708,0,0,1-1.8-.149,3.352,3.352,0,0,0-3.882,0,1.854,1.854,0,0,1-2.118,0,3.352,3.352,0,0,0-3.882,0,1.854,1.854,0,0,1-2.118,0,3.352,3.352,0,0,0-3.882,0A1.709,1.709,0,0,1,2.254,7.8,1.5,1.5,0,0,0,.746,10.394,4.757,4.757,0,0,0,5.8,10.1a.333.333,0,0,1,.406,0,4.91,4.91,0,0,0,5.594,0,.333.333,0,0,1,.406,0,4.91,4.91,0,0,0,5.594,0,.333.333,0,0,1,.406,0A4.875,4.875,0,0,0,21,11,4.485,4.485,0,0,0,23.254,10.394Z" : "M21,23a4.375,4.375,0,0,1-3-1.225,4.336,4.336,0,0,1-6,0,4.336,4.336,0,0,1-6,0,4.186,4.186,0,0,1-5.668.2,1,1,0,1,1,1.335-1.489,2.2,2.2,0,0,0,3.388-.817,1.006,1.006,0,0,1,1.89,0,2.278,2.278,0,0,0,4.11,0,1.008,1.008,0,0,1,1.89,0,2.278,2.278,0,0,0,4.11,0,1.006,1.006,0,0,1,1.89,0,2.2,2.2,0,0,0,3.387.817,1,1,0,0,1,1.336,1.487A3.981,3.981,0,0,1,21,23Zm0-6a4.375,4.375,0,0,1-3-1.225,4.336,4.336,0,0,1-6,0,4.336,4.336,0,0,1-6,0,4.186,4.186,0,0,1-5.668.2,1,1,0,1,1,1.335-1.489,2.2,2.2,0,0,0,3.388-.817,1.006,1.006,0,0,1,1.89,0,2.278,2.278,0,0,0,4.11,0,1.007,1.007,0,0,1,1.89,0,2.278,2.278,0,0,0,4.11,0,1.007,1.007,0,0,1,1.89,0,2.2,2.2,0,0,0,3.387.817,1,1,0,0,1,1.336,1.487A3.981,3.981,0,0,1,21,17Zm0-6a4.375,4.375,0,0,1-3-1.225,4.336,4.336,0,0,1-6,0,4.336,4.336,0,0,1-6,0,4.186,4.186,0,0,1-5.668.2A1,1,0,1,1,1.667,8.489a2.2,2.2,0,0,0,3.388-.817,1.006,1.006,0,0,1,1.89,0,2.278,2.278,0,0,0,4.11,0,1.008,1.008,0,0,1,1.89,0,2.278,2.278,0,0,0,4.11,0,1.006,1.006,0,0,1,1.89,0,2.2,2.2,0,0,0,3.387.817,1,1,0,0,1,1.336,1.487A3.981,3.981,0,0,1,21,11Zm0-6a4.375,4.375,0,0,1-3-1.225,4.336,4.336,0,0,1-6,0,4.336,4.336,0,0,1-6,0,4.186,4.186,0,0,1-5.668.2A1,1,0,1,1,1.667,2.489a2.2,2.2,0,0,0,3.388-.817,1.006,1.006,0,0,1,1.89,0,2.278,2.278,0,0,0,4.11,0,1.008,1.008,0,0,1,1.875-.041h0l.015.042a2.278,2.278,0,0,0,4.11,0,1.008,1.008,0,0,1,1.89,0,2.2,2.2,0,0,0,3.387.817,1,1,0,1,1,1.336,1.487A3.981,3.981,0,0,1,21,5Z"} />
    </svg>
  );
}

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
