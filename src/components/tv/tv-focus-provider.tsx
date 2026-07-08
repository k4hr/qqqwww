"use client";

import { useEffect } from "react";

type Focusable = HTMLElement & { dataset: DOMStringMap };

function getFocusableItems() {
  return Array.from(document.querySelectorAll<Focusable>("[data-tv-focus]")).filter((item) => {
    const rect = item.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && !item.hasAttribute("disabled") && item.getAttribute("aria-hidden") !== "true";
  });
}

function centerOf(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    rect,
  };
}

function pickNext(current: HTMLElement, direction: "up" | "down" | "left" | "right") {
  const items = getFocusableItems().filter((item) => item !== current);
  const currentCenter = centerOf(current);
  const candidates = items
    .map((item) => {
      const target = centerOf(item);
      const dx = target.x - currentCenter.x;
      const dy = target.y - currentCenter.y;
      const primary = direction === "left" || direction === "right" ? dx : dy;
      const secondary = direction === "left" || direction === "right" ? dy : dx;
      const forward = direction === "right" ? primary > 8 : direction === "left" ? primary < -8 : direction === "down" ? primary > 8 : primary < -8;
      if (!forward) return null;
      return { item, score: Math.abs(primary) * 1.35 + Math.abs(secondary) };
    })
    .filter(Boolean) as Array<{ item: Focusable; score: number }>;

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0]?.item ?? null;
}

function focusElement(element: HTMLElement | null) {
  if (!element) return;
  element.focus({ preventScroll: false });
  element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

export function TvFocusProvider() {
  useEffect(() => {
    const first = document.querySelector<HTMLElement>("[data-tv-autofocus]") ?? document.querySelector<HTMLElement>("[data-tv-focus]");
    window.setTimeout(() => focusElement(first), 120);

    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const current = active?.matches("[data-tv-focus]") ? active : document.querySelector<HTMLElement>("[data-tv-focus]");

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        if (!current) return;
        event.preventDefault();
        const direction = event.key.replace("Arrow", "").toLowerCase() as "up" | "down" | "left" | "right";
        focusElement(pickNext(current, direction));
        return;
      }

      if (event.key === "Enter" && active?.matches("[data-tv-focus]")) {
        const tagName = active.tagName.toLowerCase();
        if (tagName === "a" || tagName === "button") return;
        const nested = active.querySelector<HTMLElement>("a,button,input");
        nested?.click();
        return;
      }

      if (["Escape", "Backspace", "BrowserBack"].includes(event.key)) {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === "INPUT" && (target as HTMLInputElement).value) return;
        event.preventDefault();
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/msx";
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
