import AuthModal from "@/components/auth-modal";

export default function AuthPage() {
  console.log("AuthPage is loading AuthModal component");
  return (
    <div>
      <h1>DEBUG: This should be the NEW Firebase auth page</h1>
      <AuthModal defaultMode="signup" />
    </div>
  );
}
