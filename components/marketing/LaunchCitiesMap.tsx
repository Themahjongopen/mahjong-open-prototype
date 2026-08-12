"use client";

import { useEffect, useState } from "react";
import { MAP_VIEWBOX, STATE_PATHS, CITY_PINS } from "@/lib/marketing/launchCitiesMapData";

type CityStatus = { name: string; state: string; hit_minimum: boolean };

export default function LaunchCitiesMap() {
  const [statusByKey, setStatusByKey] = useState<Record<string, boolean>>({});
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string; hit: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/launch-cities")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const map: Record<string, boolean> = {};
        for (const c of (data.cities ?? []) as CityStatus[]) {
          map[`${c.name}, ${c.state}`] = c.hit_minimum;
        }
        setStatusByKey(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 1100, margin: "0 auto" }}>
      <svg
        viewBox={`${MAP_VIEWBOX.minX} ${MAP_VIEWBOX.minY} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      >
        <g>
          {STATE_PATHS.map((d, i) => (
            <path key={i} d={d} fill="var(--pink-100)" stroke="var(--pink-400)" strokeWidth={1.4} strokeLinejoin="round" />
          ))}
        </g>
        <g>
          {CITY_PINS.map((pin) => {
            const key = `${pin.name}, ${pin.state}`;
            const hit = statusByKey[key] ?? false;
            return (
              <circle
                key={key}
                cx={pin.x}
                cy={pin.y}
                r={7}
                fill={hit ? "var(--pink-400)" : "var(--paper-50)"}
                stroke={hit ? "#FFFFFF" : "var(--peri-400)"}
                strokeWidth={2}
                style={{ cursor: "pointer" }}
                tabIndex={0}
                onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, name: key, hit })}
                onMouseMove={(e) => setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
                onMouseLeave={() => setTooltip(null)}
                onFocus={() => setTooltip({ x: pin.x, y: pin.y, name: key, hit })}
                onBlur={() => setTooltip(null)}
              />
            );
          })}
        </g>
      </svg>

      <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 8, fontSize: 13, color: "var(--ink-900)", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 13, height: 13, borderRadius: "50%", background: "var(--paper-50)", border: "2px solid var(--peri-400)", display: "inline-block" }} />
          Not yet at 20-player minimum
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 13, height: 13, borderRadius: "50%", background: "var(--pink-400)", border: "2px solid #fff", display: "inline-block" }} />
          Hit 20-player minimum
        </span>
      </div>

      {/* Desktop only: floating tooltip that follows the cursor. */}
      {tooltip ? (
        <div
          className="lcm-tooltip-floating"
          style={{
            position: "fixed", left: tooltip.x, top: tooltip.y, transform: "translate(-50%, calc(-100% - 12px))",
            background: "var(--ink-900)", color: "#FFF1F7", fontSize: 13, padding: "8px 12px",
            borderRadius: 8, pointerEvents: "none", zIndex: 10, whiteSpace: "nowrap",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14 }}>{tooltip.name}</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>{tooltip.hit ? "Hit 20-player minimum" : "Registration open"}</div>
        </div>
      ) : null}

      {/* Touch/mobile only: fixed-location panel below the legend, always in the same spot. */}
      <div
        className="lcm-tooltip-mobile"
        style={{
          marginTop: 16,
          padding: "12px 16px",
          borderRadius: 10,
          background: "var(--ink-900)",
          color: "#FFF1F7",
          textAlign: "center",
          minHeight: 44,
          display: "none",
        }}
      >
        {tooltip ? (
          <>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{tooltip.name}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{tooltip.hit ? "Hit 20-player minimum" : "Registration open"}</div>
          </>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.7 }}>Tap a pin to see its status</div>
        )}
      </div>

      <style jsx>{`
        @media (hover: hover) and (pointer: fine) {
          .lcm-tooltip-mobile {
            display: none !important;
          }
        }
        @media (hover: none), (pointer: coarse) {
          .lcm-tooltip-floating {
            display: none !important;
          }
          .lcm-tooltip-mobile {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
