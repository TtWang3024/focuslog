import * as React from "react";
import bodyImg from "./assets/body.png";

const { useState, useRef } = React;

const BODY_MAX = 3;
const NEAR_FRAC = 0.34;   // how close (× figure width) the cursor must be to light a dot
// Dot positions as fractions of the rabbit image, ported from Hold to Pause.
const BODY_POINTS = [
  { part: "listen", x: 0.207, y: 0.313 },
  { part: "neck", x: 0.571, y: 0.276 },
  { part: "shoulder", x: 0.604, y: 0.331 },
  { part: "chest & heart", x: 0.773, y: 0.358 },
  { part: "arm", x: 0.436, y: 0.41 },
  { part: "touch", x: 0.207, y: 0.516 },
  { part: "belly / gut", x: 0.88, y: 0.49 },
  { part: "lower back", x: 0.544, y: 0.491 },
  { part: "spine", x: 0.369, y: 0.65 },
  { part: "leg", x: 0.604, y: 0.742 },
  { part: "feet", x: 0.601, y: 0.965 },
];
// Crowded head senses → one cluster: head area opens left, see/smell/taste open right.
const FACE_CLUSTER = { x: 0.667, y: 0.143, members: ["head area", "see", "smell", "taste"] };
const SENSE_PARTS = ["see", "smell", "taste", "head area", "listen", "touch"];

// Where in the body do you feel it: hover the rabbit, tap a glowing point (up to 3), jot a word.
// Controlled — `value` is [{ part, note }], reported up via onChange.
export function BodyMap({ value, onChange, C }: { value: any[]; onChange: (t: any[]) => void; C: any }) {
  const figRef = useRef<HTMLDivElement | null>(null);
  const faceRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const [near, setNear] = useState<string | null>(null);
  const [faceOpen, setFaceOpen] = useState(false);

  const has = (part: string) => value.some((t) => t.part === part);
  const toggle = (part: string) => {
    if (has(part)) { onChange(value.filter((t) => t.part !== part)); return; }
    if (value.length >= BODY_MAX) return;
    onChange([...value, { part, note: "" }]);
  };
  const setNote = (part: string, note: string) => onChange(value.map((t) => t.part === part ? { ...t, note } : t));

  const onMove = (e: React.PointerEvent) => {
    setActive(true);
    const el = figRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const nearR = NEAR_FRAC * rect.width;
    const faceDist = Math.hypot(px - FACE_CLUSTER.x * rect.width, py - FACE_CLUSTER.y * rect.height);
    let best: any = null, bestD = Infinity;
    for (const p of BODY_POINTS) {
      const d = Math.hypot(px - p.x * rect.width, py - p.y * rect.height);
      if (d < bestD) { bestD = d; best = p; }
    }
    // stay open while the cursor is actually over a face chip (robust to any font line-height),
    // or within a wide radius; open from closed when the cluster is the nearest target.
    const overFace = !!(faceRef.current && e.target instanceof Node && faceRef.current.contains(e.target));
    const open = overFace || (faceOpen ? (faceDist < nearR * 2.2) : (faceDist < nearR && faceDist <= bestD));
    setFaceOpen(open);
    setNear(!open && best && bestD < nearR ? best.part : null);
  };
  const onLeave = () => { setActive(false); setNear(null); setFaceOpen(false); };

  const faceSelected = FACE_CLUSTER.members.some((m) => has(m));
  const senses = FACE_CLUSTER.members.filter((m) => m !== "head area");

  return (
    <div className="fl-bodymap">
      <div className="fl-bodymap-fig" ref={figRef}
        onPointerEnter={() => setActive(true)} onPointerMove={onMove} onPointerLeave={onLeave}>
        <img src={bodyImg} alt="" draggable={false} />
        <div className={"fl-bdots" + (active ? " active" : "")}>
          {BODY_POINTS.map((p) => (
            <button key={p.part} type="button"
              className={"fl-bdot" + (SENSE_PARTS.includes(p.part) ? " sense" : "") + (near === p.part ? " near" : "") + (has(p.part) ? " on" : "")}
              style={{ left: (p.x * 100) + "%", top: (p.y * 100) + "%" }}
              onClick={(e) => { e.stopPropagation(); toggle(p.part); }}>
              <span className="fl-bdot-label">{p.part}</span>
            </button>
          ))}
          <div ref={faceRef} className={"fl-bface" + (faceOpen ? " open" : "")} style={{ left: (FACE_CLUSTER.x * 100) + "%", top: (FACE_CLUSTER.y * 100) + "%" }}>
            <span className={"fl-bface-anchor" + (faceSelected ? " on" : "")} />
            <div className="fl-bface-pop fl-bface-pop-right">
              {senses.map((m) => (
                <button key={m} type="button" data-part={m} className={"fl-bface-chip" + (has(m) ? " on" : "")}
                  onClick={(e) => { e.stopPropagation(); toggle(m); }}>{m}</button>
              ))}
            </div>
            <div className="fl-bface-pop fl-bface-pop-left">
              <button type="button" data-part="head area" className={"fl-bface-chip" + (has("head area") ? " on" : "")}
                onClick={(e) => { e.stopPropagation(); toggle("head area"); }}>head area</button>
            </div>
          </div>
        </div>
      </div>
      <div className="fl-bodymap-side">
        <p style={{ margin: "0 0 8px", fontSize: 12, color: C.muted }}>Hover the rabbit, then tap a glowing point (up to {BODY_MAX}).</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {value.map((t) => (
            <div key={t.part} className="fl-btag">
              <div className="fl-btag-head">
                <span className="fl-btag-name">{t.part}</span>
                <button type="button" onClick={() => toggle(t.part)} style={{ border: "none", background: "rgba(0,0,0,0.14)", color: C.ink, borderRadius: 999, padding: "1px 8px", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>{"×"}</button>
              </div>
              <input value={t.note || ""} placeholder="words for this… (optional)" onChange={(e) => setNote(t.part, e.target.value)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
