/**
 * GLSL sources for the obsidian liquid-glass backdrop.
 *
 * Pipeline: scene (raymarched SDF, HDR) → brightpass ↓4 → blur H → blur V
 * → composite (bloom add, ACES, vignette, dither).
 *
 * The scene shader is artistic, not physical: a hand-built light rig is
 * sampled by reflection vectors, thin-film fringes are gated to grazing
 * angles, and the "double rim" comes from one refracted inner march.
 */

export const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }
`;

export const SCENE_FRAG = `#version 300 es
precision highp float;

// dev aid: 1 = render the shape as flat white on black to judge the
// silhouette alone (toggle by editing; Vite HMR reloads the shader)
#define SILHOUETTE 0

uniform vec2  uRes;
uniform float uTime;
uniform mat3  uRot;        // world -> object rotation
uniform vec3  uPos;        // object world offset
uniform float uScale;      // breathing scale
uniform vec3  uLobeC[4];
uniform vec3  uLobeR[4];
uniform vec3  uKeyDir;     // toward the key light
uniform vec3  uKeyCol;
uniform float uKeyInt;
uniform vec2  uGlowUV;     // key light glow, screen uv
uniform float uWarpPhase;
uniform vec3  uSculpt;     // bend / twist / pinch amounts, noise-drifted

// material knobs
uniform float uSpecInt;
uniform float uIridInt;
uniform float uFilmBase;   // nm
uniform float uFilmVar;    // nm
uniform float uAbsorb;
uniform float uTransInt;
uniform float uBackInt;

out vec4 fragColor;

const float CAM_Z = 5.5;
const float CAM_Y = 0.0;
const float FOCAL = 3.1;

/* pow with clamped base — pow(0, y) is undefined in GLSL and produces
   NaN tiles on Apple GPUs */
float spow(float x, float y){ return pow(max(x, 1e-5), y); }
vec3 spow3(vec3 x, vec3 y){ return pow(max(x, vec3(1e-5)), y); }

/* ---------- hash / noise ---------- */
float hash1(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash1(i+vec3(0,0,0)), hash1(i+vec3(1,0,0)), f.x),
                 mix(hash1(i+vec3(0,1,0)), hash1(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash1(i+vec3(0,0,1)), hash1(i+vec3(1,0,1)), f.x),
                 mix(hash1(i+vec3(0,1,1)), hash1(i+vec3(1,1,1)), f.x), f.y), f.z);
}

/* ---------- SDF ---------- */
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float sdEll(vec3 p, vec3 r){
  float k0 = length(p/r);
  float k1 = length(p/(r*r));
  return k0*(k0-1.0)/max(k1, 1e-4);
}
float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}

/* Deformation operators applied to object space *before* the masses are
   evaluated. This is what turns a union of ellipsoids into an
   intentionally sculpted, flowing form instead of a recognisable stack
   of metaballs: the long axis bows, the cross-section twists along it,
   a waist pinches the middle, and the right end tapers to a tip. */
vec3 sculpt(vec3 p){
  // bend: bow the long axis in the view plane → gentle S-curve silhouette
  p.xy = rot2(p.x * uSculpt.x) * p.xy;
  // twist: rotate the cross-section along the long axis → curvature
  // transitions front-to-back, so the form flows rather than stacks
  p.yz = rot2(p.x * uSculpt.y) * p.yz;
  // waist: squeeze the middle so the masses read as joined through a neck
  p.yz *= 1.0 - uSculpt.z * exp(-p.x*p.x*1.5);
  // taper: thin the right end into an elegant tip
  p.yz *= 1.0 - 0.3 * smoothstep(-0.3, 1.6, p.x);
  return p;
}

