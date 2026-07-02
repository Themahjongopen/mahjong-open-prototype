import type { CSSProperties, ReactElement } from "react";

export type ConfirmationIconName = "rsvp" | "clock" | "chat" | "invite";

// Inner markup mirrors public/assets/icons/*.svg (source of truth). Inlined so the
// stroke inherits currentColor (navy) and the #EC466E fill layer keeps the two-tone look.
const ICON_PATHS: Record<ConfirmationIconName, ReactElement> = {
  rsvp: (
    <>
      <g fill="#EC466E" fillOpacity="0.2" stroke="none">
        <circle cx="12" cy="12" r="8.5" />
      </g>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.2 10.8 15 16 9.5" />
    </>
  ),
  clock: (
    <>
      <g fill="#EC466E" fillOpacity="0.2" stroke="none">
        <circle cx="12" cy="12" r="8.5" />
      </g>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  chat: (
    <>
      <g fill="#EC466E" fillOpacity="0.2" stroke="none">
        <path d="M4 5.5h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9.5L5 20.5V15.5H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
      </g>
      <path d="M4 5.5h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9.5L5 20.5V15.5H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
    </>
  ),
  invite: (
    <>
      <g fill="#EC466E" fillOpacity="0.2" stroke="none">
        <path d="M21 3.5 3.5 11l7.5 2.6L13.6 21 21 3.5Z" />
      </g>
      <path d="M21 3.5 3.5 11l7.5 2.6L13.6 21 21 3.5Z" />
      <path d="M21 3.5 11 13.6" />
    </>
  ),
};

const WRAPPER_STYLE: CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: "50%",
  background: "var(--pink-50)",
  color: "var(--ink-900)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 20px",
};

export default function ConfirmationIcon({ name, style }: { name: ConfirmationIconName; style?: CSSProperties }) {
  return (
    <div style={{ ...WRAPPER_STYLE, ...style }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={30}
        height={30}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {ICON_PATHS[name]}
      </svg>
    </div>
  );
}
