import * as React from "react";
import { createSkyMap } from "./skymap";
import { InfoHover, SUBBAR, SUBTAB_ROW, subTab, TomatoIcon, WaterIcon } from "./icons";
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

// A label for a wave star: what you wrote, else the first feeling word, else where you felt it,
// else the task it interrupted. The float's 90-second waves carry only a task, and that is fine.
function waveLabel(u: any): string {
  if (u.note) return u.note;
  if (u.moods && u.moods.length) return u.moods[0].name || "an urge";
  if (u.body && u.body.length) return u.body[0].part || "an urge";
  if (u.task) return u.task;
  return "an urge";
}

// The Sky tab: pomodoros light amber stars; surfed urges light a separate silver-star sky you toggle to.
// Drag to pan, scroll to zoom, hover a glow for its label, hover near a constellation for its name.
export function SkyView({ sessions, urges, C }: { sessions: any[]; urges: any[]; C: any }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const skyRef = useRef<any>(null);
  const [mode, setMode] = useState<"pomodoro" | "wave">("pomodoro");
  const [tip, setTip] = useState<{ x: number; y: number; title: string; sub: string } | null>(null);
  const [clabel, setClabel] = useState<{ name: string; x: number; y: number } | null>(null);

  const entries = useMemo(() => {
    const src = mode === "wave" ? (urges || []) : (sessions || []);
    return src
      // Float waves have no id of their own, so fall back to the timestamp.
      .map((s: any) => ({ id: String(s.id || s.ts), text: mode === "wave" ? waveLabel(s) : ((s.task || "pomodoro") + (s.claimed ? " (claimed)" : "")), ts: new Date(s.ts).getTime(), claimed: mode !== "wave" && !!s.claimed }))
      .filter((e: any) => !isNaN(e.ts));
  }, [sessions, urges, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sky = createSkyMap(canvas, { data: SKY_DATA });
    skyRef.current = sky;
    sky.setLightMode(!isDarkTheme());
    sky.setRefTint(mode === "wave" ? "silver" : "amber");
    sky.setSize();
    const now = Date.now();
    const oldest = entries.length ? Math.min(...entries.map((e: any) => e.ts)) : now;
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
        setTip(null); setClabel(null);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = sky.hitTest(mx, my);
      if (hit) {
        const d = new Date(hit.ts);
        setTip({ x: mx, y: my, title: hit.text || hit.name, sub: hit.name + " · " + d.toLocaleDateString() });
        setClabel(null);
        canvas.style.cursor = "pointer";
      } else {
        setTip(null);
        setClabel(sky.pickLabel(mx, my));
        canvas.style.cursor = "grab";
      }
    };
    const onUp = (e: PointerEvent) => { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch (err) {} sky.render(false); };
    const onLeave = () => { setTip(null); setClabel(null); };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); sky.zoomBy(e.deltaY < 0 ? 1.1 : 0.9); sky.render(false); };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    let lastDark = isDarkTheme();
    const mo = new MutationObserver(() => {
      const dk = isDarkTheme();
      if (dk === lastDark) return;
      lastDark = dk;
      sky.setLightMode(!dk);
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
  }, [entries, mode]);

  const empty = mode === "wave" ? "Surf your first urge to light a star." : "Log your first pomodoro to light a star.";

  return (
    <div>
      {/* control left, info right - the shape every view shares, so the info button never moves */}
      <div style={SUBBAR}>
        <div style={SUBTAB_ROW}>
          <button type="button" style={subTab(mode === "pomodoro")} onClick={() => setMode("pomodoro")}><TomatoIcon size={13} on={mode === "pomodoro"} />Pomo</button>
          <button type="button" style={subTab(mode === "wave")} onClick={() => setMode("wave")}><WaterIcon size={13} on={mode === "wave"} />Waves</button>
        </div>
        <InfoHover C={C} label="about your Sky" width={330}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Your Sky</div>
          <div><b>Pomo</b> lights an amber star for every pomodoro you log; <b>Waves</b> is a second, silver sky with one star per urge you surf — however the wave ended, noticing it is the whole achievement. Recent stars shine brighter. Work you claim after the fact lights a quieter copper star: same sky, different instrument.</div>
          <div style={{ marginTop: 6 }}>Drag to roam and scroll to zoom. Hover a star for its story, or near a constellation for its name.</div>
        </InfoHover>
      </div>
      <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "min(68vh, 560px)", minHeight: 340, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}` }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" }} />
        {tip && (
          <div style={{ position: "absolute", left: tip.x + 12, top: tip.y + 12, pointerEvents: "none", background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 9px", fontSize: 12, color: C.ink, maxWidth: 220, boxShadow: "0 2px 10px rgba(0,0,0,0.18)" }}>
            <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{tip.title}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{tip.sub}</div>
          </div>
        )}
        {clabel && (
          <div style={{ position: "absolute", left: clabel.x, top: clabel.y, transform: "translate(-50%, -50%)", pointerEvents: "none", background: C.card, border: `1px solid ${C.line}`, borderRadius: 6, padding: "2px 8px", fontSize: 12.5, color: C.ink, whiteSpace: "nowrap", boxShadow: "0 1px 6px rgba(0,0,0,0.18)" }}>{clabel.name}</div>
        )}
        {!entries.length && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13, textAlign: "center", padding: 20, pointerEvents: "none" }}>
            {empty}
          </div>
        )}
      </div>
    </div>
  );
}
