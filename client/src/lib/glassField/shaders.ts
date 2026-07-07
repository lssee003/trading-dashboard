/**
 * GLSL for the Glass Field backdrop, ported verbatim from the Claude Design
 * file "Glass Field.dc.html". Two fragment programs drive a full-screen
 * triangle:
 *   SCENE_FS — raymarched black-glass blob (3 separating/rejoining lobes) with
 *              thin-film iridescent edges, floating in a starfield with aurora
 *              curtains and a drifting warm sun-star. Renders into an HDR
 *              (RGBA16F) offscreen target.
 *   COMP_FS  — tonemap pass: golden-angle bloom on highlights, ACES, black
 *              point, gentle contrast, cool vignette, filmic grain.
 * Kept byte-for-byte from the design so the mounted backdrop matches the
 * reference; retune via config.ts uniforms, not by editing GLSL.
 */

export const GLSL_VS = `#version 300 es
layout(location=0) in vec2 a; out vec2 vUv;
void main(){ vUv = a*0.5+0.5; gl_Position = vec4(a,0.0,1.0); }`;

export const GLSL_SCENE_FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;
uniform float uSep; uniform float uDrift; uniform float uIrid; uniform float uMood;
out vec4 outColor;

float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash21(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float noise(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
  float n=i.x+i.y*57.0+113.0*i.z;
  float a=hash11(n), b=hash11(n+1.0), c=hash11(n+57.0), d=hash11(n+58.0);
  float e=hash11(n+113.0), g=hash11(n+114.0), h=hash11(n+170.0), k=hash11(n+171.0);
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,g,f.x),mix(h,k,f.x),f.y),f.z);
}
vec3 noise3(vec3 p){ return vec3(noise(p), noise(p+31.4), noise(p+57.7)); }
vec2 rot(vec2 v,float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c)*v; }
float sdEllipsoid(vec3 p, vec3 r){ float k0=length(p/r); float k1=length(p/(r*r)); return k0*(k0-1.0)/k1; }
float smin(float a,float b,float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }

// saturated thin-film palette: gold -> magenta -> violet -> blue -> cyan (soap-film family)
vec3 iridescence(float x){
  // blue / violet / magenta / cyan soap-film family (reference palette) — yellow & green suppressed
  x=fract(x);
  vec3 c = 0.5 + 0.5*cos(6.28318530718*(x + vec3(0.00, 0.33, 0.62)));
  c.g *= 0.42;                    // kill yellow/green
  c.r *= 0.88;
  c.b = mix(c.b, 1.0, 0.22);      // keep a blue floor so the film stays cool
  return c;
}

float map(vec3 P){
  float T=uTime;
  // gentle floating drift (translation + slow tumble), scaled by uDrift
  vec3 dft = uDrift*vec3(
     1.0*(noise(vec3(T*0.045, 0.0, 0.0))-0.5),
     0.7*(noise(vec3(0.0, T*0.05, 3.0))-0.5),
     0.5*(noise(vec3(5.0, 0.0, T*0.04))-0.5));
  vec3 p=P - dft;
  float rx = uDrift*0.18*(noise(vec3(T*0.03,3.0,0.0))*2.0-1.0) + uMouse.y*0.09;
  float ry = uDrift*0.05*T + uDrift*0.20*(noise(vec3(0.0,T*0.03,7.0))*2.0-1.0) + uMouse.x*0.16;
  float rz = uDrift*0.10*(noise(vec3(9.0,0.0,T*0.03))*2.0-1.0);
  p.yz=rot(p.yz,rx); p.xz=rot(p.xz,ry); p.xy=rot(p.xy,rz);

  // organic surface warp
  vec3 wv = (noise3(p*0.55 + vec3(0.0,0.0,T*0.05))-0.5)*0.45;
  p += wv;

  // separation: slow, non-periodic; mostly joined, occasionally splits apart
  float sn = noise(vec3(T*0.026, 11.0, 0.0));
  sn = smoothstep(0.0,1.0,sn);                         // ease the timing
  float sep = uSep * smoothstep(0.64,0.96,sn) * 2.2;  // rare, then a full deliberate pinch-and-part
  float k = mix(1.10, 0.10, clamp(sep,0.0,1.0));      // blend radius collapses to distinct droplets

  // three roundish lobes in a compact cluster, pushed apart by sep
  vec3 c0 = vec3(-0.95, 0.35, 0.10) * (1.0+sep);
  vec3 c1 = vec3( 1.05,-0.10,-0.10) * (1.0+sep);
  vec3 c2 = vec3( 0.05,-0.78, 0.15) * (1.0+sep*0.85);
  float d = sdEllipsoid(p - c0, vec3(1.15,1.06,1.10));
  d = smin(d, sdEllipsoid(p - c1, vec3(1.26,1.12,1.16)), k);
  d = smin(d, sdEllipsoid(p - c2, vec3(1.02,0.96,1.02)), k);

  d += 0.018*(noise(p*1.15 + wv)-0.5);          // subtle fold
  d -= (noise(vec3(T*0.08,1.0,2.0))-0.5)*0.020;  // breathing
  return d*0.82;
}
vec3 calcNormal(vec3 p){
  const vec2 k=vec2(1.0,-1.0); const float e=0.0035;
  return normalize(
    k.xyy*map(p+k.xyy*e)+
    k.yyx*map(p+k.yyx*e)+
    k.yxy*map(p+k.yxy*e)+
    k.xxx*map(p+k.xxx*e));
}
vec2 iSphere(vec3 ro,vec3 rd,float ra){
  float b=dot(ro,rd); float c=dot(ro,ro)-ra*ra; float h=b*b-c;
  if(h<0.0) return vec2(-1.0);
  h=sqrt(h); return vec2(-b-h,-b+h);
}

