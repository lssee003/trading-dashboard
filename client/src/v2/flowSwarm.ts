import * as THREE from "three";
import type { RSStock } from "@shared/schema";

/**
 * Capital flow — WebGL view of RS leadership rotation for the Stocks tab.
 *
 * Sector spheres ring a core that holds every stock rated RS 80+. A replay runs
 * 6M ago → 3M → 1M → today; each stock that crosses 80 flies between its sector
 * and the core on a green (in) or red (out) lane. Click a sector to open it into
 * its industries, then an industry to see its stocks placed by RS with their paths.
 *
 * Positions are computed in shaders from per-stock keyframes, so the whole replay
 * is a single uniform (uT). The overlay (labels, caption, log, transport) is plain
 * DOM owned by this module; the React wrapper only mounts and disposes it.
 */

export interface FlowSwarm { dispose(): void }

const SHORT: Record<string, string> = {
  "Basic Materials": "Materials", "Communication Services": "Comm Svcs", "Consumer Cyclical": "Cyclicals", "Consumer Defensive": "Staples",
  "Energy": "Energy", "Financial Services": "Financials", "Healthcare": "Healthcare", "Industrials": "Industrials", "Real Estate": "Real Estate",
  "Technology": "Technology", "Utilities": "Utilities",
};
const PL = ["6M ago", "3M ago", "1M ago", "Today"];
const MONTHS = [3, 2, 1];
const NAME = "Capital <em>flow</em>";
const DESC = "Sector spheres ring a core of every stock rated RS 80+. A shell is green when more of the sector is rated 80+ than the market, red when fewer; the halo shows leaders gained or lost. Packets are real stocks crossing 80. Click a sphere to look inside.";
const MOVE = 4200, HOLD = 1300, END_HOLD = 4400, REW = 520;

const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fib = (j: number, n: number): [number, number, number] => { const y = 1 - (j + .5) / n * 2, r = Math.sqrt(1 - y * y), th = j * 2.399963; return [Math.cos(th) * r, y, Math.sin(th) * r]; };
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const signed = (n: number) => (n > 0 ? "+" + n : n < 0 ? "−" + -n : "0");
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const segOf = (t: number) => Math.max(0, Math.min(2, Math.ceil(t - 1e-6) - 1));
const ease = (v: number) => v * v * (3 - 2 * v);

/* ── GLSL shared by every cloud: RS colour ramp and keyframe lookup ── */
const COMMON = `
uniform float uT; uniform float uTime; uniform float uPx;
attribute vec4 aP; attribute float aR;
vec3 ramp(float p){
  vec3 red=vec3(1.0,0.33,0.36), amb=vec3(1.0,0.74,0.27), grn=vec3(0.22,0.88,0.62), cy=vec3(0.36,0.9,1.0);
  if(p<42.0) return red;
  if(p<55.0) return mix(red,amb,(p-42.0)/13.0);
  if(p<74.0) return amb;
  if(p<82.0) return mix(amb,grn,(p-74.0)/8.0);
  return mix(grn,cy,(p-82.0)/17.0*0.6);
}
float keyAt(float s){ return s<0.5?aP.x:(s<1.5?aP.y:(s<2.5?aP.z:aP.w)); }
vec3 bez(vec3 a, vec3 c, vec3 b, float g){ return mix(mix(a,c,g), mix(c,b,g), g); }
`;
const VPTS = (place: string, size: string, boost: string) => COMMON + place + `
varying vec3 vC; varying float vA;
void main(){
  float p, vel, k; vec3 pos = place(uT, p, vel, k);
  vec4 mv = modelViewMatrix*vec4(pos,1.0); gl_Position = projectionMatrix*mv;
  gl_PointSize = max(1.6, (${size} + vel*${boost}) * (5.0 / -mv.z)) * uPx;
  vC = tint(p, k); vA = alphaOf(pos, mv, vel, k);
}`;
const VTRAIL = (place: string, len: string) => COMMON + place + `
attribute float aE; varying vec3 vC; varying float vA;
void main(){
  float p, vel, k; vec3 pos = place(uT - aE*${len}, p, vel, k);
  float p0, v0, k0; vec3 h = place(uT, p0, v0, k0);
  vec4 mv = modelViewMatrix*vec4(pos,1.0); gl_Position = projectionMatrix*mv;
  vC = tint(p0, k0);
  vA = (1.0-aE) * clamp(v0*5.0, 0.0, 1.0) * alphaOf(h, modelViewMatrix*vec4(h,1.0), v0, k0) * 0.8;
}`;
const FPTS = `varying vec3 vC; varying float vA;
void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; float a=1.0-smoothstep(0.12,0.5,d); gl_FragColor=vec4(vC, a*vA); }`;
const FLINE = `varying vec3 vC; varying float vA; void main(){ gl_FragColor=vec4(vC, vA); }`;

const TEMPLATE = `
<div class="fsw-stage">
  <canvas class="fsw-cv" aria-label="3D view of RS leadership rotation across sectors"></canvas>
  <div class="fsw-labels"></div>
  <div class="fsw-navrow"><button class="fsw-back fsw-glass" data-r="back" hidden></button><div class="fsw-hint" data-r="hint" hidden></div></div>
  <div class="fsw-tip fsw-glass" data-r="tip" hidden></div>
  <div class="fsw-story fsw-glass"><div class="fsw-kick" data-r="storyK"></div><p data-r="storyP"></p></div>
  <div class="fsw-bar fsw-glass">
    <button class="fsw-play" data-r="play">❚❚ Pause</button>
    <div class="fsw-track">
      <input data-r="scrub" type="range" min="0" max="3000" value="0" aria-label="Replay position">
      <div class="fsw-ticks"><span style="left:0">6M<i> ago</i></span><span style="left:33.33%">3M<i> ago</i></span><span style="left:66.67%">1M<i> ago</i></span><span style="left:100%">Today</span></div>
    </div>
    <div class="fsw-stamp" data-r="stamp">6M ago</div>
  </div>
</div>
<header class="fsw-top">
  <span class="fsw-kick">RS 80 crossings · <span data-r="count"></span></span>
  <h2 data-r="h1"></h2>
  <p data-r="desc"></p>
</header>
<aside class="fsw-log fsw-glass">
  <div class="fsw-kick" data-r="segk"></div>
  <h3 data-r="segh"></h3>
  <div class="fsw-sum"><span class="in" data-r="tin"></span><span class="out" data-r="tout"></span></div>
  <p class="fsw-note">RS is a rank, so every stock that enters the top 20% pushes another one out. What matters is which groups win the swaps.</p>
  <div class="fsw-bars" data-r="bars"></div>
  <div class="fsw-feedh"><span class="fsw-kick">Live crossings · largest caps</span></div>
  <div class="fsw-feed" data-r="feed"></div>
</aside>`;

interface Industry { sec: number; name: string; m: number[] }
interface Segment {
  inn: number[]; out: number[]; mv: number[]; top: number[]; big: number[]; gain: number[];
  indNet: Int32Array; indIn: Int32Array; indOut: Int32Array; indRank: number[];
}
interface Label {
  cls?: string; facing?: boolean; alpha?: () => number;
  pos: (t: number) => THREE.Vector3; text: (t: number) => string;
  el?: HTMLDivElement; last?: string | null; w?: number;
}
type Wire = THREE.LineSegments<THREE.WireframeGeometry, THREE.LineBasicMaterial>;

function disposeTree(o: THREE.Object3D) {
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as (THREE.Material & { map?: THREE.Texture | null }) | undefined;
    if (mat) { mat.map?.dispose(); mat.dispose(); }
  });
}

