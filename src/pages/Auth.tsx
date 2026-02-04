import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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

const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is unavailable."));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`,
    );

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }
      if (existingScript.dataset.failed === "true") {
        reject(new Error("Failed to load Google Sign-In script."));
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Sign-In script.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.dataset.failed = "true";
      reject(new Error("Failed to load Google Sign-In script."));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    googleScriptPromise = null;
    throw error;
  });

  return googleScriptPromise;
}

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleInitError, setGoogleInitError] = useState<string | null>(null);
  const [googleInitializing, setGoogleInitializing] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
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

  const handleGoogleCredential = useCallback(async (response: GoogleCredentialResponse) => {
    const idToken = response?.credential;
    if (!idToken) {
      toast({
        title: "Google login failed",
        description: "Google did not return an ID token.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { user } = await auth.loginWithGoogle({ idToken });

      toast({
        title: "Logged in!",
        description: "Welcome!",
      });

      const resolvedUser = await resolveUserForRedirect(user);
      await checkRoleAndRedirect(resolvedUser, returnTo);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [checkRoleAndRedirect, resolveUserForRedirect, returnTo]);

  const initializeGoogleSignIn = useCallback(async (): Promise<boolean> => {
    if (!googleClientId) {
      setGoogleInitError("Set VITE_GOOGLE_CLIENT_ID in .env to enable Google login.");
      return false;
    }

    if (typeof window === "undefined") return false;

    setGoogleInitializing(true);
    setGoogleInitError(null);

    try {
      await loadGoogleIdentityScript();

      if (!window.google?.accounts?.id) {
        throw new Error("Google Sign-In library is not available.");
      }

      const container = googleButtonRef.current;
      if (!container) {
        throw new Error("Google button container is missing.");
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          void handleGoogleCredential(response);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true,
      });

      container.innerHTML = "";
      const buttonWidth = Math.max(220, Math.min(380, Math.floor(container.clientWidth || 320)));
      window.google.accounts.id.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: buttonWidth,
        logo_alignment: "left",
      });

      return true;
    } catch (error: any) {
      setGoogleInitError(error?.message || "Unable to initialize Google sign-in.");
      return false;
    } finally {
      setGoogleInitializing(false);
    }
  }, [googleClientId, handleGoogleCredential]);

  const handleGoogleAuthRetry = async () => {
    const ready = await initializeGoogleSignIn();
    if (!ready) {
      toast({
        title: "Google login unavailable",
        description: "Check Google client ID and browser security settings.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initGoogle = async () => {
      const ready = await initializeGoogleSignIn();
      if (!isMounted || ready || googleClientId) return;
      // Keep missing-client-id warning visible for local configuration.
      setGoogleInitError("Set VITE_GOOGLE_CLIENT_ID in .env to enable Google login.");
    };

    void initGoogle();

    return () => {
      isMounted = false;
    };
  }, [googleClientId, initializeGoogleSignIn]);

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

          <div className="space-y-2">
            <div className={loading ? "pointer-events-none opacity-70" : ""}>
              <div ref={googleButtonRef} className="min-h-10 w-full flex justify-center" />
            </div>

            {googleInitializing && (
              <p className="text-center text-xs text-muted-foreground">Preparing Google sign-in...</p>
            )}

            {googleInitError && (
              <p className="text-center text-xs text-destructive">{googleInitError}</p>
            )}

            {googleInitError && googleClientId && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleAuthRetry}
                disabled={loading || googleInitializing}
              >
                Retry Google setup
              </Button>
            )}
          </div>

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
