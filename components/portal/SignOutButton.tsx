"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <button type="button" className="btn btn-ghost" onClick={handleSignOut} style={{ justifyContent: "center", fontSize: 13 }}>
      Sign out
    </button>
  );
}
