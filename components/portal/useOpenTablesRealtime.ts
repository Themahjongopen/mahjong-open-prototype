"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Live updates for the Open Tables page. Subscribes to league_tables and
// table_seats changes for the active city and, on any relevant event, calls
// router.refresh() to refetch the page's single joined query (tablesInCohortQuery)
// — we deliberately do NOT reconstruct that shape from row-level events, because
// a refetch is simpler and can't drift from the server's view.
//
// Returns a coarse connection status for the UI. "live" means the channel is
// joined and healthy; anything else means the page is NOT receiving live updates
// and the caller must fall back to the manual "Updated X ago" + Refresh path.
// That honesty is the whole safety property: a silently-dead socket that still
// looked "live" would be worse than having no live updates at all.

export type RealtimeStatus = "connecting" | "live" | "offline";

// A table filling to four seats fires several table_seats events within a moment;
// each event schedules a refresh, and this trailing debounce collapses the burst
// into a single refetch. ~700ms is long enough to swallow a rapid fill, short
// enough that a single change still feels instant.
const REFRESH_DEBOUNCE_MS = 700;

export function useOpenTablesRealtime(cityId: string | null, tableIds: string[]): RealtimeStatus {
  const router = useRouter();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  // Latest table ids for the event handler, without re-subscribing when they
  // change. A refetch re-renders the page and hands down a new array every time;
  // if that were an effect dependency the channel would be torn down and rebuilt
  // on every refresh. The handler reads the ref instead, so the channel is only
  // rebuilt when the *city* changes.
  const tableIdsRef = useRef(tableIds);
  tableIdsRef.current = tableIds;

  useEffect(() => {
    if (!cityId) {
      setStatus("offline");
      return;
    }

    const supabase = createClient();
    let disposed = false;
    let channel: RealtimeChannel | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (!disposed) router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const build = async () => {
      // The @supabase/ssr browser client fires INITIAL_SESSION on load, which
      // does NOT push the JWT to Realtime (only TOKEN_REFRESHED / SIGNED_IN do,
      // via supabase-js's internal auth listener). Without the user token the
      // socket authenticates as anon, RLS drops every event, and the channel
      // still reports SUBSCRIBED — a silent failure. So set the token explicitly
      // before subscribing. Subsequent token *refreshes* are handled for us:
      // supabase-js calls realtime.setAuth() on TOKEN_REFRESHED, so the channel
      // survives the 60-minute JWT expiry without re-subscribing.
      const { data } = await supabase.auth.getSession();
      if (disposed) return;
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);

      channel = supabase
        .channel(`open-tables:${cityId}`)
        // league_tables carries city_id, so filter server-side — this player only
        // wakes for changes in the city they're viewing.
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "league_tables", filter: `city_id=eq.${cityId}` },
          scheduleRefresh,
        )
        // table_seats has no city_id column, so it can't be filtered server-side.
        // Gate client-side to seats on a table currently shown for this city; a
        // seat on a table we don't know about is either in another city (ignore)
        // or on a brand-new table whose league_tables INSERT already refetched.
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "table_seats" },
          (payload) => {
            const newRec = payload.new as { table_id?: string };
            const oldRec = payload.old as { table_id?: string };
            const tid = newRec?.table_id ?? oldRec?.table_id;
            if (tid && tableIdsRef.current.includes(tid)) scheduleRefresh();
          },
        )
        .subscribe((s, err) => {
          if (disposed) return;
          if (s === "SUBSCRIBED") {
            setStatus("live");
            // Refetch on EVERY (re)subscribe, not just the first. Realtime does
            // not replay events missed while disconnected, so a reconnect after a
            // sleep/signal drop must catch up on whatever changed in the gap.
            scheduleRefresh();
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
            // Not receiving events. Surface it so the UI drops the "live" claim
            // and points the player at manual Refresh. The socket auto-reconnects
            // with stepped backoff; a later SUBSCRIBED flips us back to "live".
            if (err) console.warn("[open-tables realtime]", s, err.message);
            setStatus("offline");
          }
        });
    };

    build();

    // Phones suspend the socket on sleep and it may not recover promptly on wake.
    // When the tab becomes visible again, if the channel isn't healthy, tear it
    // down and rebuild — the fresh SUBSCRIBED then fires the catch-up refetch.
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!channel || channel.state !== "joined") {
        setStatus("connecting");
        if (channel) supabase.removeChannel(channel);
        channel = null;
        build();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Cleanup: on unmount OR when cityId changes (city switch), remove the old
    // channel before the effect re-runs and builds the new one, so channels never
    // accumulate.
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (debounce) clearTimeout(debounce);
      if (channel) supabase.removeChannel(channel);
    };
  }, [cityId, router]);

  return status;
}