float map(vec3 p){
  vec3 q = uRot*(p - uPos);
  q /= uScale;
  q = sculpt(q);
  float d = sdEll(q - uLobeC[0], uLobeR[0]);
  d = smin(d, sdEll(q - uLobeC[1], uLobeR[1]), 0.62);
  d = smin(d, sdEll(q - uLobeC[2], uLobeR[2]), 0.55);
  d = smin(d, sdEll(q - uLobeC[3], uLobeR[3]), 0.5);
  // low-frequency surface swell adds asymmetric tension to the silhouette
  d -= 0.05*(vnoise(q*1.1 + uWarpPhase) - 0.5);
  d -= 0.02*(vnoise(q*2.3 + uWarpPhase*1.7) - 0.5);
  // deformation compresses the metric; 0.55 keeps the march from overshooting
  return d*uScale*0.55;
}
vec3 calcNormal(vec3 p){
  const vec2 e = vec2(0.0015, -0.0015);
  return normalize(e.xyy*map(p + e.xyy) + e.yyx*map(p + e.yyx)
                 + e.yxy*map(p + e.yxy) + e.xxx*map(p + e.xxx));
}

/* ---------- studio light rig ----------
   The composition is carried by the reflections, not by isolated
   highlights. Two kinds of source:

   • one large soft key softbox → the main architectural glare, upper-left
   • several "ribbon" area lights modelled as great-circle bands on the
     reflection sphere. A band peaks where the reflected ray is
     perpendicular to the band's axis, so it traces a long curve that
     WRAPS the whole silhouette instead of pooling into an elliptical
     blob. Different axes give ribbons that cross the form at different
     angles; their colours are the deep-blue → violet → cyan → gold
     palette so the sculpture reads as lit optical glass. */

// great-circle band: bright where R is perpendicular to axis, feathered by width
float band(vec3 R, vec3 axis, float width){
  float a = dot(R, normalize(axis));
  return exp(-a*a/(width*width));
}

vec3 env(vec3 d){
  vec3 c = vec3(0.0);

  // --- key softbox: wide and soft, upper-left. No hard core (that reads
  // as an isolated white blob); just a broad plateau that the rim can
  // catch as a long soft glare ---
  vec3 ks = normalize(vec3(d.x*0.5, d.y, d.z));
  vec3 kd = normalize(vec3(uKeyDir.x*0.5, uKeyDir.y, uKeyDir.z));
  float k = clamp(dot(ks, kd), 0.0, 1.0);
  float plate = clamp((k - 0.7)/0.3, 0.0, 1.0);
  c += uKeyCol*uKeyInt*(plate*plate*0.5 + spow(k, 4.0)*0.05);

  // --- wrapping ribbons: the composition. Kept few and unequal so the
  // form reads as sculpted glass, not a tangle of neon. The cool ribbon
  // is the hero glare sweeping the upper rim; the others are accents. ---
  // cool white-cyan hero, near-vertical axis → long sweep along the top
  c += vec3(0.55, 0.80, 1.30) * band(d, vec3(0.16, 1.0, 0.12), 0.055) * 1.6;
  // violet accent, steep diagonal, hugging the left flank
  c += vec3(0.60, 0.30, 1.15) * band(d, vec3(0.88, 0.10, 0.42), 0.04) * 0.7;
  // warm gold kicker, low and to the right
  c += vec3(1.25, 0.70, 0.26) * band(d, vec3(-0.32, 0.55, 0.92), 0.05) * 0.55;

  // cool vertical gradient fill — a faint sky/floor split so the
  // shadowed flanks don't crush to pure black
  float f = clamp(d.y*0.5 + 0.5, 0.0, 1.0);
  c += mix(vec3(0.008, 0.011, 0.024), vec3(0.024, 0.032, 0.060), f) * 0.45;

  // near-black ambient
  c += vec3(0.005, 0.007, 0.012);
  return c;
}

/* ---------- thin-film interference ----------
   phase drives a palette sweep instead of raw spectral RGB, so the
   fringes can only ever be deep blue / indigo / violet / cyan / gold */
