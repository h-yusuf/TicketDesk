import { useAuth } from "./auth/AuthContext";
import { LoginPage } from "./auth/LoginPage";
import { RequesterDashboard } from "./requests/RequesterDashboard";
import { ItAdminDashboard } from "./requests/ItAdminDashboard";

export default function App() {
  const { user, role, loading } = useAuth();

  if (loading)
    return (
      <p className="mt-16 text-center font-mono text-xs uppercase tracking-[0.3em] text-amber">
        Loading…
      </p>
    );
  if (!user) return <LoginPage />;
  if (role === "it_admin") return <ItAdminDashboard />;
  return <RequesterDashboard />;
}
