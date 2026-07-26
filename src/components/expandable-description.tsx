"use client";

import { useId, useMemo, useState } from "react";

type Props = {
  text: string;
  className?: string;
};

export function ExpandableDescription({ text, className = "" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const canExpand = useMemo(() => text.trim().length > 210, [text]);

  return (
    <div className={`rf-expandable-description relative max-w-3xl ${className}`}>
      <p id={id} className={`${expanded ? "" : "line-clamp-3"} text-sm leading-6 text-[#b9bac1] sm:text-[15px]`}>
        {text}
      </p>

      {canExpand ? (
        expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-controls={id}
            aria-expanded="true"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-[#d55a68] transition hover:text-[#ff5a6d]"
          >
            Свернуть
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-controls={id}
            aria-expanded="false"
            aria-label="Читать описание полностью"
            className="rf-description-more mt-1 inline-flex min-h-8 items-center text-sm font-semibold text-[#e44a5d] transition hover:text-[#ff6374]"
          >
            … ещё
          </button>
        )
      ) : null}
    </div>
  );
}
