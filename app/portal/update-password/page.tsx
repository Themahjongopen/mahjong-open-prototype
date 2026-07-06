import SetPasswordForm from "@/components/portal/SetPasswordForm";

export default function UpdatePasswordPage() {
  return (
    <SetPasswordForm
      heading="Choose a new password"
      blurb="Enter a new password for your account."
      cta="Update password"
    />
  );
}
