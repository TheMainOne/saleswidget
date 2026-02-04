import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check, ArrowDown } from "lucide-react";
import LandingChat from "@/components/LandingChat";

const Index = () => {
  const navigate = useNavigate();
  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  const [isPastHero, setIsPastHero] = useState(false);
  const chatSectionRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const heroHeight = window.innerHeight * 0.8;
      
      // Hide header on scroll down
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setHeaderVisible(false);
      } else {
        setHeaderVisible(true);
      }
      
      // Track if user scrolled past hero section
      setIsPastHero(currentScrollY > heroHeight);
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const scrollToChat = () => {
    chatSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Cyberpunk gradient glow */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% -10%, hsl(328 100% 54% / 0.15), transparent 70%), radial-gradient(ellipse 40% 30% at 80% 20%, hsl(195 100% 50% / 0.08), transparent)',
        }}
      />

      {/* Header - hidden in fullscreen mode and on mobile after hero */}
      {!isChatFullscreen && !(isMobile && isPastHero) && (
        <header
          className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
            headerVisible ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <div className="flex justify-end p-4 sm:p-6 safe-area-top">
            <Button
              variant="ghost"
              onClick={() => navigate("/auth")}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/50 text-sm font-normal rounded-full px-4"
            >
              Sign in / Sign up
            </Button>
          </div>
        </header>
      )}

      {/* Screen 1 - Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-16 sm:pt-0 relative z-10">
        <div className="max-w-3xl mx-auto text-center space-y-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/50 text-sm text-muted-foreground">
            <span className="w-2 h-2 bg-status-online rounded-full" />
            AI-powered sales widget
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
            Turn your website into
            <br />
            <span className="text-primary">
              a sales assistant
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            An AI widget that answers questions, qualifies leads, and collects contacts — directly in the chat.
          </p>

          {/* Bullets */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span>Answers from your docs</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span>Qualifies visitors</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span>No forms needed</span>
            </div>
          </div>

          {/* CTA */}
          <div className="pt-6 space-y-4">
            <Button
              size="lg"
              onClick={scrollToChat}
              className="px-10 py-7 text-base font-semibold transition-all duration-300 hover:scale-[1.02] bg-primary text-primary-foreground hover:bg-primary/90"
              style={{
                boxShadow: '0 0 60px -10px hsl(328 100% 54% / 0.7), 0 0 20px -5px hsl(328 100% 54% / 0.5)'
              }}
            >
              Get started free
            </Button>
            <p className="text-sm text-muted-foreground">
              Start the chat — we'll ask for your contact inside
            </p>
          </div>

          {/* Secondary info */}
          <div className="pt-6 flex flex-col items-center gap-3 text-xs text-muted-foreground/70">
            <span>No credit card required</span>
            <button 
              onClick={scrollToChat}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
            >
              Live demo below 
              <ArrowDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Screen 2 - Live Chat */}
      <section 
        ref={chatSectionRef}
        className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-16 relative z-10"
      >
        <div className="w-full max-w-4xl mx-auto space-y-8">
          {/* Section header */}
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-semibold text-foreground">
              Start a conversation
            </h2>
            <p className="text-muted-foreground">
              Ask anything — the AI will answer and guide you.
            </p>
          </div>

          {/* Chat widget */}
          <div className="w-full">
            <LandingChat onFullscreenChange={setIsChatFullscreen} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
