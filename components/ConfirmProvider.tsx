"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

// Drop-in replacement for window.confirm, styled to match the site:
//   const confirm = useConfirm();
//   if (!(await confirm({ message: "…", danger: true }))) return;
export function useConfirm() {
  return useContext(ConfirmContext);
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ message: "" });
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    setOpen(false);
    resolver.current?.(result);
    resolver.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
      if (e.key === "Enter") settle(true);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open ? (
        <div
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) settle(false); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: "var(--overlay-scrim, rgba(20,20,20,0.45))",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={opts.title ?? "Confirm"}
            style={{
              background: "#fff",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-lg)",
              width: "100%",
              maxWidth: 400,
              padding: "28px 28px 24px",
            }}
          >
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--ink-900)", margin: "0 0 10px" }}>
              {opts.title ?? "Are you sure?"}
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-700)", margin: "0 0 24px" }}>{opts.message}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => settle(false)}
                style={{ justifyContent: "center", padding: "11px 20px" }}
              >
                {opts.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => settle(true)}
                className={opts.danger ? "btn" : "btn btn-primary"}
                style={
                  opts.danger
                    ? { justifyContent: "center", padding: "11px 20px", background: "var(--crimson-500, #c8102e)", color: "#fff", border: "none" }
                    : { justifyContent: "center", padding: "11px 20px" }
                }
              >
                {opts.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}
