// The break-activity picker: the urge surf's rabbit. Hover it and its points appear, each
// lighting with its name as the cursor nears; the face opens its own cluster, see / smell /
// taste to the right and head area to the left. Click a point or a face chip to list the
// activities tagged with that part and toggle up to three, from any parts; the chosen ones stay
// listed beside the rabbit. Plain DOM, so the floating window and the React panel share one
// implementation, and the rabbit resizes with the space it is given.
import bodyImg from "./assets/body.png";

// The tags a break activity can carry, in the order the panel's drop-down lists them.
export const RABBIT_SENSES = ["see", "smell", "taste", "listen", "touch"];
export const RABBIT_BODY = ["head area", "neck", "shoulder", "chest & heart", "arm", "belly / gut", "lower back", "spine", "leg", "feet"];
export const RABBIT_TAGS = RABBIT_SENSES.concat(RABBIT_BODY);

const RABBIT_RATIO = 480 / 992;   // the rabbit image's width over its height
const RABBIT_NEAR_FRAC = 0.34;    // how close (x figure width) the cursor must be to light a point
// The urge-surf body map's points, as fractions of the rabbit image; the crowded head senses
// gather into the face cluster instead of points of their own.
const RABBIT_POINTS: any[] = [
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
const RABBIT_FACE = { x: 0.667, y: 0.143, members: ["see", "smell", "taste", "head area"] };
const RABBIT_SENSE_POINTS = ["listen", "touch"];   // drawn in the senses' pink, as in the urge surf
const RABBIT_IS_TOUCH = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
// Everyday words for the parts. Tags are chosen from RABBIT_TAGS now; these only carry older
// free-typed tags ("eye", "back", "breath") onto their part.
const RABBIT_ALIASES: any = {
  eye: "see", eyes: "see", sight: "see", vision: "see", look: "see",
  nose: "smell", mouth: "taste", tongue: "taste", drink: "taste", eat: "taste",
  head: "head area", face: "head area", scalp: "head area",
  ear: "listen", ears: "listen", hear: "listen", hearing: "listen", sound: "listen", music: "listen",
  shoulders: "shoulder", chest: "chest & heart", heart: "chest & heart", breath: "chest & heart",
  breathe: "chest & heart", breathing: "chest & heart", lungs: "chest & heart",
  arms: "arm", hand: "touch", hands: "touch", skin: "touch", fingers: "touch",
  belly: "belly / gut", gut: "belly / gut", stomach: "belly / gut",
  back: "lower back", "low back": "lower back", posture: "spine",
  legs: "leg", knee: "leg", knees: "leg", hip: "leg", hips: "leg",
  foot: "feet", toes: "feet", walk: "feet",
};

// The rabbit part an activity's tag names, or null when it names none ("Mind", "Other").
export function rabbitPartOf(area: any): string | null {
  const t = String(area || "").trim().toLowerCase().replace(/^#/, "");
  if (!t) return null;
  if (RABBIT_TAGS.indexOf(t) >= 0) return t;
  if (RABBIT_ALIASES[t]) return RABBIT_ALIASES[t];
  for (const p of RABBIT_TAGS) if (p.split(/[^a-z]+/).indexOf(t) >= 0) return p;
  return null;
}

export class BreakRabbit {
  root: HTMLElement;
  private doc: Document;
  private onToggle: (id: string) => void;
  private fitHeight: boolean;
  private wrap: HTMLElement;
  private fig: HTMLElement;
  private layer: HTMLElement;
  private faceEl: HTMLElement;
  private faceAnchor: HTMLElement;
  private side: HTMLElement;
  private dots: any = {};
  private chips: any = {};
  private near = "";
  private faceOpen = false;
  private open = "";         // the part whose activities are listed ("face" lists the whole head)
  private acts: any[] = [];
  private picked: string[] = [];
  private max = 3;
  private key = "";
  private ro: any = null;
  private figW = 0;

  // fitHeight: size the rabbit to the root's height (the float, whose break screen fills the
  // window); otherwise to its width (the panel, which scrolls).
  constructor(root: HTMLElement, onToggle: (id: string) => void, fitHeight?: boolean) {
    this.root = root;
    this.doc = root.ownerDocument || document;
    this.onToggle = onToggle;
    this.fitHeight = !!fitHeight;
    this.wrap = this.mk("div", "fl-brab", root);
    this.fig = this.mk("div", "fl-brab-fig", this.wrap);
    const img: any = this.mk("img", "", this.fig);
    img.src = bodyImg; img.alt = ""; img.draggable = false;
    this.layer = this.mk("div", "fl-bdots" + (RABBIT_IS_TOUCH ? " touch" : ""), this.fig);
    RABBIT_POINTS.forEach((p: any) => {
      const d = this.mk("span", "fl-bdot" + (RABBIT_SENSE_POINTS.indexOf(p.part) >= 0 ? " sense" : ""), this.layer);
      d.style.left = (p.x * 100) + "%";
      d.style.top = (p.y * 100) + "%";
      this.mk("span", "fl-bdot-label", d).textContent = p.part;
      this.dots[p.part] = d;
    });
    this.faceEl = this.mk("div", "fl-bface" + (RABBIT_IS_TOUCH ? " touch" : ""), this.layer);
    this.faceEl.style.left = (RABBIT_FACE.x * 100) + "%";
    this.faceEl.style.top = (RABBIT_FACE.y * 100) + "%";
    this.faceAnchor = this.mk("span", "fl-bface-anchor", this.faceEl);
    const right = this.mk("div", "fl-bface-pop fl-bface-pop-right", this.faceEl);
    const left = this.mk("div", "fl-bface-pop fl-bface-pop-left", this.faceEl);
    RABBIT_FACE.members.forEach((m: string) => {
      const c = this.mk("button", "fl-bface-chip", m === "head area" ? left : right);
      c.setAttribute("data-part", m);
      c.textContent = m;
      c.addEventListener("click", (e: any) => { e.stopPropagation(); this.open = this.open === m ? "" : m; this.paint(true); });
      this.chips[m] = c;
    });
    this.side = this.mk("div", "fl-brab-side", this.wrap);
    this.fig.addEventListener("pointerenter", () => this.layer.classList.add("active"));
    this.fig.addEventListener("pointermove", (e: any) => this.track(e));
    this.fig.addEventListener("pointerdown", (e: any) => this.track(e));
    this.fig.addEventListener("pointerleave", () => {
      if (RABBIT_IS_TOUCH) return;
      this.layer.classList.remove("active");
      this.setNear("");
      this.setFace(false);
    });
    this.fig.addEventListener("click", () => {
      const target = this.faceOpen ? "face" : this.near;
      this.open = target && target !== this.open ? target : "";
      this.paint(true);
    });
    const W: any = this.doc.defaultView || window;
    if (W.ResizeObserver) { this.ro = new W.ResizeObserver(() => this.fit()); this.ro.observe(this.root); }
    this.fit();
  }

  // Feed the current activities and picks; repaints only when something it shows has changed.
  update(acts: any[], picked: string[], max?: number) {
    this.acts = acts || [];
    this.picked = picked || [];
    if (max) this.max = max;
    this.paint(false);
  }
  destroy() {
    if (this.ro) { try { this.ro.disconnect(); } catch {} this.ro = null; }
    try { this.wrap.remove(); } catch {}
  }

  private mk(tag: string, cls: string, parent: HTMLElement): HTMLElement {
    const el = this.doc.createElement(tag);
    if (cls) el.className = cls;
    parent.appendChild(el);
    return el;
  }
  // The rabbit takes the space it is given: in the float as tall as the break screen allows,
  // in the panel about a third of the width; always leaving the list beside it room to read.
  private fit() {
    try {
      const W: any = this.doc.defaultView || window;
      const cs = W.getComputedStyle(this.root);
      const availW = this.root.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (availW <= 0) return;
      let w = 0;
      if (this.fitHeight) {
        const availH = this.root.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
        w = Math.min(availH * RABBIT_RATIO, availW * 0.5, availW - 150, 340);
      } else {
        w = Math.min(availW * 0.32, availW - 180, 260);
      }
      w = Math.round(Math.max(70, w));
      if (w !== this.figW) { this.figW = w; this.fig.style.width = w + "px"; }
    } catch {}
  }
  // The urge surf's own hover rule: the nearest point lights within reach, and the face cluster
  // stays open while the cursor is on a chip or the face is still the nearest target.
  private track(e: any) {
    this.layer.classList.add("active");
    const r = this.fig.getBoundingClientRect();
    if (!r.width) return;
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const nearR = RABBIT_NEAR_FRAC * r.width;
    const faceDist = Math.hypot(px - RABBIT_FACE.x * r.width, py - RABBIT_FACE.y * r.height);
    let best = "", bestD = Infinity;
    for (const p of RABBIT_POINTS) {
      const d = Math.hypot(px - p.x * r.width, py - p.y * r.height);
      if (d < bestD) { bestD = d; best = p.part; }
    }
    const overFace = !!(e.target && this.faceEl.contains(e.target));
    const open = overFace || ((this.faceOpen ? faceDist < nearR * 2.2 : faceDist < nearR) && faceDist <= bestD);
    this.setFace(open);
    this.setNear(!open && best && bestD < nearR ? best : "");
  }
  private setNear(part: string) {
    if (part === this.near) return;
    if (this.near && this.dots[this.near]) this.dots[this.near].classList.remove("near");
    this.near = part;
    if (part && this.dots[part]) this.dots[part].classList.add("near");
  }
  private setFace(on: boolean) {
    if (on === this.faceOpen) return;
    this.faceOpen = on;
    this.faceEl.classList.toggle("open", on);
  }
  private actsOf(part: string): any[] {
    if (part === "face") return this.acts.filter((a: any) => RABBIT_FACE.members.indexOf(rabbitPartOf(a.area) || "") >= 0);
    return this.acts.filter((a: any) => rabbitPartOf(a.area) === part);
  }

  private paint(force: boolean) {
    const key = JSON.stringify([this.acts.map((a: any) => [a.id, a.name, a.area]), this.picked, this.open, this.max]);
    if (!force && key === this.key) return;
    this.key = key;
    const pickedParts = this.acts.filter((a: any) => this.picked.indexOf(a.id) >= 0).map((a: any) => rabbitPartOf(a.area));
    RABBIT_POINTS.forEach((p: any) => {
      const d = this.dots[p.part];
      d.classList.toggle("on", pickedParts.indexOf(p.part) >= 0);
      d.classList.toggle("empty", !this.actsOf(p.part).length);
    });
    RABBIT_FACE.members.forEach((m: string) => {
      this.chips[m].classList.toggle("on", pickedParts.indexOf(m) >= 0);
      this.chips[m].classList.toggle("empty", !this.actsOf(m).length);
    });
    this.faceAnchor.classList.toggle("on", RABBIT_FACE.members.some((m: string) => pickedParts.indexOf(m) >= 0));
    const side = this.side;
    side.textContent = "";
    const full = this.picked.length >= this.max;
    const actBtn = (parent: HTMLElement, a: any) => {
      const on = this.picked.indexOf(a.id) >= 0;
      const b = this.mk("button", "fl-brab-act" + (on ? " on" : "") + (!on && full ? " off" : ""), parent);
      b.textContent = (on ? "✓ " : "") + a.name;
      b.title = on ? "remove from this break" : (full ? "three already chosen" : "add to this break");
      b.addEventListener("click", (e: any) => { e.stopPropagation(); if (on || !full) this.onToggle(a.id); });
    };
    if (this.open) {
      const box = this.mk("div", "fl-brab-open", side);
      const head = this.mk("div", "fl-brab-open-head", box);
      this.mk("span", "", head).textContent = this.open === "face" ? "head & face" : this.open;
      const x = this.mk("button", "fl-brab-x", head);
      x.textContent = "✕";
      x.title = "close";
      x.addEventListener("click", (e: any) => { e.stopPropagation(); this.open = ""; this.paint(true); });
      const list = this.actsOf(this.open);
      if (!list.length) {
        this.mk("div", "fl-brab-empty", box).textContent = "Nothing tagged “" + (this.open === "face" ? "head area, see, smell or taste" : this.open) + "” yet. Choose this tag for an activity in the Break tab.";
      } else if (this.open === "face") {
        RABBIT_FACE.members.forEach((m: string) => {
          const sub = list.filter((a: any) => rabbitPartOf(a.area) === m);
          if (!sub.length) return;
          this.mk("div", "fl-brab-sub", box).textContent = m;
          sub.forEach((a: any) => actBtn(box, a));
        });
      } else {
        list.forEach((a: any) => actBtn(box, a));
      }
    }
    const chosen = this.picked.map((id: string) => this.acts.filter((a: any) => a.id === id)[0]).filter(Boolean);
    if (chosen.length) {
      const box = this.mk("div", "fl-brab-picked", side);
      this.mk("div", "fl-brab-picked-title", box).textContent = "Chosen for this break";
      chosen.forEach((a: any) => {
        const chip = this.mk("div", "fl-brab-chip", box);
        this.mk("span", "n", chip).textContent = a.name;
        const part = rabbitPartOf(a.area);
        if (part) this.mk("span", "p", chip).textContent = part;
        const x = this.mk("button", "fl-brab-x", chip);
        x.textContent = "✕";
        x.title = "remove";
        x.addEventListener("click", (e: any) => { e.stopPropagation(); this.onToggle(a.id); });
      });
    }
    const loose = this.acts.filter((a: any) => !rabbitPartOf(a.area));
    if (loose.length) {
      const box = this.mk("div", "fl-brab-else", side);
      this.mk("div", "fl-brab-else-title", box).textContent = "Not on the rabbit";
      loose.forEach((a: any) => actBtn(box, a));
    }
  }
}
