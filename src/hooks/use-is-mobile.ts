"use client";

import { useEffect, useState } from "react";

export function useIsMobile(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(true);
  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [maxWidth]);
  return isMobile;
}
