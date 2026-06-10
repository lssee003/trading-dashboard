import { useCallback } from "react";
import { useLocation } from "wouter";
import { flushSync } from "react-dom";

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Navigate via wouter with a View Transition wrapping the route change.
 * Falls back to instant navigation when the API is unavailable or the
 * user prefers reduced motion. flushSync ensures React commits the new
 * tree synchronously so the "new" snapshot is taken after the new page
 * renders, not before.
 */
export function useViewTransitionNavigate() {
  const [, setLocation] = useLocation();

  return useCallback(
    (href: string) => {
      const doc = document as ViewTransitionDocument;
      if (!doc.startViewTransition || prefersReducedMotion()) {
        setLocation(href);
        return;
      }
      doc.startViewTransition(() => {
        flushSync(() => {
          setLocation(href);
        });
      });
    },
    [setLocation],
  );
}