float starfield(vec2 uv,float density,float sz){
  vec2 g=uv*density; vec2 id=floor(g); vec2 f=fract(g)-0.5;
  float hh=hash21(id);
  if(hh<0.88) return 0.0;
  vec2 pos=(vec2(hash21(id+3.1),hash21(id+7.7))-0.5)*0.8;
  float d=length(f-pos);
  float star=smoothstep(sz,0.0,d);       // sz = on-screen star radius for this layer
  // occasional twinkle: each star is mostly steady, then flares in a brief, desynced sparkle
  float seed=hash21(id+13.3);
  float rate=0.16+seed*0.42;                        // per-star cadence (cycle ~1.7-6s)
  float cyc=fract(uTime*rate + seed*10.0);          // slow cycle, staggered per star
  float spark=exp(-pow((cyc-0.5)*11.0,2.0));        // narrow flash near mid-cycle
  float shimmer=0.90+0.10*sin(uTime*0.7+hh*30.0);   // faint always-on breath
  float tw=shimmer + spark*(0.7+0.8*seed);          // flares brighter only occasionally
  return star*tw*(hh-0.88)/0.12;
}

vec3 lightDir(){
  // the star slowly drifts across the sky on layered noise; reflections track it
  vec2 sd = vec2((noise(vec3(uTime*0.013,2.0,0.0))-0.5)*0.22,
                 (noise(vec3(0.0,uTime*0.011,5.0))-0.5)*0.12);
  return normalize(vec3(0.18 + sd.x*1.3, 0.92 + sd.y*1.3, 0.30));
}

