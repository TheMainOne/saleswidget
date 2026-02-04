import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AdminClients = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/admin", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting to admin panel...</p>
    </div>
  );
};

export default AdminClients;
