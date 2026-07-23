import { AppProviders } from "@/components/providers/app-providers";
import LoginPage from "./login-form";

export default function LoginLayoutPage() {
  return (
    <AppProviders>
      <LoginPage />
    </AppProviders>
  );
}