// soft=0 for the visible sky (pure black + stars + lamp); soft>0 for reflections/refractions
// (adds the coloured light fields that tint the glass, and softens the lamp)
vec3 envColor(vec3 rd, float soft){
  // mood: 0 Cosmic (balanced), 1 Ember (warm), 2 Ice (cool)
  float mE=1.0-clamp(abs(uMood-1.0),0.0,1.0);
  float mI=1.0-clamp(abs(uMood-2.0),0.0,1.0);
  float mC=1.0-clamp(abs(uMood-0.0),0.0,1.0);
  float warmW=mC*1.0+mE*1.7+mI*0.35;
  float coolW=mC*1.0+mE*0.45+mI*1.7;
  vec3 col = mC*vec3(0.015,0.020,0.045) + mE*vec3(0.030,0.018,0.028) + mI*vec3(0.010,0.020,0.052);
  vec2 sc=rd.xy/(abs(rd.z)+0.6);
  // parallax star layers (depth via pointer) + brighter, denser
  float s = starfield(sc + uMouse*0.010, 6.0, 0.030)*1.4
          + starfield(sc*1.7+4.0 + uMouse*0.024, 11.0, 0.050)*0.95
          + starfield(sc*3.0+9.0 + uMouse*0.045 + vec2(uTime*0.003,0.0), 20.0, 0.050)*0.6;
  s *= (1.0-0.5*soft);
  col += vec3(0.92,0.95,1.0)*s;
  // faint nebula haze so the void has depth (warms slightly in Ember)
  float neb = noise(vec3(sc*1.3,7.0))*noise(vec3(sc*0.6+3.0,2.0));
  col += mix(vec3(0.05,0.06,0.11), vec3(0.09,0.05,0.06), mE)*neb*(1.0-0.4*soft);

  // aurora — a couple of broad vertical curtains filled with fine rays, drifting
  // slowly across the upper sky: brighter at a foot low in the sky, frayed into
  // wispy tips above. Cool teal foot -> violet tips. Kept faint (background sky
  // only) so it sits UNDER the UI instead of washing over it. NB: for on-screen
  // rays sc.y only spans ~[-0.37, 0.29], so every envelope edge lives in that
  // range — otherwise the fade never engages and it reads as a flat wash.
  {
    float sway = (noise(vec3(sc.y*0.6 + uTime*0.03, uTime*0.02, 2.0)) - 0.5) * 0.30;
    float x = sc.x + sway;
    float fx = x*7.0 - uTime*0.10;                                     // few broad curtains, drifting sideways
    float curtain = smoothstep(0.35, 1.0, pow(0.5 + 0.5*sin(fx), 2.0));// distinct bands, not a wash
    float ray = pow(0.5 + 0.5*sin(x*44.0 - uTime*0.22), 6.0);          // fine vertical rays within a curtain
    float shimmer = 0.6 + 0.4*sin(sc.y*20.0 + x*6.0 - uTime*0.8);      // faint vertical flicker up the rays
    float body = curtain * (0.35 + 0.65*ray) * (0.7 + 0.3*shimmer);
    float foot = smoothstep(-0.24, -0.03, sc.y);                       // rise into the foot
    float tips = 1.0 - smoothstep(-0.03, 0.30, sc.y);                  // fray out toward the tips
    float au = max(body,0.0) * foot * tips;
    vec3 aCol = mix(vec3(0.10,0.70,0.66), vec3(0.50,0.26,0.86),
                    smoothstep(-0.06, 0.26, sc.y));                    // teal foot -> violet tips
    col += aCol * au * 0.20 * (1.0 - 0.9*soft);
  }

  // coloured studio fields — only seen in/through the glass, mood-weighted
  float fld = clamp(soft*2.5,0.0,1.0);
  col += vec3(1.00,0.58,0.18)*pow(max(dot(rd,normalize(vec3(-0.58,0.28,0.55))),0.0),3.2)*0.55*fld*warmW; // gold, upper-left (small warm accent)
  col += vec3(0.22,0.42,1.00)*pow(max(dot(rd,normalize(vec3(-0.45,-0.35,0.60))),0.0),2.0)*1.05*fld*coolW; // electric blue, lower-left
  col += vec3(0.20,0.40,1.00)*pow(max(dot(rd,normalize(vec3( 0.58,-0.22,0.55))),0.0),2.0)*1.15*fld*coolW; // blue, lower-right
  col += vec3(0.55,0.24,0.95)*pow(max(dot(rd,normalize(vec3( 0.12,0.55,0.55))),0.0),2.4)*0.85*fld*coolW;  // violet, top
  col += vec3(0.22,0.72,1.00)*pow(max(dot(rd,normalize(vec3(-0.20,-0.45,0.60))),0.0),2.2)*0.75*fld*coolW;  // cyan, low
  // bright blue studio strip-lights -> the flowing reflection streaks that fill the glass body
  float b1 = dot(rd, normalize(vec3( 0.55,-0.78, 0.28)));
  col += vec3(0.30,0.58,1.00)*exp(-b1*b1*120.0)*1.05*fld*coolW;
  float b2 = dot(rd, normalize(vec3(-0.70,-0.32, 0.52)));
  col += vec3(0.46,0.74,1.00)*exp(-b2*b2*180.0)*0.85*fld*coolW;
  float b3 = dot(rd, normalize(vec3( 0.10, 0.72, 0.60)));
  col += vec3(0.40,0.50,1.00)*exp(-b3*b3*150.0)*0.55*fld*coolW;

  // lamp glow ONLY in reflections (the single sky lamp is drawn once in main)
  float lg = smoothstep(0.0,0.12,soft);
  vec3 L=lightDir();
  float dl=max(dot(rd,L),0.0);
  col += vec3(1.0,0.98,0.95)*pow(dl,220.0)*0.3*lg;
  col += vec3(1.0,0.99,0.97)*pow(dl,1400.0)*0.8*lg;
  return col;
}

