import { useCallback, useRef } from "react";

/**
 * Attaches to a scrollable container. Once the element is both visible in the
 * viewport AND horizontally scrollable, performs a brief right-then-back jolt
 * so the user discovers the scroll affordance.
 *
 * Uses a callback ref so observers are attached the moment the element mounts —
 * this is critical when the element is conditionally rendered (e.g. after data loads).
 */
export function useScrollHint<T extends HTMLElement>() {
  const cleanupRef = useRef<(() => void) | null>(null);

  const callbackRef = useCallback((el: T | null) => {
    // Teardown previous observers whenever the element changes or unmounts
    cleanupRef.current?.();
    cleanupRef.current = null;

    if (!el) return;

    let fired = false;
    let isVisible = false;

    const tryJolt = () => {
      if (fired || !isVisible) return;
      if (el.scrollWidth <= el.clientWidth) return;
      fired = true;

      setTimeout(() => {
        el.scrollTo({ left: 48, behavior: "smooth" });
        setTimeout(() => {
          el.scrollTo({ left: 0, behavior: "smooth" });
        }, 420);
      }, 350);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) tryJolt();
      },
      { threshold: 0 }
    );

    // Fires whenever the container resizes (e.g. columns appear as data loads)
    const ro = new ResizeObserver(() => tryJolt());

    io.observe(el);
    ro.observe(el);

    cleanupRef.current = () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return callbackRef;
}
