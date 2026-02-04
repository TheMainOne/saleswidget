import React, { useState, useEffect } from 'react';
import FullScreenChatWidget from './FullScreenChatWidget';
import { Loader2 } from 'lucide-react';
import { fetchPublicWidgetConfig, type WidgetClientSettings } from '@/lib/widget-config';

interface ClientConfig {
  id: string;
  siteId: string;
  name: string;
  settings: WidgetClientSettings;
}

const FullWidthDemo = () => {
  const [clientConfig, setClientConfig] = useState<ClientConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClientConfig = async () => {
      try {
        const resolved = await fetchPublicWidgetConfig('widget');
        setClientConfig({
          id: resolved.clientId || 'widget',
          siteId: resolved.siteId,
          name: 'widget',
          settings: resolved.settings,
        });
      } catch (err) {
        console.error('Error fetching client config:', err);
        setError('Failed to load widget configuration');
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientConfig();
  }, []);

  if (isLoading) {
    return (
      <section id="demo-section" className="w-full bg-gradient-to-b from-background to-cream py-12 sm:py-16">
        <div className="container mx-auto max-w-7xl px-4 mb-10 sm:px-6 sm:mb-12">
          <div className="text-center space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
              Play With the Widget
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto">
              Ask about pricing, bundles, FAQs — the AI answers from your docs and can generate quotes.
            </p>
          </div>
        </div>
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 flex justify-center items-center h-[420px] sm:h-[600px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (error || !clientConfig) {
    return (
      <section id="demo-section" className="w-full bg-gradient-to-b from-background to-cream py-12 sm:py-16">
        <div className="container mx-auto max-w-7xl px-4 mb-10 sm:px-6 sm:mb-12">
          <div className="text-center space-y-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
              Play With the Widget
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto">
              Ask about pricing, bundles, FAQs — the AI answers from your docs and can generate quotes.
            </p>
          </div>
        </div>
        <div className="container mx-auto max-w-5xl px-4 sm:px-6">
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-destructive">{error || 'Failed to load widget'}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="demo-section" className="w-full bg-gradient-to-b from-background to-cream py-12 sm:py-16">
      <div className="container mx-auto max-w-7xl px-4 mb-10 sm:px-6 sm:mb-12">
        <div className="text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
            Play With the Widget
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto">
            Ask about pricing, bundles, FAQs — the AI answers from your docs and can generate quotes.
          </p>
        </div>
      </div>

      {/* Full Screen Chat Widget with Primary Business settings */}
      <div className="mx-auto w-full px-4 sm:w-[80%] sm:px-6 lg:w-[60%]">
        <FullScreenChatWidget 
          clientId={clientConfig.id}
          siteId={clientConfig.siteId}
          clientSettings={clientConfig.settings}
        />
      </div>

      {/* Note under widget */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 mt-8">
        <p className="text-center text-muted-foreground">
          This is a live AI-powered demo. Want it on your site?{" "}
          <span className="font-semibold text-purple-accent">Install in 1 line.</span>
        </p>
      </div>
    </section>
  );
};

export default FullWidthDemo;
