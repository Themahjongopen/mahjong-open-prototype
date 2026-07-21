import { redirect } from "next/navigation";

// The marketing site has no public sign-in. This route exists only to bounce
// anyone who navigates to /sign-in directly back to the homepage. Members sign
// in through the player portal at /portal/login, which is untouched.
export default function SignInRedirect() {
  redirect("/");
}
