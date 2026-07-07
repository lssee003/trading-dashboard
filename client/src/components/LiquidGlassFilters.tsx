/**
 * Reusable SVG refraction filters for the glass theme — the browser-native
 * port of the @ybouane/liquidglass look (liquid-glass.ybouane.com). That tool
 * rasterizes the DOM behind each glass element and refracts it in a WebGL
 * shader; on a live, data-dense dashboard that means smeared numbers and a
 * WebGL context per element. These filters get the same optical read — light
 * bending at the glass, chromatic fringing on the rim — from `feTurbulence`
 * + `feDisplacementMap` applied through `backdrop-filter`, so they compose
 * with the existing `blur()` recipes, cost nothing to rasterize, and never
 * touch a glass element's own foreground text (backdrop-filter only bends
 * what sits BEHIND the element).
 *
 * Filters are frozen noise (no animation): a fixed glass texture, so they
 * are inherently reduced-motion safe. Referenced from index.css `.glass`
 * rules via `backdrop-filter: url(#id) blur(...)`. Chromium honours the
 * url() reference; Safari ignores url() in backdrop-filter and keeps just
 * the blur, which is an acceptable graceful degradation.
 *
 * Three intensities, tuned to element scale (feTurbulence wavelength is in
 * absolute px, so the same filter reads differently on a 12px bar vs a
 * 1400px header):
 *   lg-refract-bar    loud + chromatic aberration — signal bars, meters
 *   lg-refract-lens   medium + mild fringing      — pills, buttons, tooltips
 *   lg-refract-chrome gentle, large-scale bend    — header, ticker, shells
 */
export function LiquidGlassFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}
    >
      <defs>
        {/* BAR — the loudest recipe. Signal bars and meters are small, carry
            no text, and sit over the chart's light fields, so refraction can
            be pushed and split into RGB for visible chromatic aberration.
            Higher baseFrequency gives wave variation inside a ~12px rod. */}
        <filter
          id="lg-refract-bar"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.016 0.024"
            numOctaves="2"
            seed="11"
            result="noise"
          />
          {/* Displace the backdrop once per channel at diverging strengths →
              red bends most, blue least → colour splits at the rim. */}
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" result="dR" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="4.5" xChannelSelector="R" yChannelSelector="G" result="dG" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" result="dB" />
          <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cR" />
          <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cG" />
          <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cB" />
          {/* Channel-isolated layers recombine exactly under screen. */}
          <feBlend in="cR" in2="cG" mode="screen" result="cRG" />
          <feBlend in="cRG" in2="cB" mode="screen" />
        </filter>

        {/* LENS — medium recipe for interactive chrome (nav pill, segmented
            buttons, toggle sliders, tooltips, the cursor). A single warp with
            a whisper of chromatic split for life on the rim. */}
        <filter
          id="lg-refract-lens"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.012"
            numOctaves="2"
            seed="4"
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" result="dR" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" result="dB" />
          <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cRG" />
          <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cB" />
          <feBlend in="cRG" in2="cB" mode="screen" />
        </filter>

        {/* CHROME — gentle, long-wavelength bend for large surfaces (app
            header, ticker strip, breadth shell). Low frequency so the whole
            surface bows softly rather than ripples; no channel split, since
            it covers a big area and live content scrolls beneath. */}
        <filter
          id="lg-refract-chrome"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.004 0.007"
            numOctaves="2"
            seed="9"
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
