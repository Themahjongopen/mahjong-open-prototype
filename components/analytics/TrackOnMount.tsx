"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

// Fires a Vercel Analytics custom event once when this mounts (e.g. on a
// confirmation page render). Renders nothing.
export default function TrackOnMount({ event }: { event: string }) {
  useEffect(() => {
    track(event);
  }, [event]);
  return null;
}
