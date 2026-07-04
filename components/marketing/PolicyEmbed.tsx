"use client";

import { useEffect, useRef } from "react";

/**
 * Embeds a Termageddon policy. The div id must match the embed key; the matching
 * script (placed right after the div, like the original static embed) finds that
 * id and injects the policy. The script is intentionally left in place — removing
 * it can interrupt the policy from loading.
 */
export default function PolicyEmbed({ embedId }: { embedId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const src = `https://policies.termageddon.com/api/embed/${embedId}.js`;
    // Don't inject twice (e.g. React StrictMode double-mount in dev).
    if (document.querySelector(`script[src="${src}"]`)) return;

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    container.insertAdjacentElement("afterend", script);
  }, [embedId]);

  return (
    <div
      ref={containerRef}
      id={embedId}
      className="policy_embed_div"
      aria-live="polite"
      aria-busy="true"
      style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.65 }}
    >
      Please wait while the policy is loaded. If it does not load, please{" "}
      <a
        rel="nofollow"
        aria-label="click here to view the policy"
        href={`https://policies.termageddon.com/api/policy/${embedId}`}
        target="_blank"
      >
        click here to view the policy
      </a>
      .
    </div>
  );
}
