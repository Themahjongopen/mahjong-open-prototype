import Image from "next/image";

// Brand logo for the portal auth cards (login, reset, set/update password).
// Replaces the old text-rendered "The Mahjong Open" wordmark. Same asset the
// marketing nav uses. Sized to roughly the visual weight of the 28px display
// wordmark it replaces; height:auto + maxWidth keep it responsive on the narrow
// cards frequently opened from email links on phones.
export default function AuthLogo() {
  return (
    <div style={{ textAlign: "center", marginBottom: 8 }}>
      <Image
        src="/assets/logo-nav.svg?v=2"
        alt="The Mahjong Open"
        width={170}
        height={56}
        priority
        style={{ width: 170, height: "auto", maxWidth: "100%", display: "inline-block" }}
      />
    </div>
  );
}
