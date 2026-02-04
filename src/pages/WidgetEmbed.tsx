import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import FullScreenChatWidget from '@/components/FullScreenChatWidget';
import { Loader2 } from 'lucide-react';
import { fetchPublicWidgetConfig, type WidgetClientSettings } from '@/lib/widget-config';

const WidgetEmbed = () => {
  const { apiKey } = useParams<{ apiKey: string }>();
  const [clientConfig, setClientConfig] = useState<{
    id: string;
    siteId: string;
    settings: WidgetClientSettings;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      if (!apiKey) {
        setIsLoading(false);
        return;
      }

      try {
        // NOTE: `apiKey` route param is kept for backward compatibility,
        // but the backend now resolves widget config by siteId.
        const resolved = await fetchPublicWidgetConfig(apiKey);
        setClientConfig({
          id: resolved.clientId || apiKey,
          siteId: resolved.siteId,
          settings: resolved.settings,
        });
      } catch (err) {
        console.error('Error loading config:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [apiKey]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-transparent">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!clientConfig) {
    return null;
  }

  return (
    <div className="h-screen w-screen">
      <FullScreenChatWidget
        clientId={clientConfig.id}
        siteId={clientConfig.siteId}
        clientSettings={clientConfig.settings}
      />
    </div>
  );
};

export default WidgetEmbed;
