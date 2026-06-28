import * as React from "react";
import { BodyMap } from "./BodyMap";
import sunIcon from "./assets/sun.png";
import moonIcon from "./assets/moon.png";
import cactusIcon from "./assets/cactus.png";
import lilyIcon from "./assets/lily.png";

const { useState } = React;

const MOOD_MAX = 3;
// Quadrant colours (valence × arousal), ported from Hold to Pause. `text` tints the pill border + text.
const QUADRANT_META: any = {
  tl: { cell: "#FAECE7", text: "#712B13" }, // high energy · unpleasant (orange)
  tr: { cell: "#FAEEDA", text: "#633806" }, // high energy · pleasant (yellow)
  bl: { cell: "#E6F1FB", text: "#0C447C" }, // low energy · unpleasant (blue)
  br: { cell: "#EAF3DE", text: "#27500A" }, // low energy · pleasant (green)
};

// The optional pause reflection: name a few thoughts, mark where you feel it on the rabbit body map,
// and place how it feels on the valence/arousal circumplex. Calls onSave({ thoughts, body, mood }) and resets.
export function ReflectPanel({ feelings, C, onSave }: { feelings: any; C: any; onSave: (r: any) => void }) {
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [body, setBody] = useState<any[]>([]);
  const [moods, setMoods] = useState<{ q: string; name: string }[]>([]);
  const [saved, setSaved] = useState(false);

  const addThought = () => { const v = draft.trim(); if (!v) return; setThoughts([...thoughts, v]); setDraft(""); };
  const removeThought = (i: number) => setThoughts(thoughts.filter((_, j) => j !== i));
  const moodOn = (q: string, n: string) => moods.some((m) => m.q === q && m.name === n);
  const toggleMood = (q: string, n: string) => {
    if (moodOn(q, n)) { setMoods(moods.filter((m) => !(m.q === q && m.name === n))); return; }
    if (moods.length >= MOOD_MAX) return;
    setMoods([...moods, { q, name: n }]);
  };

  const hasContent = thoughts.length > 0 || body.length > 0 || moods.length > 0;
  const save = () => {
    if (!hasContent) return;
    onSave({
      thoughts: thoughts.slice(),
      body: body.map((t) => ({ part: t.part, note: (t.note || "").trim() })),
      mood: moods.map((m) => ({ q: m.q, name: m.name })),
    });
    setThoughts([]); setBody([]); setMoods([]); setDraft("");
    setSaved(true); window.setTimeout(() => setSaved(false), 1600);
  };

  const quadrant = (q: string) => {
    const meta = QUADRANT_META[q];
    const words: string[] = (feelings && feelings[q]) || [];
    return (
      <div className="fl-cx-cell" style={{ background: meta.cell }}>
        {words.map((n) => {
          const on = moodOn(q, n);
          return (
            <button key={n} type="button" className={"fl-cx-chip" + (on ? " on" : "")}
              style={{ borderColor: meta.text, color: on ? "#fff" : meta.text, background: on ? meta.text : "#fff" }}
              onClick={() => toggleMood(q, n)}>{n}</button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fl-reflect" style={{ marginTop: 10, background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 5 }}>What's pulling at you? (optional)</div>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addThought(); } }}
        placeholder="name a thought, press Enter"
        style={{ width: "100%", boxSizing: "border-box", padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper, color: C.ink, fontSize: 12.5, fontFamily: "var(--fl-display)" }} />
      {thoughts.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
          {thoughts.map((t, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, background: C.paper, border: `1px solid ${C.line}`, fontSize: 12, color: C.ink }}>
              {t}
              <button type="button" onClick={() => removeThought(i)} style={{ border: "none", background: "transparent", color: C.muted, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>{"×"}</button>
            </span>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: C.muted, margin: "14px 0 8px" }}>Where do you feel it? (up to 3)</div>
      <BodyMap value={body} onChange={setBody} C={C} />

      <div style={{ fontSize: 12, color: C.muted, margin: "14px 0 8px" }}>How does it feel? (up to {MOOD_MAX})</div>
      <div className="fl-cx">
        <div className="fl-cx-grid">
          {quadrant("tl")}{quadrant("tr")}{quadrant("bl")}{quadrant("br")}
        </div>
        <span className="fl-cx-axis-v" aria-hidden="true" />
        <span className="fl-cx-axis-h" aria-hidden="true" />
        <img className="fl-cx-ico fl-cx-ico-top" src={sunIcon} alt="high energy" title="high energy" />
        <img className="fl-cx-ico fl-cx-ico-bottom" src={moonIcon} alt="low energy" title="low energy" />
        <img className="fl-cx-ico fl-cx-ico-left" src={cactusIcon} alt="unpleasant" title="unpleasant" />
        <img className="fl-cx-ico fl-cx-ico-right" src={lilyIcon} alt="pleasant" title="pleasant" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
        <button type="button" onClick={save} disabled={!hasContent}
          style={{ padding: "6px 14px", borderRadius: 9, border: "none", background: hasContent ? C.ink : C.line, color: hasContent ? C.paper : C.muted, fontSize: 13, fontWeight: 600, cursor: hasContent ? "pointer" : "default", fontFamily: "var(--fl-display)" }}>
          save reflection
        </button>
        {saved && <span style={{ fontSize: 12, color: C.better }}>{"saved ✓"}</span>}
      </div>
    </div>
  );
}
