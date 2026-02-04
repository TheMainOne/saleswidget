import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FullScreenChatWidget from '@/components/FullScreenChatWidget';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fetchPublicWidgetConfig, mapWidgetSettings, type WidgetClientSettings } from '@/lib/widget-config';

interface ClientConfig {
  id: string;
  siteId: string;
  name: string;
  settings: WidgetClientSettings;
}

const ClientDemo = () => {
  const { clientSlug } = useParams<{ clientSlug: string }>();
  const navigate = useNavigate();
  const [clientConfig, setClientConfig] = useState<ClientConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadClientConfig = async () => {
      if (!clientSlug) {
        setError('Client slug is missing');
        setIsLoading(false);
        return;
      }

      try {
        console.log('Loading client:', clientSlug);
        const list = await apiFetch<{ clients?: any[] }>('/api/clients?page=1&limit=200');
        const target = (list?.clients || []).find((item) => item?.slug === clientSlug);

        if (!target) {
          throw new Error('Client not found');
        }

        if (target?.isActive === false || target?.is_active === false) {
          setError('This client demo is currently inactive');
          setIsLoading(false);
          return;
        }

        const clientId = String(target?._id || target?.id || "");
        const siteId = String(target?.siteId || target?.site_id || target?.slug || clientSlug);

        let widgetConfig: any = {};
        try {
          const configPayload = await apiFetch<{ config?: any }>(
            `/api/clients/${clientId}/widget-config`,
          );
          widgetConfig = configPayload?.config || {};
        } catch {
          const fallback = await fetchPublicWidgetConfig(siteId);
          widgetConfig = fallback.settings;
        }

        setClientConfig({
          id: clientId,
          siteId,
          name: target?.name || clientSlug,
          settings: mapWidgetSettings(widgetConfig),
        });
      } catch (err) {
        try {
          const fallback = await fetchPublicWidgetConfig(clientSlug);
          setClientConfig({
            id: fallback.clientId || clientSlug,
            siteId: fallback.siteId,
            name: clientSlug,
            settings: fallback.settings,
          });
          setError(null);
        } catch {
          console.error('Error loading client config:', err);
          setError('Failed to load client configuration');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadClientConfig();
  }, [clientSlug, navigate]);

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0f0f0f' }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#ffffff' }} />
      </div>
    );
  }

  if (error || !clientConfig) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0f0f0f' }}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#ffffff' }}>
            Error
          </h1>
          <p style={{ color: '#999999' }}>
            {error || 'Client not found'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background">
      <FullScreenChatWidget
        clientId={clientConfig.id}
        siteId={clientConfig.siteId}
        clientSettings={clientConfig.settings}
      />
    </div>
  );
};

export default ClientDemo;
