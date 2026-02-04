import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  auth,
  getUserSites,
  hasAdminRole,
  hasSuperAdminRole,
  hasUserSites,
  sanitizeReturnToPath,
  type AuthUser,
} from "@/lib/auth";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const returnTo = useMemo(
    () => sanitizeReturnToPath(searchParams.get("returnTo")),
    [searchParams],
  );
  const authReason = searchParams.get("reason");

  useEffect(() => {
    if (authReason !== "session_expired") return;

    toast({
      title: "Session expired",
      description: "Please sign in again to continue.",
    });
  }, [authReason]);

  const checkRoleAndRedirect = useCallback(async (userInfo: AuthUser, preferredPath?: string | null) => {
    // Keep redirects scoped to auth route; use router pathname (basename-safe).
    if (!location.pathname.startsWith("/auth")) return;

    if (userInfo.isActive === false) {
      toast({
        title: "Access disabled",
        description: "Your account is inactive. Contact support.",
        variant: "destructive",
      });
      return;
    }

    const isAdminRole = hasAdminRole(userInfo);
    const isSuperAdmin = hasSuperAdminRole(userInfo);
    const hasSites = hasUserSites(userInfo);
    const siteIds = getUserSites(userInfo);

    if (isAdminRole && !isSuperAdmin && siteIds.length === 0) {
      toast({
        title: "Access denied",
        description: "Your admin account has no assigned sites.",
        variant: "destructive",
      });
      return;
    }

    if (preferredPath) {
      const isAdminPath = preferredPath.startsWith("/admin");
      const isDashboardPath = preferredPath.startsWith("/dashboard");
      const canOpenPreferredPath =
        (isAdminPath && isAdminRole) ||
        (isDashboardPath && isAdminRole) ||
        (!isAdminPath && !isDashboardPath);

      if (canOpenPreferredPath) {
        navigate(preferredPath, { replace: true });
        return;
      }

      if (isDashboardPath) {
        if (isAdminRole) {
          navigate("/admin", { replace: true });
          return;
        }
        toast({
          title: "Dashboard unavailable",
          description: "Client dashboard route is being migrated to the new backend.",
          variant: "destructive",
        });
        navigate("/", { replace: true });
        return;
      }
    }

    if (isAdminRole) {
      navigate("/admin", { replace: true });
      return;
    }

    if (hasSites) {
      toast({
        title: "Dashboard unavailable",
        description: "Client dashboard route is being migrated to the new backend.",
        variant: "destructive",
      });
      navigate("/", { replace: true });
      return;
    }

    toast({
      title: "No access",
      description: "Your account is valid, but no role/client access is assigned yet. Contact administrator.",
      variant: "destructive",
    });
  }, [location.pathname, navigate]);

  const resolveUserForRedirect = useCallback(async (fallbackUser: AuthUser): Promise<AuthUser> => {
    try {
      const me = await auth.getMe();
      return me || fallbackUser;
    } catch {
      return fallbackUser;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadMe = async () => {
      try {
        const me = await auth.getMe();
        if (!isMounted || !me) return;

        // On plain /auth open we only auto-redirect admins.
        // Non-admin users stay on auth to avoid noisy "No access" toasts.
        if (!hasAdminRole(me)) return;
        if (!hasSuperAdminRole(me) && getUserSites(me).length === 0) return;

        if (returnTo?.startsWith("/admin")) {
          navigate(returnTo, { replace: true });
          return;
        }

        navigate("/admin", { replace: true });
      } catch {
        // Not authenticated yet
      }
    };

    loadMe();

    return () => {
      isMounted = false;
    };
  }, [navigate, returnTo]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { user } = await auth.register({
          email,
          password,
          name: name.trim() || undefined,
        });

        toast({
          title: "Registration successful!",
          description: "Your account has been created.",
        });

        const resolvedUser = await resolveUserForRedirect(user);
        if (!hasAdminRole(resolvedUser) && !hasUserSites(resolvedUser)) {
          await auth.logout();
          setIsSignUp(false);
          toast({
            title: "Account created",
            description: "Sign in after an administrator grants your role/client access.",
          });
          return;
        }
        await checkRoleAndRedirect(resolvedUser, returnTo);
      } else {
        const { user } = await auth.login({
          email,
          password,
        });

        toast({
          title: "Logged in!",
          description: "Welcome!",
        });

        const resolvedUser = await resolveUserForRedirect(user);
        await checkRoleAndRedirect(resolvedUser, returnTo);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    toast({
      title: "Not available",
      description: "Google sign-in is not configured for the new backend yet.",
      variant: "destructive",
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2"
          onClick={() => navigate("/")}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {isSignUp ? "Sign Up" : "Login"}
          </CardTitle>
          <CardDescription className="text-center">
            {isSignUp 
              ? "Create your account to get started" 
              : "Log in to your dashboard"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : isSignUp ? "Sign Up" : "Login"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button 
            type="button" 
            variant="outline" 
            className="w-full" 
            onClick={handleGoogleAuth}
            disabled={loading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </Button>

          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary hover:underline"
            >
              {isSignUp 
                ? "Already have an account? Login" 
                : "No account? Sign Up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
