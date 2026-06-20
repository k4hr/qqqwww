"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { trackEvent, type AnalyticsEventType } from "@/lib/client-analytics";

type Props = LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
  eventType: AnalyticsEventType;
  movieId?: string;
};

export function AnalyticsLink({ eventType, movieId, onClick, ...props }: Props) {
  return <Link {...props} onClick={(event) => { trackEvent(eventType, { movieId }); onClick?.(event); }} />;
}