export function createFlowSwarm(host: HTMLElement, stocks: RSStock[], reduced: boolean): FlowSwarm {
  /* ── data: keyframes are RS percentile 6M ago, 3M, 1M, now ── */
  const rows = stocks.filter((x) => x.rsPercentile != null);
  const N = rows.length;
  const SECS = Array.from(new Set(rows.map((r) => r.sector || "Unknown"))).sort(), NS = SECS.length;
  const secIdx = new Map(SECS.map((s, i) => [s, i]));
  const short = (x: number) => SHORT[SECS[x]] ?? SECS[x];
  const TK: string[] = [], IND: string[] = [], PRICE: (number | null)[] = [], HI: (number | null)[] = [];
  const SEC = new Int32Array(N), CAP = new Float32Array(N), P = new Float32Array(N * 4);
  rows.forEach((r, i) => {
    const now = r.rsPercentile, m1 = r.rs1M ?? now, m3 = r.rs3M ?? m1, m6 = r.rs6M ?? m3;
    P.set([m6, m3, m1, now], i * 4);
    TK[i] = r.ticker; IND[i] = r.industry || "Unknown"; SEC[i] = secIdx.get(r.sector || "Unknown")!;
    CAP[i] = r.marketCap && r.marketCap > 0 ? Math.log10(r.marketCap) : 8; PRICE[i] = r.price; HI[i] = r.pctFrom52WkHigh;
  });
  const kp = (i: number, k: number) => P[i * 4 + k];
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const R1 = Float32Array.from({ length: N }, rnd), R2 = Float32Array.from({ length: N }, rnd), R3 = Float32Array.from({ length: N }, rnd);
  const bySec: number[][] = SECS.map(() => []); for (let i = 0; i < N; i++) bySec[SEC[i]].push(i);
  const LEAD = SECS.map((_, s) => [0, 1, 2, 3].map((k) => bySec[s].filter((i) => kp(i, k) >= 80).length / Math.max(1, bySec[s].length)));
  const MKT = [0, 1, 2, 3].map((k) => { let c = 0; for (let i = 0; i < N; i++) if (kp(i, k) >= 80) c++; return c / Math.max(1, N); });
  const INDS: Industry[] = [], indOf = new Int32Array(N), indKey = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    const key = SEC[i] + "|" + IND[i];
    if (!indKey.has(key)) { indKey.set(key, INDS.length); INDS.push({ sec: SEC[i], name: IND[i], m: [] }); }
    indOf[i] = indKey.get(key)!; INDS[indOf[i]].m.push(i);
  }
  const ILEAD = INDS.map((d) => [0, 1, 2, 3].map((k) => d.m.filter((i) => kp(i, k) >= 80).length / d.m.length));
  const indsOf = (x: number) => INDS.map((_, k) => k).filter((k) => INDS[k].sec === x);
  const byCap = (a: number, b: number) => CAP[b] - CAP[a];
  // the moves worth naming: biggest caps that jumped from below 50 into leadership, or fell from it below 50
  const pickBig = (mv: number[], s: number) => {
    const ent = mv.filter((i) => kp(i, s + 1) >= 80), lev = mv.filter((i) => kp(i, s + 1) < 80);
    const pick = (pri: number[], all: number[], n: number) => { const out = pri.slice().sort(byCap).slice(0, n); for (const i of all.slice().sort(byCap)) { if (out.length >= n) break; if (!out.includes(i)) out.push(i); } return out; };
    return [...pick(ent.filter((i) => kp(i, s) < 50), ent, 3), ...pick(lev.filter((i) => kp(i, s + 1) < 50), lev, 2)];
  };
  const SEG: Segment[] = [0, 1, 2].map((s) => {
    const inn = SECS.map(() => 0), out = SECS.map(() => 0), mv: number[] = [];
    const indNet = new Int32Array(INDS.length), indIn = new Int32Array(INDS.length), indOut = new Int32Array(INDS.length);
    for (let i = 0; i < N; i++) {
      const a = kp(i, s), b = kp(i, s + 1);
      if (a < 80 && b >= 80) { inn[SEC[i]]++; mv.push(i); indNet[indOf[i]]++; indIn[indOf[i]]++; }
      else if (a >= 80 && b < 80) { out[SEC[i]]++; mv.push(i); indNet[indOf[i]]--; indOut[indOf[i]]++; }
    }
    const net = (x: number) => inn[x] - out[x];
    return {
      inn, out, mv, indNet, indIn, indOut,
      top: mv.slice().sort(byCap).slice(0, 90), big: pickBig(mv, s),
      gain: SECS.map((_, x) => x).sort((a, b) => net(b) - net(a)),
      indRank: INDS.map((_, k) => k).filter((k) => indNet[k] !== 0).sort((a, b) => indNet[b] - indNet[a]),
    };
  });
  const NET = SECS.map((_, x) => SEG.map((G) => G.inn[x] - G.out[x]));
  const TODAY = SECS.map((_, x) => x).sort((a, b) => LEAD[b][3] - LEAD[a][3]);
  const cache = new Map<string, number[]>();
  const memo = (key: string, f: () => number[]) => cache.get(key) ?? (cache.set(key, f()), cache.get(key)!);
  const bigFor = (x: number, s: number) => memo(`b${x}:${s}`, () => pickBig(SEG[s].mv.filter((i) => SEC[i] === x), s));
  const sectorTop = (x: number, s: number) => memo(`s${x}:${s}`, () => SEG[s].mv.filter((i) => SEC[i] === x).sort(byCap).slice(0, 60));
  const industryTop = (k: number, s: number) => memo(`i${k}:${s}`, () => SEG[s].mv.filter((i) => indOf[i] === k).sort(byCap).slice(0, 40));
  const interp = (arr: number[], t: number) => { const s0 = Math.min(2, Math.floor(t)), h = sstep(.1, 1, t - s0); return arr[s0] + (arr[s0 + 1] - arr[s0]) * h; };
  const shareT = (x: number, t: number) => interp(LEAD[x], t);
  const iShareT = (k: number, t: number) => interp(ILEAD[k], t);
  const mktT = (t: number) => interp(MKT, t);

  // Spotlight: the period's two biggest gainers and losers stay lit; today, the three strongest sectors
  function spotlight(t: number) {
    if (t < .001) return null;
    if (t > 2.999) return TODAY.slice(0, 3);
    const s = segOf(t), G = SEG[s];
    return [...G.gain.filter((x) => NET[x][s] > 0).slice(0, 2), ...G.gain.filter((x) => NET[x][s] < 0).reverse().slice(0, 2)];
  }
  const run = (x: number, sg: number) => { let n = 0; for (let s = 2; s >= 0 && Math.sign(NET[x][s]) === sg; s--) n++; return n; };
  const total = (x: number) => NET[x].reduce((p, q) => p + q, 0);
  function streakLine() {
    const best = (sg: number) => SECS.map((_, x) => x).filter((x) => run(x, sg) >= 2).sort((a, b) => run(b, sg) - run(a, sg) || sg * (total(b) - total(a)))[0];
    const up = best(1), dn = best(-1), span = (n: number) => (n === 3 ? "in all three periods" : "two periods running"), out: string[] = [];
    if (up != null) out.push(`<span class="g">${short(up)}</span> has added leaders ${span(run(up, 1))}`);
    if (dn != null) out.push(`<span class="r">${short(dn)}</span> has lost them ${span(run(dn, -1))}`);
    return out.length ? out.join("; ") + "." : "";
  }
  const period = (s: number) => `${PL[s]} → ${PL[s + 1]} · ${MONTHS[s]} month${MONTHS[s] > 1 ? "s" : ""}`;
  function marketStory(t: number): [string, string] {
    const pc = (x: number, k: number) => Math.round(LEAD[x][k] * 100);
    if (t < .001) { const x = SECS.map((_, j) => j).sort((a, b) => LEAD[b][0] - LEAD[a][0])[0];
      return ["6 months ago", `<span class="g">${short(x)}</span> led the market, with ${pc(x, 0)}% of its stocks rated RS 80+ against ${Math.round(MKT[0] * 100)}% overall.`]; }
    if (t > 2.999) { const [a, b, c] = TODAY;
      return ["Today · where leadership sits", `<span class="g">${short(a)}</span> leads with ${pc(a, 3)}% of its stocks rated 80+${b != null ? `, then ${short(b)} ${pc(b, 3)}%` : ""}${c != null ? ` and ${short(c)} ${pc(c, 3)}%` : ""}. ${streakLine()}`]; }
    const s = segOf(t), G = SEG[s], chip = (x: number, cl: string) => `<span class="${cl}">${short(x)} ${signed(NET[x][s])}</span>`;
    const ups = G.gain.filter((x) => NET[x][s] > 0).slice(0, 2), dns = G.gain.filter((x) => NET[x][s] < 0).reverse().slice(0, 2);
    return [period(s), `Leadership rotated into ${ups.map((x) => chip(x, "g")).join(" and ") || "no sector"}, out of ${dns.map((x) => chip(x, "r")).join(" and ") || "no sector"}.`];
  }
  function sectorStory(x: number, t: number): [string, string] {
    const nm = short(x), ks = indsOf(x), big = ks.filter((k) => INDS[k].m.length >= 5), iname = (k: number) => trunc(INDS[k].name, 26), pc = (k: number, j: number) => Math.round(ILEAD[k][j] * 100);
    if (t < .001) { const k = big.slice().sort((a, b) => ILEAD[b][0] - ILEAD[a][0])[0];
      return [`Inside ${nm} · 6 months ago`, k == null ? `${nm} had ${Math.round(LEAD[x][0] * 100)}% of its stocks rated 80+.` : `<span class="g">${iname(k)}</span> led ${nm}, with ${pc(k, 0)}% of its stocks rated 80+ against ${Math.round(LEAD[x][0] * 100)}% for the sector.`]; }
    if (t > 2.999) { const [a, b, c] = big.slice().sort((p, q) => ILEAD[q][3] - ILEAD[p][3]);
      return [`Inside ${nm} · today`, `${a != null ? `<span class="g">${iname(a)}</span> leads with ${pc(a, 3)}% rated 80+${b != null ? `, then ${iname(b)} ${pc(b, 3)}%` : ""}${c != null ? ` and ${iname(c)} ${pc(c, 3)}%` : ""}. ` : ""}${nm} overall: ${Math.round(LEAD[x][3] * 100)}%, against ${Math.round(MKT[3] * 100)}% market-wide.`]; }
    const s = segOf(t), net = (k: number) => SEG[s].indNet[k], ord = ks.slice().sort((a, b) => net(b) - net(a)), chip = (k: number, cl: string) => `<span class="${cl}">${iname(k)} ${signed(net(k))}</span>`;
    const ups = ord.filter((k) => net(k) > 0).slice(0, 2), dns = ord.filter((k) => net(k) < 0).reverse().slice(0, 2);
    return [`Inside ${nm} · ${period(s)}`, `Leaders moved into ${ups.map((k) => chip(k, "g")).join(" and ") || "no industry"}, out of ${dns.map((k) => chip(k, "r")).join(" and ") || "no industry"}. Net for ${nm}: <span class="${NET[x][s] >= 0 ? "g" : "r"}">${signed(NET[x][s])}</span>.`];
  }
  function industryStory(k: number, t: number): [string, string] {
    const d = INDS[k], nm = trunc(d.name, 30), n = d.m.length, x = d.sec, lead = (j: number) => d.m.filter((i) => kp(i, j) >= 80), pct = (j: number) => Math.round(lead(j).length / n * 100);
    const best = (j: number) => d.m.slice().sort((a, b) => kp(b, j) - kp(a, j)).slice(0, 3).map((i) => `<b>${TK[i]}</b> ${kp(i, j)}`).join(", ");
    if (t < .001) return [`Inside ${nm} · 6 months ago`, `${lead(0).length} of ${n} stocks rated RS 80+ (${pct(0)}%). Strongest: ${best(0)}.`];
    if (t > 2.999) return [`Inside ${nm} · today`, `${lead(3).length} of ${n} rated 80+ (<span class="${pct(3) >= Math.round(MKT[3] * 100) ? "g" : "r"}">${pct(3)}%</span>), against ${Math.round(LEAD[x][3] * 100)}% for ${short(x)} and ${Math.round(MKT[3] * 100)}% market-wide. Leaders: ${best(3)}.`];
    const s = segOf(t), ent = d.m.filter((i) => kp(i, s) < 80 && kp(i, s + 1) >= 80).sort(byCap), lev = d.m.filter((i) => kp(i, s) >= 80 && kp(i, s + 1) < 80).sort(byCap);
    const names = (a: number[]) => a.slice(0, 2).map((i) => TK[i]).join(", "), climb = d.m.slice().sort((a, b) => (kp(b, s + 1) - kp(b, s)) - (kp(a, s + 1) - kp(a, s)))[0];
    const up = climb != null && kp(climb, s + 1) > kp(climb, s) ? ` Biggest climb: <b>${TK[climb]}</b> ${kp(climb, s)} → ${kp(climb, s + 1)}.` : "";
    return [`Inside ${nm} · ${period(s)}`, `${ent.length ? `<span class="g">${ent.length} joined the leaders</span> (${names(ent)})` : "No new leaders"}, ${lev.length ? `<span class="r">${lev.length} dropped out</span> (${names(lev)})` : "none dropped out"}.${up}`];
  }

  // Touch screens get "tap" wording and no hover
  const tap = window.matchMedia?.("(pointer: coarse)").matches ?? false;

  /* ── DOM ── */
  const root = document.createElement("div");
  root.className = "fsw";
  root.innerHTML = TEMPLATE;
  host.appendChild(root);
  const $ = <T extends HTMLElement = HTMLElement>(r: string) => root.querySelector(`[data-r="${r}"]`) as T;
  const cv = root.querySelector(".fsw-cv") as HTMLCanvasElement, labLayer = root.querySelector(".fsw-labels") as HTMLDivElement;
  const backEl = $<HTMLButtonElement>("back"), hintEl = $("hint"), tipEl = $("tip"), feed = $("feed");
  const scrub = $<HTMLInputElement>("scrub"), playBtn = $<HTMLButtonElement>("play"), stamp = $("stamp");
  const ticks = Array.from(root.querySelectorAll<HTMLSpanElement>(".fsw-ticks span"));
  $("count").textContent = N.toLocaleString() + " stocks";
  const setTitle = (h: string, d: string) => { $("h1").innerHTML = h; $("desc").textContent = d; };
  setTitle(NAME, DESC);

  /* ── three ── */
  // Transparent: the dark field behind the scene is CSS (v2.css .fsw) and fades into the page aura at the edges
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const DPR = Math.min(2, window.devicePixelRatio || 1); renderer.setPixelRatio(DPR);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const tilt = new THREE.Group(), spin = new THREE.Group(), g = new THREE.Group();
  scene.add(tilt); tilt.add(spin); spin.add(g);
  const U = {
    uT: { value: reduced ? 3 : 0 }, uTime: { value: 0 }, uPx: { value: DPR }, uDim: { value: new Array(NS).fill(1) },
    uZoom: { value: 0 }, uSel: { value: -1 }, uZoom2: { value: 0 }, uHi: { value: -1 }, uFade: { value: 0 },
  };
  const mk = (vs: string, fs: string) => new THREE.ShaderMaterial({ uniforms: U, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const geo = (n: number, attrs: Record<string, [Float32Array, number]>) => {
    const gm = new THREE.BufferGeometry(); gm.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    for (const k in attrs) gm.setAttribute(k, new THREE.BufferAttribute(attrs[k][0], attrs[k][1]));
    return gm;
  };
  const dup = (arr: Float32Array, sz: number, t: number) => { const o = new Float32Array(arr.length * t), n = arr.length / sz;
    for (let i = 0; i < n; i++) for (let r = 0; r < t; r++) for (let c = 0; c < sz; c++) o[(i * t + r) * sz + c] = arr[i * sz + c]; return o; };
  const lineMat = (color: number, opacity: number) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const poly = (pts: THREE.Vector3[], m: THREE.LineBasicMaterial) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m);
  const wire = (gm: THREE.BufferGeometry, color: number, op: number): Wire => new THREE.LineSegments(new THREE.WireframeGeometry(gm), lineMat(color, op));
  const base = <M extends THREE.Material>(m: M) => { m.userData.base = m.opacity; return m; };
  function glowSprite(color: string, scale: number, op: number) {
    const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d")!;
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    s.scale.setScalar(scale); return s;
  }

  /* ── market view: sector spheres around the leaders core ── */
  const ringR = 2.65, node: THREE.Vector3[] = [], nodeR: number[] = [], nodeA: number[] = [];
  SECS.forEach((_, s) => { const a = s / NS * Math.PI * 2; nodeA[s] = a; node[s] = V(Math.cos(a) * ringR, Math.sin(s * 2.1) * .28, Math.sin(a) * ringR); nodeR[s] = .13 + .27 * Math.sqrt(bySec[s].length / Math.max(...bySec.map((b) => b.length))); });
  const aHome = new Float32Array(N * 3), aCore = new Float32Array(N * 3), aNode = new Float32Array(N * 3), aSB = new Float32Array(N * 4);
  const aHome2 = new Float32Array(N * 3), aCore2 = new Float32Array(N * 3), aNode2 = new Float32Array(N * 3);   // inside view, filled for the opened sector
  const bandY: Record<number, number> = {};
  SECS.forEach((_, s) => {
    const n = bySec[s].length, nd = node[s].clone().normalize(), isz = (k: number) => INDS[k].m.length;
    // members ordered by industry, largest first, so each industry forms a latitude band on its sector sphere
    const mem = bySec[s].slice().sort((a, b) => isz(indOf[b]) - isz(indOf[a]) || indOf[a] - indOf[b] || R1[a] - R1[b]);
    mem.forEach((i, j) => {
      const [x, y, z] = fib(j, n), h = node[s].clone().add(V(x, y, z).multiplyScalar(nodeR[s]));
      // core slots lean toward their sector, so the core reads as one lobe per sector
      const [gx, gy, gz] = fib(Math.floor(R2[i] * N), N), c = V(gx, gy, gz).add(nd.clone().multiplyScalar(1.5)).normalize().multiplyScalar(.3 + .55 * Math.cbrt(R3[i]));
      aHome.set([h.x, h.y, h.z], i * 3); aCore.set([c.x, c.y, c.z], i * 3); aNode.set([node[s].x, node[s].y, node[s].z], i * 3); aSB[i * 4] = s;
      bandY[indOf[i]] = (bandY[indOf[i]] || 0) + h.y / INDS[indOf[i]].m.length;
    });
  });
  SEG.forEach((G, s) => G.big.forEach((i) => { aSB[i * 4 + 1 + s] = 1; }));
  const place = `
attribute vec3 aHome; attribute vec3 aCore; attribute vec3 aNode; attribute vec4 aSB;
attribute vec3 aHome2; attribute vec3 aCore2; attribute vec3 aNode2;
uniform float uDim[${NS}]; uniform float uZoom; uniform float uSel; uniform float uZoom2;
float bg(float s){ return s<0.5?aSB.y:(s<1.5?aSB.z:aSB.w); }
float isSel(){ return step(abs(aSB.x - uSel), 0.1); }
vec3 placeG(float t, out float p, out float vel, out float k){
  float z = uZoom * isSel();
  vec3 HM = mix(aHome, aHome2, z), CR = mix(aCore, aCore2, z), ND = mix(aNode, aNode2, z);
  t = clamp(t, 0.0, 3.0); float s = min(floor(t), 2.0); float f = t - s;
  float a = keyAt(s), b = keyAt(s+1.0);
  float la = step(80.0, a), lb = step(80.0, b);
  float d = aR*0.7; float g = smoothstep(d, d+0.3, f);
  p = mix(a, b, g);
  vec3 A = mix(HM, CR, la), B = mix(HM, CR, lb);
  if (la == lb) {
    vel = 0.0; k = 0.0;
    vec3 c = la > 0.5 ? vec3(0.0) : ND;
    return A + normalize(A - c + vec3(0.0001)) * sin(uTime*1.4 + aR*40.0) * 0.012;
  }
  float dir = lb - la;
  vel = (1.0 - abs(2.0*g - 1.0)) * (1.0 + bg(s)*1.6);
  k = dir * step(0.001, g) * step(g, 0.999);
  return bez(A, ND*0.5 + vec3(0.0, 0.85*dir, 0.0), B, g);
}
vec3 place(float t, out float p, out float vel, out float k){
  vec3 q = placeG(t, p, vel, k);
  return q * (1.0 + (1.0 - isSel())*uZoom*1.4);
}
vec3 tint(float p, float k){ if(k > 0.5) return vec3(0.4, 1.0, 0.8); if(k < -0.5) return vec3(1.0, 0.4, 0.4); return ramp(p); }
float alphaOf(vec3 pos, vec4 mv, float vel, float k){
  float dim = uDim[int(aSB.x + 0.5)], tr = step(0.5, abs(k));
  return (0.5 + abs(k)*1.1 + vel*1.0) * mix(dim, 1.0, tr*0.6) * mix(1.0, isSel(), uZoom) * (1.0 - uZoom2);
}`;
  // one point cloud plus comet trails sharing the same placement
  const attrs: Record<string, [Float32Array, number]> = { aP: [P, 4], aR: [R1, 1], aHome: [aHome, 3], aCore: [aCore, 3], aNode: [aNode, 3], aSB: [aSB, 4], aHome2: [aHome2, 3], aCore2: [aCore2, 3], aNode2: [aNode2, 3] };
  const pts = new THREE.Points(geo(N, attrs), mk(VPTS(place, "3.0", "4.5"), FPTS));
  const tAttrs: Record<string, [Float32Array, number]> = {}; for (const k in attrs) tAttrs[k] = [dup(attrs[k][0], attrs[k][1], 2), attrs[k][1]];
  const aE = new Float32Array(N * 2); for (let i = 0; i < N; i++) aE[i * 2 + 1] = 1; tAttrs.aE = [aE, 1];
  const trail = new THREE.LineSegments(geo(N * 2, tAttrs), mk(VTRAIL(place, "0.045"), FLINE));
  pts.frustumCulled = trail.frustumCulled = false; pts.renderOrder = 2;
  g.add(trail, pts);
  const lanes = (grp: THREE.Group, from: THREE.Vector3) => ([[.85, 0x3fe0a6, .16], [-.85, 0xff5c5c, .12]] as const).forEach(([lift, c, op]) => {
    const p: THREE.Vector3[] = [], ctrl = from.clone().multiplyScalar(.5).add(V(0, lift, 0));
    for (let j = 0; j <= 48; j++) { const q = j / 48; p.push(from.clone().multiplyScalar((1 - q) * (1 - q)).add(ctrl.clone().multiplyScalar(2 * q * (1 - q)))); }
    grp.add(poly(p, base(lineMat(c, op))));
  });
  const top = new THREE.Group(), arcs = new THREE.Group(); g.add(top); top.add(arcs);
  const wires: Wire[] = [], halos: THREE.Sprite[] = [];
  SECS.forEach((_, s) => {
    lanes(arcs, node[s]);
    const w = wire(new THREE.IcosahedronGeometry(nodeR[s] * 1.2, 1), 0x59d8ff, .06); w.position.copy(node[s]); top.add(w); wires.push(w);
    const h = glowSprite("rgba(255,255,255,.95)", 1, 0); h.position.copy(node[s]); top.add(h); halos.push(h);
  });
  const core = wire(new THREE.IcosahedronGeometry(.95, 1), 0x3fe0a6, .1), coreGlow = glowSprite("rgba(120,255,210,.8)", 2.2, .28); g.add(core, coreGlow);
  const inner = new THREE.Group(), innerArcs = new THREE.Group(); g.add(inner);
  g.position.y = .2;

  const st = {
    Z: 0, Zt: 0, zE: 0, sel: null as number | null, hover: -1, hoverInd: null as number | null,
    L: null as null | { order: number[]; rad: Record<number, number>; pos: Record<number, THREE.Vector3>; ang: Record<number, number> },
    iw: {} as Record<number, Wire>, ih: {} as Record<number, THREE.Sprite>,
    Z2: 0, Zt2: 0, zE2: 0, ind: null as number | null, hi: -1, pin: -1, tipFor: -2,
    l3: null as null | { k: number; ord: number[]; dir: Map<number, THREE.Vector3> },
  };

  /* ── sector view: the opened sector's industries ring its own leaders core ── */
  function put(name: string, i: number, v: THREE.Vector3) {
    const a = pts.geometry.attributes[name].array as Float32Array, b = trail.geometry.attributes[name].array as Float32Array;
    a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z;
    for (const r of [0, 1]) { const o = (i * 2 + r) * 3; b[o] = v.x; b[o + 1] = v.y; b[o + 2] = v.z; }
  }
  function layout(x: number) {
    const ks = indsOf(x).sort((a, b) => INDS[b].m.length - INDS[a].m.length), order: number[] = [];
    for (let lo = 0, hi = ks.length - 1; lo <= hi;) { order.push(ks[lo++]); if (lo <= hi) order.push(ks[hi--]); }
    const maxN = INDS[ks[0]].m.length, rad: Record<number, number> = {}, pos: Record<number, THREE.Vector3> = {}, ang: Record<number, number> = {};
    order.forEach((k) => { rad[k] = .08 + .36 * Math.sqrt(INDS[k].m.length / maxN); });
    const circ = order.reduce((a, k) => a + rad[k] * 2.6, 0), R = Math.min(3, Math.max(2.3, circ / (2 * Math.PI)));
    let acc = 0;
    order.forEach((k, j) => { const a = (acc + rad[k] * 1.3) / circ * Math.PI * 2; acc += rad[k] * 2.6; ang[k] = a; pos[k] = V(Math.cos(a) * R, Math.sin(j * 2.1) * .22, Math.sin(a) * R); });
    ks.forEach((k) => {
      const m = INDS[k].m.slice().sort((a, b) => R1[a] - R1[b]), nd = pos[k].clone().normalize();
      m.forEach((i, j) => {
        const [x1, y1, z1] = fib(j, m.length), [gx, gy, gz] = fib(Math.floor(R2[i] * N), N);
        put("aHome2", i, pos[k].clone().add(V(x1, y1, z1).multiplyScalar(rad[k])));
        put("aCore2", i, V(gx, gy, gz).add(nd.clone().multiplyScalar(1.5)).normalize().multiplyScalar(.25 + .5 * Math.cbrt(R3[i])));
        put("aNode2", i, pos[k]);
      });
    });
    for (const nm of ["aHome2", "aCore2", "aNode2"]) pts.geometry.attributes[nm].needsUpdate = trail.geometry.attributes[nm].needsUpdate = true;
    return { order, rad, pos, ang };
  }
  function clearInner() { disposeTree(inner); inner.clear(); innerArcs.clear(); st.iw = {}; st.ih = {}; }
  function buildInner(L: NonNullable<typeof st.L>) {
    clearInner(); inner.add(innerArcs);
    L.order.forEach((k) => {
      lanes(innerArcs, L.pos[k]);
      const w = wire(new THREE.IcosahedronGeometry(L.rad[k] * 1.2, 1), 0x59d8ff, 0); w.position.copy(L.pos[k]); inner.add(w); st.iw[k] = w;
      const h = glowSprite("rgba(255,255,255,.95)", 1, 0); h.position.copy(L.pos[k]); inner.add(h); st.ih[k] = h;
    });
  }

  /* ── industry view: every stock placed by RS (closer to the core = higher), with its 6M → today path ── */
  const l3 = new THREE.Group(); g.add(l3);
  const rOf = (p: number) => .5 + 2.35 * Math.pow(Math.max(0, 1 - p / 99), .75);
  const pUJS = (i: number, u: number) => { const tt = Math.max(0, Math.min(1, u)) * 3, s = Math.min(2, Math.floor(tt)), h = sstep(.1, 1, tt - s); return kp(i, s) + (kp(i, s + 1) - kp(i, s)) * h; };
  const L3 = `
attribute vec3 aDir; attribute float aIdx;
uniform float uHi; uniform float uFade;
float pU(float u){ float tt = clamp(u, 0.0, 1.0)*3.0; float s = min(floor(tt), 2.0); float f = tt - s; return mix(keyAt(s), keyAt(s+1.0), smoothstep(0.1, 1.0, f)); }
float rOf(float p){ return 0.5 + 2.35*pow(max(0.0, 1.0 - p/99.0), 0.75); }
float hiOf(){ return 1.0 - step(0.5, abs(aIdx - uHi)); }
float anyHi(){ return step(-0.5, uHi); }`;
  const PTS3 = `attribute float aSz; varying vec3 vC; varying float vA;
void main(){ float p = pU(uT/3.0); vec4 mv = modelViewMatrix*vec4(aDir*rOf(p), 1.0); gl_Position = projectionMatrix*mv;
  float h = hiOf(); gl_PointSize = max(2.0, (aSz + h*5.0)*(5.0/-mv.z))*uPx;
  vC = mix(ramp(p), vec3(1.0), h*0.35); vA = uFade * mix(1.0, mix(0.3, 1.0, h), anyHi()); }`;
  const LN3 = `attribute float aU; varying vec3 vC; varying float vA;
void main(){ float p = pU(aU); gl_Position = projectionMatrix*modelViewMatrix*vec4(aDir*rOf(p), 1.0);
  float past = step(aU, uT/3.0 + 0.001), h = hiOf();
  vC = ramp(p); vA = uFade * mix(0.05, 0.28, past) * mix(1.0, mix(0.35, 3.5, h), anyHi()); }`;
  function closeL3() { disposeTree(l3); l3.clear(); st.l3 = null; }
  function buildL3(k: number) {
    closeL3();
    const ord = INDS[k].m.slice().sort((a, b) => R1[a] - R1[b]), M = ord.length, dir = new Map<number, THREE.Vector3>();
    ord.forEach((i, j) => { const [x, y, z] = fib(j, M); dir.set(i, V(x, y * .5, z).normalize()); });
    const aPp = new Float32Array(M * 4), aD = new Float32Array(M * 3), aSz = new Float32Array(M), aIx = new Float32Array(M);
    ord.forEach((i, j) => { aPp.set(P.subarray(i * 4, i * 4 + 4), j * 4); const d = dir.get(i)!; aD.set([d.x, d.y, d.z], j * 3);
      aSz[j] = 3.2 + Math.max(0, Math.min(1, (CAP[i] - 7) / 5)) * 5.5; aIx[j] = j; });
    const ptsL = new THREE.Points(geo(M, { aP: [aPp, 4], aR: [new Float32Array(M), 1], aDir: [aD, 3], aSz: [aSz, 1], aIdx: [aIx, 1] }), mk(COMMON + L3 + PTS3, FPTS));
    const K = 28, nv = M * (K - 1) * 2, aU = new Float32Array(nv), lP = new Float32Array(nv * 4), lD = new Float32Array(nv * 3), lI = new Float32Array(nv);
    ord.forEach((i, j) => { const d = dir.get(i)!; for (let q = 0; q < K - 1; q++) for (let e = 0; e < 2; e++) { const v = (j * (K - 1) + q) * 2 + e;
      aU[v] = (q + e) / (K - 1); lP.set(P.subarray(i * 4, i * 4 + 4), v * 4); lD.set([d.x, d.y, d.z], v * 3); lI[v] = j; } });
    const lines = new THREE.LineSegments(geo(nv, { aP: [lP, 4], aR: [new Float32Array(nv), 1], aDir: [lD, 3], aIdx: [lI, 1], aU: [aU, 1] }), mk(COMMON + L3 + LN3, FLINE));
    ptsL.frustumCulled = lines.frustumCulled = false; ptsL.renderOrder = 2;
    const shells = [wire(new THREE.IcosahedronGeometry(rOf(80), 2), 0x3fe0a6, .32), wire(new THREE.IcosahedronGeometry(rOf(50), 2), 0xffc24a, .08), wire(new THREE.IcosahedronGeometry(rOf(0), 2), 0xff5c5c, .035)];
    shells.forEach((o) => base(o.material));
    const glow = glowSprite("rgba(120,255,210,.8)", 1.4, .25); base(glow.material);
    l3.add(lines, ptsL, ...shells, glow);
    st.l3 = { k, ord, dir };
  }
  const l3pos = (i: number, t: number) => st.l3!.dir.get(i)!.clone().multiplyScalar(rOf(pUJS(i, t / 3))).multiplyScalar(l3.scale.x).add(l3.position);

  /* ── labels ── */
  let LABS: Label[] = [];
  function setLabels(defs: Label[]) {
    labLayer.innerHTML = "";
    LABS = defs.map((d) => { const el = document.createElement("div"); el.className = "fsw-lab" + (d.cls ? " " + d.cls : ""); labLayer.appendChild(el); d.el = el; d.last = null; return d; });
  }
  const _v = V(), _n = V(), _c = V();
  let W = 1, H = 1, zf = 1;
  function toScreen(p: THREE.Vector3) {
    _v.copy(p).applyMatrix4(g.matrixWorld); const depth = _v.distanceTo(camera.position); _v.project(camera);
    return { x: (_v.x + 1) / 2 * W, y: (1 - _v.y) / 2 * H, k: H / 2 / (depth * Math.tan(camera.fov * Math.PI / 360)) };
  }
  function drawLabels() {
    for (const l of LABS) {
      _v.copy(l.pos(T)).applyMatrix4(g.matrixWorld);
      let vis = 1;
      if (l.facing) { _n.copy(_v).normalize(); _c.copy(camera.position).sub(_v).normalize(); vis = _n.dot(_c) > .15 ? 1 : 0; }
      _v.project(camera); if (_v.z > 1) vis = 0;
      const hw = (l.w || 0) / 2 + 8, x = Math.max(hw, Math.min(W - hw, (_v.x + 1) / 2 * W)), y = (1 - _v.y) / 2 * H;
      l.el!.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
      const t = l.text(T); if (t !== l.last) { l.el!.innerHTML = t; l.last = t; l.w = l.el!.offsetWidth; }
      l.el!.style.opacity = String(t ? vis * (l.alpha ? l.alpha() : 1) : 0);
    }
  }

  const bezJS = (a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number) => a.clone().multiplyScalar((1 - t) * (1 - t)).add(c.clone().multiplyScalar(2 * t * (1 - t))).add(b.clone().multiplyScalar(t * t));
  const vec = (arr: Float32Array, i: number) => V(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
  // JS mirror of the shader path, so named packets can carry a label
  function pathJS(i: number, s: number, f: number) {
    const sel = SEC[i] === st.sel, z = sel ? st.zE : 0;
    const H0 = vec(aHome, i).lerp(vec(aHome2, i), z), C0 = vec(aCore, i).lerp(vec(aCore2, i), z), Nd = vec(aNode, i).lerp(vec(aNode2, i), z);
    const d = R1[i] * .7, gg = sstep(d, d + .3, f), la = kp(i, s) >= 80 ? 1 : 0, lb = kp(i, s + 1) >= 80 ? 1 : 0;
    return bezJS(la ? C0 : H0, Nd.multiplyScalar(.5).add(V(0, .85 * (lb - la), 0)), lb ? C0 : H0, gg).multiplyScalar(1 + (sel ? 0 : st.zE * 1.4));
  }
  const netChip = (n: number) => (n ? ` <b style="color:${n > 0 ? "var(--fsw-up)" : "var(--fsw-down)"}">${signed(n)}</b>` : "");
  const lvl = (v: number, t: number) => `<b style="color:${v >= mktT(t) ? "var(--fsw-up)" : "var(--fsw-down)"}">${Math.round(v * 100)}%</b>`;
  const rsCol = (v: number) => (v >= 80 ? "var(--fsw-up)" : v >= 50 ? "var(--fsw-mid)" : "var(--fsw-down)");
  const netAt = (x: number, t: number) => (t > .001 ? NET[x][segOf(t)] : 0);
  const netI = (k: number, t: number) => (t > .001 ? SEG[segOf(t)].indNet[k] : 0);
  const baseLabels: Label[] = SECS.map((_, x) => ({
    alpha: () => 1 - st.zE, pos: () => node[x].clone().add(V(0, nodeR[x] + .45, 0)),
    text: (t) => `<span style="opacity:${(.35 + .65 * Math.max(U.uDim.value[x], st.hover === x ? 1 : 0)).toFixed(2)}">${short(x)} ${lvl(shareT(x, t), t)}${netChip(netAt(x, t))}</span>`,
  }));
  baseLabels.push({ cls: "big", alpha: () => 1 - st.zE2, pos: () => V(0, -1.25, 0), text: () => (st.sel != null && st.Z > .5 ? `${short(st.sel)} · RS 80+` : "RS 80+ core") });
  for (let r = 0; r < 5; r++) {
    const live = (t: number) => {
      if (t >= 3) return null;
      const s = Math.min(2, Math.floor(t)), f = t - s, list = st.sel != null && st.Z > .5 ? bigFor(st.sel, s) : SEG[s].big, i = list[r];
      // phones name one rise and one fall (slots 0 and 3) so the tags don't pile up
      if (i == null || (narrow && r !== 0 && r !== 3)) return null; const d = R1[i] * .7; return f < d || f > d + .4 ? null : { i, s, f };
    };
    baseLabels.push({ cls: "tag", alpha: () => 1 - st.zE2,
      pos: (t) => { const c = live(t); return c ? pathJS(c.i, c.s, c.f).add(V(0, .17, 0)) : V(0, -99, 0); },
      text: (t) => { const c = live(t); if (!c) return ""; const up = kp(c.i, c.s + 1) >= 80;
        return `<span style="color:${up ? "var(--fsw-up)" : "var(--fsw-down)"}">${up ? "▲" : "▼"}</span> <b>${TK[c.i]}</b> ${kp(c.i, c.s)}→${kp(c.i, c.s + 1)}`; } });
  }
  for (const r of [0, 1, -1]) {
    const pick = (t: number) => { if (t < .001) return null; const R = SEG[segOf(t)].indRank; return (r >= 0 ? R[r] : R[R.length + r]) ?? null; };
    baseLabels.push({ cls: "tag ind", alpha: () => 1 - st.zE,
      pos: (t) => { const k = pick(t); if (k == null) return V(0, -99, 0); const x = INDS[k].sec, o = V(node[x].x, 0, node[x].z).normalize();
        return V(node[x].x, bandY[k], node[x].z).add(o.multiplyScalar(nodeR[x] + .35)); },
      text: (t) => { const k = pick(t); return k == null ? "" : `${trunc(INDS[k].name, 24)}${netChip(SEG[segOf(t)].indNet[k])}`; } });
  }
  const innerLabels = (L: NonNullable<typeof st.L>): Label[] => {
    const movers = (t: number) => { const s = segOf(t); return new Set(L.order.slice().sort((a, b) => Math.abs(SEG[s].indNet[b]) - Math.abs(SEG[s].indNet[a])).slice(0, 3)); };
    const minN = L.order.length > 16 ? 20 : 6;
    return L.order.map((k) => ({ alpha: () => st.zE * (1 - st.zE2), pos: () => L.pos[k].clone().add(V(0, L.rad[k] + .3, 0)),
      text: (t: number) => (INDS[k].m.length >= (narrow ? Infinity : minN) || (t > .001 && movers(t).has(k)) ? `${trunc(INDS[k].name, 22)} ${lvl(iShareT(k, t), t)}${netChip(netI(k, t))}` : "") }));
  };
  const l3Labels = (k: number): Label[] => [
    ...INDS[k].m.slice().sort(byCap).slice(0, 14).map((i, q) => ({ alpha: () => st.zE2, pos: (t: number) => (st.l3 ? l3pos(i, t) : V(0, -99, 0)),
      text: (t: number) => { if (narrow && q >= 6) return ""; const p = Math.round(pUJS(i, t / 3)); return `<b>${TK[i]}</b> <span style="color:${rsCol(p)}">${p}</span>`; } })),
    { cls: "big", alpha: () => st.zE2, pos: () => V(0, rOf(80) + .1, 0).multiplyScalar(l3.scale.x).add(l3.position), text: () => "RS 80 line" },
  ];
  const fmtCap = (lg: number) => { const v = Math.pow(10, lg); return v >= 1e12 ? "$" + (v / 1e12).toFixed(1) + "T" : v >= 1e9 ? "$" + (v / 1e9).toFixed(1) + "B" : "$" + Math.round(v / 1e6) + "M"; };
  function tipHTML(i: number) {
    const seq = [0, 1, 2, 3].map((k) => kp(i, k)), hi = HI[i], price = PRICE[i];
    const off = hi == null ? "" : hi >= -.5 ? "at its 52-wk high" : `${Math.round(-hi)}% off 52-wk high`;
    return `<b>${TK[i]}</b> <span class="d">${trunc(IND[i], 28)}</span><br>RS ${seq.map((v) => `<span style="color:${rsCol(v)}">${v}</span>`).join(" → ")} <span class="d">6M → now</span><br>${[price != null ? "$" + price.toFixed(2) : "", off, fmtCap(CAP[i]) + " cap"].filter(Boolean).join(" · ")}`;
  }

  /* ── picking and navigation ── */
  function pickSector(x: number, y: number) {
    if (st.Zt === 1) return -1;
    let best = -1, bd = 1e9;
    SECS.forEach((_, s) => { const p = toScreen(node[s]), d = Math.hypot(p.x - x, p.y - y); if (d < nodeR[s] * 1.45 * p.k + 10 && d < bd) { bd = d; best = s; } });
    return best;
  }
  function pickInd(x: number, y: number) {
    if (!st.L) return null; let best: number | null = null, bd = 1e9;
    st.L.order.forEach((k) => { const p = toScreen(st.L!.pos[k]), d = Math.hypot(p.x - x, p.y - y); if (d < st.L!.rad[k] * 1.45 * p.k + 8 && d < bd) { bd = d; best = k; } });
    return best;
  }
  function pickStock(x: number, y: number) {
    if (!st.l3) return -1; let best = -1, bd = 14;
    st.l3.ord.forEach((i, j) => { const p = toScreen(l3pos(i, T)), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = j; } });
    return best;
  }
  const sectorText = (x: number): [string, string] => [`Inside <em>${short(x)}</em>`, `Each sphere is an industry inside ${short(x)}, sized by its number of stocks. Packets are stocks crossing RS 80 into or out of the sector's leaders core. Shell colour compares an industry's share of leaders with the market; the halo shows leaders gained or lost. Click an industry to see its stocks.`];
  function zoomIn(x: number) {
    st.L = layout(x); buildInner(st.L); st.sel = x; U.uSel.value = x; st.Zt = 1; st.hover = -1; cv.style.cursor = "";
    setLabels(baseLabels.concat(innerLabels(st.L)));
    setTitle(...sectorText(x)); shownLog = ""; clearFeed();
  }
  function openInd(k: number) {
    buildL3(k); st.ind = k; st.Zt2 = 1; st.hi = st.pin = -1; st.hoverInd = null; cv.style.cursor = "";
    setLabels(baseLabels.concat(innerLabels(st.L!), l3Labels(k)));
    const nm = INDS[k].name;
    setTitle(`Inside <em>${trunc(nm, 28)}</em>`, `All ${INDS[k].m.length} stocks in ${nm}, placed by RS: the closer to the core, the higher the RS percentile; the green shell is the RS 80 line. Trails trace each stock's RS from 6 months ago to today. Hover a stock for details, click to pin it.`);
    shownLog = ""; clearFeed();
  }
  function zoomOut() {
    if (st.Zt2 === 1) { st.Zt2 = 0; st.hi = st.pin = -1; setTitle(...sectorText(st.sel!)); shownLog = ""; clearFeed(); return; }
    if (st.Zt === 0) return;
    st.Zt = 0; setTitle(NAME, DESC); shownLog = ""; clearFeed();
  }
  const zoomSel = () => (st.sel != null && st.Z > .5 && st.Z2 < .5 ? st.sel : null);
  const zoomInd = () => (st.ind != null && st.Z2 > .5 ? st.ind : null);
  function focusA(t: number) {
    if (t < .001 || st.Zt2 === 1) return null;
    if (st.sel != null && st.L) {
      const s = segOf(t), L = st.L;
      const k = t > 2.999 ? L.order.filter((q) => INDS[q].m.length >= 5).sort((a, b) => ILEAD[b][3] - ILEAD[a][3])[0] : L.order.slice().sort((a, b) => SEG[s].indNet[b] - SEG[s].indNet[a])[0];
      return k == null ? null : L.ang[k];
    }
    const f = spotlight(t); return f ? nodeA[f[0]] : null;
  }

  /* ── per-frame scene update ── */
  function update(time: number) {
    st.Z += (st.Zt - st.Z) * .055; if (Math.abs(st.Zt - st.Z) < .002) st.Z = st.Zt;
    const zE = st.zE = ease(st.Z); U.uZoom.value = zE;
    st.Z2 += (st.Zt2 - st.Z2) * .055; if (Math.abs(st.Zt2 - st.Z2) < .002) st.Z2 = st.Zt2;
    const zE2 = st.zE2 = ease(st.Z2); U.uZoom2.value = zE2; U.uFade.value = zE2;
    if (st.Zt2 === 0 && st.Z2 === 0 && st.l3) { closeL3(); st.ind = null; if (st.L) setLabels(baseLabels.concat(innerLabels(st.L))); }
    if (st.l3 && st.L) {
      const from = st.L.pos[st.l3.k], r0 = st.L.rad[st.l3.k] / 2.9;
      l3.position.copy(from).lerp(V(0, 0, 0), zE2); l3.scale.setScalar(r0 + (1 - r0) * zE2);
      l3.children.forEach((o) => { const m = (o as THREE.Mesh).material as THREE.Material; if (m.userData.base != null) m.opacity = m.userData.base * zE2; });
    }
    core.material.opacity = .1 * (1 - zE2); coreGlow.material.opacity = .28 * (1 - zE2);
    const j = st.Zt2 === 1 && st.l3 ? (st.pin >= 0 ? st.pin : st.hi) : -1; U.uHi.value = j;
    if (j >= 0 && st.l3) {
      const i = st.l3.ord[j], p = toScreen(l3pos(i, T));
      if (st.tipFor !== i) { tipEl.innerHTML = tipHTML(i); st.tipFor = i; }
      tipEl.hidden = false;
      tipEl.style.transform = `translate(${p.x > W - 300 ? p.x - tipEl.offsetWidth - 14 : p.x + 14}px,${p.y - 12}px)`;
    } else if (!tipEl.hidden) { tipEl.hidden = true; st.tipFor = -2; }
    if (st.Zt === 0 && st.Z === 0 && st.sel != null) { st.sel = null; U.uSel.value = -1; clearInner(); st.L = null; setLabels(baseLabels); }
    core.rotation.y = time * .1; core.rotation.x = time * .04;
    const mk0 = mktT(T), seg = segOf(T), mx = Math.max(1, ...NET.map((r) => Math.abs(r[seg]))), focus = st.sel != null ? null : spotlight(T);
    arcs.children.forEach((o) => { const m = (o as THREE.Line).material as THREE.LineBasicMaterial; m.opacity = m.userData.base * (1 - zE); });
    SECS.forEach((_, x) => {
      const dim = (U.uDim.value[x] += ((focus ? (focus.includes(x) ? 1 : .26) : 1) - U.uDim.value[x]) * .06);
      const w = wires[x]; w.rotation.y = time * (.2 + x * .01); w.rotation.x = time * .1;
      w.material.color.setHex(shareT(x, T) >= mk0 ? 0x3fe0a6 : 0xff5c5c); w.material.opacity = (st.hover === x ? .5 : .05 + .13 * dim) * (1 - zE);
      const n = netAt(x, T), v = Math.abs(n) / mx;
      halos[x].material.color.setHex(n >= 0 ? 0x3fe0a6 : 0xff5c5c); halos[x].material.opacity = v * .42 * (.35 + .65 * dim) * (1 - zE); halos[x].scale.setScalar(nodeR[x] * 3 + v * 1.1);
    });
    if (st.L) {
      innerArcs.children.forEach((o) => { const m = (o as THREE.Line).material as THREE.LineBasicMaterial; m.opacity = m.userData.base * zE * (1 - zE2); });
      const imx = Math.max(1, ...st.L.order.map((k) => Math.abs(netI(k, T))));
      st.L.order.forEach((k, q) => {
        const w = st.iw[k], h = st.ih[k]; if (!w) return;
        w.rotation.y = time * (.2 + q * .01); w.rotation.x = time * .1;
        w.material.color.setHex(iShareT(k, T) >= mk0 ? 0x3fe0a6 : 0xff5c5c); w.material.opacity = (st.hoverInd === k ? .55 : .16) * zE * (1 - zE2);
        const n = netI(k, T), v = Math.abs(n) / imx;
        h.material.color.setHex(n >= 0 ? 0x3fe0a6 : 0xff5c5c); h.material.opacity = v * .45 * zE * (1 - zE2); h.scale.setScalar(st.L!.rad[k] * 3 + v * .8);
      });
    }
  }

  /* ── sizing: layout px (offsetWidth) so labels line up inside the shell's CSS zoom ── */
  const cam = { dist: 9.3, tilt: .5, spin: .25 };
  let narrow = false;
  function resize() {
    narrow = host.offsetWidth < 860; root.classList.toggle("narrow", narrow);
    W = Math.max(1, cv.offsetWidth); H = Math.max(1, cv.offsetHeight);
    const rect = cv.getBoundingClientRect(); zf = rect.width / W || 1;
    renderer.setSize(W, H, false); camera.aspect = W / H;
    // Wide: shift the scene left of the log and up off the caption and transport, which sit along the bottom
    if (!narrow) camera.setViewOffset(W, H, 160, H * .05, W, H); else camera.clearViewOffset();
    const asp = Math.min(1, W / H * (narrow ? 1 : .85));
    // A short, wide stage leaves the ring small, so move in (never closer than 84% of the base distance)
    const near = narrow ? 1 : Math.max(.84, Math.min(1, 1.9 / (W / H)));
    camera.position.set(0, 0, cam.dist * near / Math.pow(asp, .75)); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(host); ro.observe(cv);
  let visible = true;
  const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; }); io.observe(root);

  /* ── input: drag to orbit, click to open, hover to point ── */
  let drag: { x: number; y: number } | null = null, downAt: { x: number; y: number; t: number } | null = null, lastDrag = -1e9;
  let yaw = 0, yawV = 0, pitch = 0;
  const local = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / zf, y: (e.clientY - r.top) / zf }; };
  const onDown = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; cv.setPointerCapture(e.pointerId); };
  const onMove = (e: PointerEvent) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
      if (Math.abs(dx) + Math.abs(dy) > 0) lastDrag = performance.now();
      yawV = dx * .006; yaw += yawV; pitch = Math.max(-.7, Math.min(.7, pitch + dy * .004));
      return;
    }
    const p = local(e);
    let over: boolean;
    if (st.Zt2 === 1) { st.hi = pickStock(p.x, p.y); over = st.hi >= 0; }
    else if (st.Zt === 1) { st.hoverInd = st.Z > .9 ? pickInd(p.x, p.y) : null; over = st.hoverInd != null; }
    else { st.hover = pickSector(p.x, p.y); over = st.hover >= 0; }
    cv.style.cursor = over ? "pointer" : "";
  };
  const onUp = (e: PointerEvent) => {
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && performance.now() - downAt.t < 500) {
      const p = local(e);
      if (st.Zt2 === 1) { const j = pickStock(p.x, p.y); st.pin = j === st.pin ? -1 : j; }
      else if (st.Zt === 1) { if (st.Z > .9) { const k = pickInd(p.x, p.y); if (k != null) openInd(k); } }
      else { const s = pickSector(p.x, p.y); if (s >= 0) zoomIn(s); }
    }
    drag = null; downAt = null;
  };
  const onLeave = () => { if (!drag) { st.hover = -1; st.hoverInd = null; st.hi = -1; } };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && visible && st.Zt === 1) zoomOut(); };
  cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove); cv.addEventListener("pointerup", onUp);
  cv.addEventListener("pointercancel", onUp); cv.addEventListener("pointerleave", onLeave);
  window.addEventListener("keydown", onKey);
  backEl.onclick = zoomOut;

  /* ── replay transport ── */
  let T = reduced ? 3 : 0, playing = !reduced, mode: "hold" | "move" | "rewind" = "hold", until = performance.now() + 900, lastScrub = 0;
  const setPlaying = (p: boolean) => { playing = p; playBtn.textContent = p ? "❚❚ Pause" : "▶ Play"; if (p) { mode = "hold"; until = performance.now() + 200; } };
  setPlaying(playing);
  playBtn.onclick = () => setPlaying(!playing);
  scrub.addEventListener("input", () => { lastScrub = performance.now(); setPlaying(false); T = Number(scrub.value) / 1000; });
  function advance(now: number, dt: number) {
    if (!playing) return;
    if (mode === "hold") { if (now >= until) mode = T >= 2.9999 ? "rewind" : "move"; }
    else if (mode === "move") {
      const tgt = Math.floor(T + 1e-6) + 1, prev = T; T = Math.min(tgt, T + dt / MOVE); emit(prev, T);
      if (T >= tgt) { mode = "hold"; until = now + (T >= 2.9999 ? END_HOLD : HOLD); }
    } else { T = Math.max(0, T - dt / REW); if (T <= 0) { mode = "hold"; until = now + HOLD; clearFeed(); } }
  }

  /* ── side log: crossings for the period on screen, and a live feed of the largest ── */
  function clearFeed() { feed.innerHTML = ""; }
  function emit(a: number, b: number) {
    const s = Math.min(2, Math.floor(a + 1e-6)), fa = a - s, fb = b - s, zi = zoomInd(), zs = zoomSel();
    const list = zi != null ? industryTop(zi, s) : zs != null ? sectorTop(zs, s) : SEG[s].top;
    for (const i of list) {
      const th = R1[i] * .7 + .3; if (!(th > fa && th <= fb)) continue;
      const up = kp(i, s + 1) >= 80, hi = HI[i];
      const sub = zi != null ? (hi == null ? "" : Math.round(-hi) + "% off high") : zs != null ? trunc(IND[i], 22) : short(SEC[i]);
      const d = document.createElement("div");
      d.innerHTML = `<span class="${up ? "u" : "d"}">${up ? "▲" : "▼"}</span><b>${TK[i]}</b><span class="s">${sub}</span><span class="${up ? "u" : "d"}">${kp(i, s)}→${kp(i, s + 1)}</span>`;
      feed.prepend(d); while (feed.children.length > 14) feed.lastChild!.remove();
    }
  }
  let shownLog = "";
  function bar(name: string, out: number, inn: number, mx: number) {
    const n = inn - out;
    return `<span class="nm">${name}</span><span class="bv"><i style="width:${out / mx * 100}%"></i><i style="width:${inn / mx * 100}%"></i></span><span class="nt" style="color:${n > 0 ? "var(--fsw-up)" : n < 0 ? "var(--fsw-down)" : "var(--fsw-dim)"}">${signed(n)}</span>`;
  }
  function updateLog() {
    const s = segOf(T), zs = zoomSel(), zi = zoomInd(), kf = T < .001 ? 0 : s + 1, key = `${s}:${zs}:${zi}:${kf}`;
    if (key === shownLog) return; shownLog = key;
    const G = SEG[s];
    $("segh").textContent = `${PL[s]} → ${PL[s + 1]} · ${MONTHS[s]} mo`;
    if (zi != null) {
      const spark = (i: number) => { const v = [0, 1, 2, 3].map((k) => kp(i, k)), y = (p: number) => (15 - p / 99 * 14).toFixed(1);
        return `<svg viewBox="0 0 60 16" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="60" y1="${y(80)}" y2="${y(80)}" stroke="rgba(63,224,166,.25)" stroke-dasharray="2 2"/><polyline points="${v.map((p, q) => `${q * 20},${y(p)}`).join(" ")}" fill="none" stroke="${rsCol(v[3])}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`; };
      $("segk").textContent = `Inside ${trunc(INDS[zi].name, 26)} · top RS`;
      $("tin").textContent = `▲ ${G.indIn[zi]} entered`; $("tout").textContent = `▼ ${G.indOut[zi]} left`;
      $("bars").innerHTML = INDS[zi].m.slice().sort((a, b) => kp(b, kf) - kp(a, kf)).slice(0, 12)
        .map((i) => `<span class="nm"><b>${TK[i]}</b></span>${spark(i)}<span class="nt" style="color:${rsCol(kp(i, kf))}">${kp(i, kf)}</span>`).join("");
      return;
    }
    if (zs != null) {
      const ks = indsOf(zs).filter((k) => G.indIn[k] + G.indOut[k] > 0).sort((a, b) => G.indNet[b] - G.indNet[a]).slice(0, 12), mx = Math.max(1, ...ks.map((k) => Math.max(G.indIn[k], G.indOut[k])));
      $("segk").textContent = `Inside ${short(zs)} · RS 80 crossings`;
      $("tin").textContent = `▲ ${G.inn[zs]} entered`; $("tout").textContent = `▼ ${G.out[zs]} left`;
      $("bars").innerHTML = ks.map((k) => bar(trunc(INDS[k].name, 19), G.indOut[k], G.indIn[k], mx)).join("");
      return;
    }
    const mx = Math.max(...G.inn, ...G.out, 1), ord = SECS.map((_, k) => k).sort((a, b) => (G.inn[b] - G.out[b]) - (G.inn[a] - G.out[a]));
    $("segk").textContent = "Transfer log · RS 80 crossings";
    $("tin").textContent = `▲ ${G.inn.reduce((a, b) => a + b, 0)} entered`; $("tout").textContent = `▼ ${G.out.reduce((a, b) => a + b, 0)} left`;
    $("bars").innerHTML = ord.map((k) => bar(short(k), G.out[k], G.inn[k], mx)).join("");
  }

  /* ── loop ── */
  setLabels(baseLabels);
  resize();
  let raf = 0, last = performance.now(), time = 0, lastStory = "";
  const storyEl = root.querySelector(".fsw-story") as HTMLDivElement;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(64, now - last); last = now;
    if (!visible) return;
    time += dt / 1000;
    advance(now, dt);
    let focused = false;
    if (playing && !drag && now - lastDrag > 5000) {
      const a = focusA(T);
      if (a != null) { const tgt = a - Math.PI / 2 + .35 - cam.spin, dl = Math.atan2(Math.sin(tgt - yaw), Math.cos(tgt - yaw)); yaw += dl * .018; focused = true; }
    }
    if (!drag) { yawV *= .94; yaw += yawV + (reduced || focused || st.Zt2 === 1 ? 0 : .0014); }
    tilt.rotation.x = cam.tilt + pitch; spin.rotation.y = cam.spin + yaw;
    U.uT.value = T; U.uTime.value = time;
    update(time);
    if (now - lastScrub > 150) scrub.value = String(Math.round(T * 1000));
    const k = Math.round(T), atKey = Math.abs(T - k) < .004;
    stamp.textContent = mode === "rewind" && playing ? "Rewind" : atKey ? PL[k] : `${PL[Math.floor(T)].replace(" ago", "")} → ${PL[Math.floor(T) + 1].replace(" ago", "")}`;
    ticks.forEach((t, q) => t.classList.toggle("on", Math.abs(T - q) < .5));
    updateLog();
    const zi = zoomInd(), zs = zoomSel(), [sk, sp] = zi != null ? industryStory(zi, T) : zs != null ? sectorStory(zs, T) : marketStory(T);
    if (sk + sp !== lastStory) { lastStory = sk + sp; $("storyK").textContent = sk; $("storyP").innerHTML = sp; storyEl.classList.remove("flash"); void storyEl.offsetWidth; storyEl.classList.add("flash"); }
    const open = st.Zt === 1, verb = tap ? "Tap" : "Click";
    const hint = st.Zt2 === 1 ? (tap ? "Tap a stock for its details" : "Hover a stock · click to pin") : open ? `${verb} an industry to see its stocks` : `${verb} a sphere to look inside`;
    backEl.hidden = !open; if (hintEl.textContent !== hint) hintEl.textContent = hint; hintEl.hidden = false;
    const bl = open ? `${st.Zt2 === 1 ? "← " + short(st.sel!) : "← All sectors"} <span class="fsw-dim">Esc</span>` : "";
    if (backEl.innerHTML !== bl) backEl.innerHTML = bl;
    scene.updateMatrixWorld(); renderer.render(scene, camera); drawLabels();
  }
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      window.removeEventListener("keydown", onKey);
      disposeTree(scene); renderer.dispose();
      root.remove();
    },
  };
}