vec3 filmPalette(float w){
  vec3 s0 = vec3(0.06, 0.20, 0.95); // electric blue
  vec3 s1 = vec3(0.32, 0.14, 1.00); // indigo
  vec3 s2 = vec3(0.70, 0.30, 1.15); // violet
  vec3 s3 = vec3(0.15, 0.65, 0.90); // cyan
  vec3 s4 = vec3(1.15, 0.75, 0.30); // gold
  float x = fract(w)*5.0;
  if (x < 1.0) return mix(s0, s1, x);
  if (x < 2.0) return mix(s1, s2, x - 1.0);
  if (x < 3.0) return mix(s2, s3, x - 2.0);
  if (x < 4.0) return mix(s3, s4, x - 3.0);
  return mix(s4, s0, x - 4.0);
}
vec3 filmColor(float cosT, vec3 p){
  // thickness noise + a left→right drift place the hues like the
  // reference: indigo/violet on the left lobe, gold toward the right tip
  float th = uFilmBase + uFilmVar*vnoise(p*0.9 + 3.7)
           + 200.0*clamp(p.x*0.45, -0.7, 1.2);
  float w = th/560.0*(0.5 + 0.9*max(cosT, 0.0));
  return filmPalette(w);
}

/* ---------- background ---------- */
vec3 background(vec2 uv){
  vec3 c = vec3(0.0005, 0.0006, 0.0011);
  c += vec3(0.0008, 0.001, 0.0018)*smoothstep(-0.2, 1.3, uv.y);
  // sparse starfield
  float aspect = uRes.x/uRes.y;
  vec2 su = uv*vec2(aspect, 1.0)*16.0;
  vec2 cell = floor(su), fc = fract(su);
  float h = hash2(cell);
  if (h > 0.89) {
    vec2 sp = vec2(hash2(cell + 7.13), hash2(cell + 3.31))*0.7 + 0.15;
    float d = length(fc - sp);
    float tw = 0.65 + 0.35*sin(uTime*(0.25 + h*0.6) + h*41.0);
    float s = exp(-d*d*7000.0)*(0.2 + 0.8*hash2(cell + 9.7))*tw;
    c += vec3(0.75, 0.82, 1.0)*s*0.9;
  }
  // the key light seen directly: a soft round glow high on the frame
  // with a faint horizontal flare — a distant softbox, not a beam
  vec2 g = uv - uGlowUV;
  g.x *= aspect;
  float d2 = dot(g, g);
  float glow = exp(-d2*2600.0)*1.35;          // soft core
  glow += exp(-d2*220.0)*0.09;                 // broad halo
  glow += exp(-(g.y*g.y)/0.00035)*exp(-abs(g.x)*20.0)*0.10; // flare streak
  c += uKeyCol*glow*uKeyInt;
  return c;
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag/uRes;
  vec2 suv = (2.0*frag - uRes)/uRes.y;

  vec3 ro = vec3(0.0, CAM_Y, CAM_Z);
  vec3 rd = normalize(vec3(suv.x, suv.y, -FOCAL));

  // march, tracking closest approach so grazing rays still shade the rim
  float t = 0.0; float d = 1e9;
  float minD = 1e9; float tMin = 0.0;
  for (int i = 0; i < 160; i++) {
    d = map(ro + rd*t);
    if (d < minD) { minD = d; tMin = t; }
    if (d < 0.0005 || t > 12.0) break;
    t += d;
  }

  bool hit = d < 0.0005;
  float alpha = 1.0;
  if (!hit && tMin > 0.0) {
    float pr = 0.003*tMin; // ~pixel footprint at that depth
    if (minD < pr) { hit = true; t = tMin; alpha = 1.0 - minD/pr; }
  }

  vec3 bgc = background(uv);
  vec3 col;
#if SILHOUETTE
  col = hit ? mix(bgc, vec3(1.0), alpha) : vec3(0.02);
  fragColor = vec4(col, 1.0);
  return;
#endif
  if (hit) {
    vec3 p = ro + rd*t;
    vec3 N = calcNormal(p);
    vec3 V = -rd;
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float grz = spow(1.0 - ndv, 3.2);
    // a small reflectivity floor lets clean specular streaks read across
    // the mid-body, not only at the grazing rim
    float F = 0.07 + 0.93*spow(1.0 - ndv, 5.0);

    // front-surface reflection of the rig
    vec3 R = reflect(rd, N);
    vec3 er = env(R);
    col = er*F*uSpecInt;

    // thin-film iridescence — a thin colored fringe hugging the grazing
    // rim, broken into patches. Only lightly coupled to the env so the
    // rig's ribbons don't smear color across the flat centre.
    vec3 q = uRot*(p - uPos);
    float cg = vnoise(q*0.7 + 9.1);
    float cgate = 0.35 + 1.4*cg*cg;
    vec3 film = filmColor(ndv, q);
    vec3 irid = film*grz*cgate;
    col += irid*(er*0.5 + 0.9)*uIridInt;

    // hot white rim where the silhouette faces the key light (the light
    // wraps behind the object, so this cannot come from env() reflections).
    // broken into segments by surface noise so it reads as reflections,
    // not an outline
    vec3 rimDir = normalize(uKeyDir + vec3(-0.1, 0.3, -0.6));
    float rimMask = smoothstep(0.2, 0.9, dot(N, rimDir));
    float seg = vnoise(q*1.3 + 5.0);
    rimMask *= 0.25 + 0.75*seg*seg;
    vec3 rimCol = mix(uKeyCol, film*2.2, 0.45);
    col += rimCol*spow(1.0 - ndv, 7.0)*rimMask*6.5;

    // one refracted march inside → back-surface rim + faint transmission
    vec3 rdr = refract(rd, N, 0.645);
    float tin = 0.03;
    vec3 pin = p;
    for (int i = 0; i < 40; i++) {
      pin = p + rdr*tin;
      float dm = map(pin);
      if (dm > -0.0015) break;
      tin += max(-dm, 0.015);
    }
    vec3 N2 = calcNormal(pin);
    float atten = exp(-tin*uAbsorb);
    float c2 = clamp(dot(rdr, N2), 0.0, 1.0);
    float F2 = spow(1.0 - c2, 4.0);
    vec3 backCol = env(reflect(rdr, -N2))*2.0
                 + filmColor(c2, uRot*(pin - uPos))*0.07*uIridInt;
    col += backCol*F2*atten*uBackInt;
    vec3 T = refract(rdr, -N2, 1.55);
    if (dot(T, T) > 0.0) col += env(T)*atten*uTransInt;

    // near-black body floor
    col += vec3(0.0012, 0.0014, 0.002)*(0.3 + 0.7*ndv);
    col = mix(bgc, col, alpha);
  } else {
    col = bgc;
  }

  fragColor = vec4(col, 1.0);
}
`;

export const BRIGHT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uThreshold;
in vec2 vUv;
out vec4 fragColor;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = max(l - uThreshold, 0.0);
  k = k / (1.0 + k);
  fragColor = vec4(c * (k / max(l, 1e-4)), 1.0);
}
`;

export const BLUR_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uDir;   // texel-sized step
in vec2 vUv;
out vec4 fragColor;
void main(){
  const float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  vec3 c = texture(uTex, vUv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture(uTex, vUv + uDir*float(i)).rgb * w[i];
    c += texture(uTex, vUv - uDir*float(i)).rgb * w[i];
  }
  fragColor = vec4(c, 1.0);
}
`;

export const COMPOSITE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uVignette;
in vec2 vUv;
out vec4 fragColor;

vec3 aces(vec3 x){
  return clamp((x*(2.51*x + 0.03)) / (x*(2.43*x + 0.59) + 0.14), 0.0, 1.0);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }

void main(){
  vec3 c = texture(uScene, vUv).rgb;
  c += texture(uBloom, vUv).rgb * uBloomStrength;
  c *= uExposure;
  c = aces(c);
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVignette*dot(q, q)*2.0;
  c = pow(c, vec3(1.0/2.2));
  c += (hash(gl_FragCoord.xy) - 0.5)/255.0;
  fragColor = vec4(c, 1.0);
}
`;
