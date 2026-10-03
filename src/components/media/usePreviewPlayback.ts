"use client";

import { useEffect, useRef } from "react";

/**
 * Plays a muted card preview only while someone is looking at it: on hover or
 * keyboard focus where there is a mouse, and while it is mostly on screen on
 * touch devices (which have no hover). The stories grid used to autoplay every
 * clip at once, downloading all of them in full on page load.
 *
 * Spread `handlers` on the card's media frame (not the <video>), so moving onto
 * the overlay buttons doesn't count as leaving.
 */
export function usePreviewPlayback(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video || typeof IntersectionObserver === "undefined") return;
    const canHover = window.matchMedia("(hover: hover)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (canHover || reducedMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.75 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [enabled]);

  // `play()` rejects when a pause interrupts it — expected, not an error.
  const play = () => void videoRef.current?.play().catch(() => {});
  const pause = () => videoRef.current?.pause();

  return {
    videoRef,
    handlers: enabled
      ? { onMouseEnter: play, onMouseLeave: pause, onFocus: play, onBlur: pause }
      : {},
  };
}