void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;
  vec3 ro=vec3(uMouse.x*0.25, 0.10+uMouse.y*0.14, 8.6);
  vec3 ta=vec3(0.55,-0.30,0.0);   // reframed up from the design's 0.80 so the blob sits centred, not pushed to the bottom
  vec3 ww=normalize(ta-ro);
  vec3 uu=normalize(cross(ww,vec3(0.0,1.0,0.0)));
  vec3 vv=cross(uu,ww);
  vec3 rd=normalize(uv.x*uu+uv.y*vv+1.72*ww);

  bool hit=false; float t=0.0;
  vec2 bs=iSphere(ro,rd,5.0);
  if(bs.y>0.0){
    t=max(bs.x,0.0);
    float tmax=bs.y;
    for(int i=0;i<100;i++){
      vec3 p=ro+rd*t;
      float d=map(p);
      if(d<0.0006*t+0.0004){ hit=true; break; }
      t+=d*0.7;
      if(t>tmax) break;
    }
  }

  vec3 col;
  if(hit){
    vec3 p=ro+rd*t;
    vec3 n=calcNormal(p);
    vec3 v=-rd;
    float nov=clamp(dot(n,v),0.0,1.0);
    float F0=0.12;
    float fres=F0+(1.0-F0)*pow(1.0-nov,5.0);

    // reflection off the outer shell, with chromatic dispersion at the edge
    vec3 rdir=reflect(rd,n);
    vec3 tang=normalize(cross(rdir, vec3(0.0,1.0,0.0)) + 1e-4);
    float dsp=0.035*fres;
    vec3 refl=vec3(
      envColor(normalize(rdir - tang*dsp),0.5).r,
      envColor(rdir,0.5).g,
      envColor(normalize(rdir + tang*dsp),0.5).b);

    // ---- refraction THROUGH the shell (2 interfaces) => see-through glass ----
    float IOR=1.45;
    vec3 through;
    vec3 rdIn=refract(rd,n,1.0/IOR);
    if(dot(rdIn,rdIn)<1e-6){
      through=refl;
    } else {
      float ti=0.03; vec3 q=p; float dd=0.0;
      for(int i=0;i<60;i++){
        q=p+rdIn*ti;
        dd=map(q);
        if(dd>0.0) break;
        ti+=max(-dd,0.035);
      }
      vec3 nex=calcNormal(q);
      vec3 rdOut=refract(rdIn,-nex,IOR);
      if(dot(rdOut,rdOut)<1e-6) rdOut=reflect(rdIn,-nex); // total internal reflection
      through=envColor(rdOut,0.4);
      through*=exp(-ti*vec3(0.26,0.22,0.18)); // strong absorption -> deep black glass
      through*=smoothstep(0.03,0.20,ti);      // ultra-thin regions stay dark (kills waist glitch)
      float caus=noise(p*2.0 + rdIn*1.5 + vec3(0.0,0.0,uTime*0.10));
      caus=pow(caus,1.6);
      through*=0.55 + 0.8*caus;               // smooth deep interior (no banded layers)
    }

    // glass body: mostly black glass; colour lives on the edges/ridges
    col = mix(through, refl, fres);
    col += refl*0.03;

    vec3 L0=lightDir();
    float lf=smoothstep(-0.1, 0.85, dot(n,L0));             // faces the warm star

    // thin-film iridescence — curvature-driven filaments; WARM GOLD on lit crests, cool elsewhere
    float gravity=smoothstep(0.9,-0.9,p.y);
    float curv=abs(map(p+n*0.06)+map(p-n*0.06));           // world-space curvature
    float ridge=smoothstep(0.02,0.06, curv);               // only genuine sharp creases
    float edge=pow(1.0-nov,3.0);
    float irMask=edge + ridge*0.30;                        // colour on the rim, not across the smooth interior
    float thick=250.0+700.0*noise(p*1.5+n*0.6+vec3(0.0,0.0,uTime*0.03));
    float phase=fract(thick/520.0 + (1.0-nov)*1.6 + 0.30*n.x + 0.18*n.y + 0.20*noise(p*0.6));
    vec3 tf=iridescence(phase);
    float lum=dot(tf,vec3(0.299,0.587,0.114));
    tf=clamp(mix(vec3(lum), tf, 1.2), 0.0, 1.3);
    vec3 gold=vec3(1.0,0.72,0.28);
    vec3 irCol=mix(tf, gold, lf*0.6);                       // warm where lit, cool where not
    col += irCol*irMask*(0.85+0.5*gravity)*uIrid;
    // bright warm-gold rake on the light-facing crests (the premium sheen)
    col += gold*ridge*lf*pow(1.0-nov,1.8)*0.9*uIrid;
    vec3 rimCol=mix(vec3(1.0), irCol, gravity);            // whiter up top, coloured low
    col += rimCol*pow(1.0-nov,6.0)*0.45*uIrid;

    // ONE hard specular hotspot (the star's warm kiss) + soft top rim
    vec3 hh=normalize(L0+v);
    float ndh=max(dot(n,hh),0.0);
    col += vec3(1.0,0.96,0.88)*pow(ndh,3200.0)*5.0;         // single warm blown hotspot
    col += vec3(1.0,0.97,0.90)*pow(1.0-nov,7.0)*smoothstep(0.0,0.7,dot(n,L0))*0.8;
  } else {
    col=envColor(rd,0.0);
    // clean, warm, cinematic sun-star with a soft diffraction flare — slowly drifting
    vec2 sd = vec2((noise(vec3(uTime*0.013,2.0,0.0))-0.5)*0.20,
                   (noise(vec3(0.0,uTime*0.011,5.0))-0.5)*0.10);
    vec2 lpos = vec2(0.12,0.42) + sd + uMouse*0.04;
    vec2 dsv = uv-lpos;
    float d2 = dot(dsv, dsv);
    float tw = 0.93 + 0.07*noise(vec3(uTime*0.4, 7.0, 0.0));
    float smE=1.0-clamp(abs(uMood-1.0),0.0,1.0);
    float smI=1.0-clamp(abs(uMood-2.0),0.0,1.0);
    vec3 tint = mix(vec3(1.0,0.95,0.88), vec3(1.0,0.87,0.72), smE*0.7);
    tint = mix(tint, vec3(0.84,0.91,1.08), smI*0.7);
    vec3 star = vec3(0.0);
    star += vec3(1.0,0.97,0.92)*exp(-d2*140000.0)*4.2;   // tight bright core
    star += vec3(1.0,0.95,0.87)*exp(-d2*12000.0) *1.9;   // smooth bloom
    star += vec3(0.98,0.95,0.92)*exp(-d2*900.0)  *0.55;  // wide soft halo
    star += vec3(0.82,0.88,1.02)*exp(-d2*90.0)   *0.16;  // faint far glow
    // faint sun-flare — soft rays spreading in every direction from the core
    float ang = atan(dsv.y, dsv.x);
    float rr  = length(dsv);
    float rays = pow(max(0.0, sin(ang*18.0 + 0.7 + uTime*0.05)), 4.0)
               + pow(max(0.0, sin(ang*11.0 + 2.3)), 4.0)*0.7
               + pow(max(0.0, sin(ang*27.0 - 4.1 - uTime*0.03)), 6.0)*0.5;
    float radial = exp(-rr*16.0) + 0.15*exp(-rr*6.0);   // hug the core; rays stay short
    star += vec3(1.0,0.95,0.86)*rays*radial*0.04;       // much fainter, soft not striking
    col += star*tw*tint;
  }
  outColor=vec4(col,1.0);
}`;

export const GLSL_COMP_FS = `#version 300 es
precision highp float;
uniform sampler2D uScene; uniform vec2 uRes; uniform float uTime;
in vec2 vUv; out vec4 outColor;
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  float aspect=uRes.x/uRes.y;
  vec3 scene=texture(uScene,vUv).rgb;
  // subtle bloom, highlights only
  vec3 bloom=vec3(0.0); float total=0.0;
  const int N=48;
  float a0=hash(gl_FragCoord.xy)*6.2831;
  for(int i=0;i<N;i++){
    float fi=float(i);
    float ang=fi*2.399963 + a0;
    float rad=sqrt(fi/float(N))*0.05;
    vec2 off=vec2(cos(ang),sin(ang))*rad; off.x/=aspect;
    vec3 s=texture(uScene,vUv+off).rgb;
    float l=max(max(s.r,s.g),s.b);
    vec3 bright=s*max(l-1.05,0.0)/max(l,0.001);
    float wgt=exp(-fi/float(N)*1.9);
    bloom+=bright*wgt; total+=wgt;
  }
  bloom/=total;
  vec3 col=scene + bloom*1.35;
  col=aces(col);
  col=max(col-0.002,0.0)*(1.0/(1.0-0.002)); // clean black point
  col=mix(col, col*col*(3.0-2.0*col), 0.12); // gentle contrast
  float vig=1.0-0.36*pow(clamp(length((vUv-0.5)*vec2(aspect,1.0))*0.95,0.0,1.0),2.3);
  vig=clamp(vig,0.0,1.0);
  col*=vig;
  col*=mix(vec3(0.82,0.90,1.10), vec3(1.0), vig);   // cooler toward the edges
  float luma=dot(col,vec3(0.299,0.587,0.114));
  float g=hash(gl_FragCoord.xy+fract(uTime)*vec2(37.0,17.0))-0.5;
  col+=g*(0.006+0.010*(1.0-luma));                  // filmic grain, subtle
  outColor=vec4(col,1.0);
}`;
