import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { auth, buildAuthPath, isUnauthorizedError } from "@/lib/auth";

const ClientDashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const ensureSession = async () => {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      try {
        const me = await auth.getMe();
        if (!me) {
          navigate(buildAuthPath({ returnTo, reason: "session_expired" }), { replace: true });
          return;
        }
      } catch (error) {
        if (isUnauthorizedError(error)) {
          navigate(buildAuthPath({ returnTo, reason: "session_expired" }), { replace: true });
          return;
        }
      }
    };

    ensureSession();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-lg border bg-card p-6 space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Dashboard Moved</h1>
        <p className="text-muted-foreground">
          This route is being migrated to the new backend. Use the admin panel client pages for now.
        </p>
        <Button onClick={() => navigate("/admin")}>Open Admin Panel</Button>
      </div>
    </div>
  );
};

export default ClientDashboard;
