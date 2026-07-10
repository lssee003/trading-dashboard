import { useEffect, useRef } from "react";

/**
 * Backdrop for the AI Stack page (glass theme only): a fixed video whose
 * playback position is driven entirely by the page's own scroll position —
 * it never plays on its own. Replaces the Glass Field WebGL backdrop on
 * this page (see GlassBackdrop.tsx, which skips mounting on /ai-stack).
 *
 * Listens on `window`, not a container ref: the page's layout (App.tsx's
 * `min-h-screen` root) lets the whole document grow and scroll rather than
 * clipping height into an internally-scrolling `<main>`, so the window is
 * the real scroll source here.
 */
export function AIStackVideoBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let duration = 0;
    let rafPending = false;

    const applyProgress = () => {
      rafPending = false;
      if (!duration) return;
      const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollRange > 0 ? window.scrollY / scrollRange : 0;
      const clamped = Math.min(1, Math.max(0, progress));
      video.currentTime = clamped * duration;
    };

    const onScroll = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(applyProgress);
    };

    const onLoadedMetadata = () => {
      duration = video.duration || 0;
      video.pause();
      applyProgress();
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    if (video.readyState >= 1 /* HAVE_METADATA */) onLoadedMetadata();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="ai-stack-video-field" aria-hidden="true" data-testid="ai-stack-video-backdrop">
      <video
        ref={videoRef}
        className="ai-stack-video"
        src="/assets/ai-stack-scroll.mp4"
        muted
        playsInline
        preload="auto"
      />
      <div className="ai-stack-video-overlay" />
    </div>
  );
}
