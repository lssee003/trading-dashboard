import { useEffect, useRef } from "react";

/**
 * Backdrop for the AI Stack page (glass theme only): a fixed video whose
 * playback position is driven entirely by the page's own scroll position —
 * it never plays on its own. Replaces the Glass Field WebGL backdrop on
 * this page (see GlassBackdrop.tsx, which skips mounting on /ai-stack).
 */
export function AIStackVideoBackdrop({
  scrollContainerRef,
}: {
  scrollContainerRef: React.RefObject<HTMLElement>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = scrollContainerRef.current;
    if (!video || !container) return;

    let duration = 0;
    let rafPending = false;

    const applyProgress = () => {
      rafPending = false;
      if (!duration) return;
      const scrollRange = container.scrollHeight - container.clientHeight;
      const progress = scrollRange > 0 ? container.scrollTop / scrollRange : 0;
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
    container.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      container.removeEventListener("scroll", onScroll);
    };
  }, [scrollContainerRef]);

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
