"use client";

import { useEffect } from "react";

export function MobileZoomLock() {
  useEffect(() => {
    const preventDefault = (event: Event) => {
      event.preventDefault();
    };

    const preventMultiTouchZoom = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };

    let lastTouchEndAt = 0;
    const preventDoubleTapZoom = (event: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEndAt <= 350) {
        event.preventDefault();
      }
      lastTouchEndAt = now;
    };

    const preventKeyboardZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    };

    const options: AddEventListenerOptions = { passive: false };

    document.addEventListener("gesturestart", preventDefault, options);
    document.addEventListener("gesturechange", preventDefault, options);
    document.addEventListener("gestureend", preventDefault, options);
    document.addEventListener("touchmove", preventMultiTouchZoom, options);
    document.addEventListener("touchend", preventDoubleTapZoom, options);
    window.addEventListener("wheel", preventKeyboardZoom, options);

    return () => {
      document.removeEventListener("gesturestart", preventDefault, options);
      document.removeEventListener("gesturechange", preventDefault, options);
      document.removeEventListener("gestureend", preventDefault, options);
      document.removeEventListener("touchmove", preventMultiTouchZoom, options);
      document.removeEventListener("touchend", preventDoubleTapZoom, options);
      window.removeEventListener("wheel", preventKeyboardZoom, options);
    };
  }, []);

  return null;
}
