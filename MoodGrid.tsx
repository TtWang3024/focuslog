import * as React from "react";
import sunIcon from "./assets/sun.png";
import moonIcon from "./assets/moon.png";
import cactusIcon from "./assets/cactus.png";
import lilyIcon from "./assets/lily.png";

const MOOD_MAX = 3;
// Quadrant colours (valence × arousal), ported from Hold to Pause. `text` tints the pill border + text.
const QUADRANT_META: any = {
  tl: { cell: "#FAECE7", text: "#712B13" }, // high energy · unpleasant (orange)
  tr: { cell: "#FAEEDA", text: "#633806" }, // high energy · pleasant (yellow)
  bl: { cell: "#E6F1FB", text: "#0C447C" }, // low energy · unpleasant (blue)
  br: { cell: "#EAF3DE", text: "#27500A" }, // low energy · pleasant (green)
};

// The valence-arousal word grid: the urge surf's Emotions tab. Pick up to three words for how
// it feels around the urge; the quadrant tells you where energy and pleasantness sit.
export function MoodGrid({ feelings, C, value, onChange, max = MOOD_MAX }: any) {
  const on = (q: string, n: string) => (value || []).some((m: any) => m.q === q && m.name === n);
  const toggle = (q: string, n: string) => {
    if (on(q, n)) { onChange((value || []).filter((m: any) => !(m.q === q && m.name === n))); return; }
    if ((value || []).length >= max) return;
    onChange([...(value || []), { q, name: n }]);
  };
  const quadrant = (q: string) => {
    const meta = QUADRANT_META[q];
    const words: string[] = (feelings && feelings[q]) || [];
    return (
      <div className="fl-cx-cell" style={{ background: meta.cell }}>
        {words.map((n) => {
          const isOn = on(q, n);
          return (
            <button key={n} type="button" className={"fl-cx-chip" + (isOn ? " on" : "")}
              style={{ borderColor: meta.text, color: isOn ? "#fff" : meta.text, background: isOn ? meta.text : "#fff" }}
              onClick={() => toggle(q, n)}>{n}</button>
          );
        })}
      </div>
    );
  };
  return (
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
  );
}
