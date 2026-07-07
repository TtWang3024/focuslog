import * as React from "react";
import { BodyMap } from "./BodyMap";
import { Trash, InfoHover } from "./icons";
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
// Each thought pill gets its own border colour, cycled (macaron borders).
const THOUGHT_COLORS = [
  "rgb(213,144,144)", "rgb(213,179,144)", "rgb(179,213,144)", "rgb(144,213,179)",
  "rgb(144,179,213)", "rgb(179,144,213)", "rgb(213,144,179)", "rgb(144,213,213)",
];

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
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
        {saved && <span style={{ fontSize: 12, color: C.better }}>{"saved ✓"}</span>}
        <InfoHover C={C} label="how reflections work" width={330}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Reflect</div>
          <div>A quiet moment: notice what is going on inside and save it. Each reflection also lights a silver star in your Sky.</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li><b>Thought</b>: name what's pulling at you (optional); press Enter to add each one.</li>
            <li><b>Body</b>: mark where you feel it on the body map (up to 3 places).</li>
            <li><b>Mood</b>: place how it feels, pleasant or unpleasant, high or low energy (up to {MOOD_MAX} words).</li>
          </ul>
        </InfoHover>
        <button type="button" onClick={save} disabled={!hasContent}
          style={{ padding: "8px 18px", borderRadius: 999, border: "none", boxShadow: "none", background: hasContent ? "#6b4423" : C.line, color: hasContent ? C.paper : C.muted, fontSize: 13.5, fontWeight: 600, cursor: hasContent ? "pointer" : "default", fontFamily: "var(--fl-display)" }}>
          Lighten up one reflection star
        </button>
      </div>
      <div className="fl-reflect" style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>

      <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "0 0 8px" }}>Thought</h3>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addThought(); } }}
        placeholder="name a thought, press Enter"
        style={{ width: "100%", boxSizing: "border-box", padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.line}`, background: C.paper, color: C.ink, fontSize: 12.5, fontFamily: "var(--fl-display)" }} />
      {thoughts.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {thoughts.map((t, i) => (
            <span key={i} className="fl-thought" style={{ borderColor: THOUGHT_COLORS[i % THOUGHT_COLORS.length] }}>
              <span className="fl-thought-text">{t}</span>
              <button type="button" onClick={() => removeThought(i)} className="fl-rowact fl-rowdel" title="delete" aria-label="delete"><Trash size={12} /></button>
            </span>
          ))}
        </div>
      )}

      <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "16px 0 8px" }}>Body</h3>
      <BodyMap value={body} onChange={setBody} C={C} />

      <h3 style={{ fontFamily: "var(--fl-display)", fontSize: 16, color: C.ink, margin: "16px 0 8px" }}>Mood</h3>
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
      </div>
    </div>
  );
}
