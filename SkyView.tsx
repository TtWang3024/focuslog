import * as React from "react";
import { createSkyMap } from "./skymap";
import skyStars from "./sky-data/sky-stars.json";
import skyLines from "./sky-data/sky-constellations.json";
import skyLabels from "./sky-data/sky-labels.json";
import skyStarNames from "./sky-data/sky-starnames.json";
import skyMilkyway from "./sky-data/sky-milkyway.json";

const { useRef, useEffect, useState, useMemo } = React;

const SKY_DATA = { stars: skyStars, lines: skyLines, labels: skyLabels, starNames: skyStarNames, mw: skyMilkyway };

function isDarkTheme(): boolean {
  return typeof document !== "undefined" && document.body.classList.contains("theme-dark");
}

// The Sky tab: each logged pomodoro lights a real star (brighter when recent). Drag to pan,
// scroll to zoom, hover a glow for the task + star name. Follows the Obsidian light/dark theme.
export function SkyView({ sessions, C }: { sessions: any[]; C: any }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const skyRef = useRef<any>(null);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; sub: string } | null>(null);

  // pomodoro sessions → star entries; recency spans the real data range (oldest dim → newest bright)
  const entries = useMemo(() => {
    return (sessions || [])
      .map((s) => ({ id: String(s.id), text: s.task || "pomodoro", ts: new Date(s.ts).getTime() }))
      .filter((e) => !isNaN(e.ts));
  }, [sessions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sky = createSkyMap(canvas, { data: SKY_DATA });
    skyRef.current = sky;
    sky.setLightMode(!isDarkTheme());
    sky.setSize();
    const now = Date.now();
    const oldest = entries.length ? Math.min(...entries.map((e) => e.ts)) : now;
    const months = Math.max(1, Math.ceil((now - oldest) / (30 * 24 * 3600 * 1000)) + 1);
    sky.setReflections(entries, months, now);
    sky.render(false);

    const onResize = () => { sky.setSize(); sky.render(false); };
    const ro = new ResizeObserver(onResize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", onResize);

    let dragging = false, lx = 0, ly = 0;
    const onDown = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} };
    const onMove = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.clientX - lx, dy = e.clientY - ly;
        lx = e.clientX; ly = e.clientY;
        sky.pan(dx, dy); sky.render(true);
        setTip(null);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const hit = sky.hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (hit) {
        const d = new Date(hit.ts);
        setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, title: hit.text || hit.name, sub: hit.name + " · " + d.toLocaleDateString() });
        canvas.style.cursor = "pointer";
      } else {
        setTip(null); canvas.style.cursor = "grab";
      }
    };
    const onUp = (e: PointerEvent) => { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch (err) {} sky.render(false); };
    const onLeave = () => { setTip(null); };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); sky.zoomBy(e.deltaY < 0 ? 1.1 : 0.9); sky.render(false); };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // re-adapt only when the Obsidian theme actually flips (body class toggles often)
    let lastDark = isDarkTheme();
    const mo = new MutationObserver(() => {
      const d = isDarkTheme();
      if (d === lastDark) return;
      lastDark = d;
      sky.setLightMode(!d);
      sky.render(false);
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    return () => {
      ro.disconnect(); mo.disconnect();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel as any);
      skyRef.current = null;
    };
  }, [entries]);

  return (
    <div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>
        Each pomodoro you log lights a star, brighter when it's recent. Drag to roam, scroll to zoom.
      </div>
      <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "min(68vh, 560px)", minHeight: 340, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}` }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" }} />
        {tip && (
          <div style={{ position: "absolute", left: tip.x + 12, top: tip.y + 12, pointerEvents: "none", background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 9px", fontSize: 12, color: C.ink, maxWidth: 220, boxShadow: "0 2px 10px rgba(0,0,0,0.18)" }}>
            <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{tip.title}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{tip.sub}</div>
          </div>
        )}
        {!entries.length && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13, textAlign: "center", padding: 20, pointerEvents: "none" }}>
            Log your first pomodoro to light a star.
          </div>
        )}
      </div>
    </div>
  );
}
