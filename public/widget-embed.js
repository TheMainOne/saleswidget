(function() {
  const config = window.salesWidgetConfig || {};
  const siteId = config.apiKey || config.siteId;
  
  if (!siteId) {
    console.error('SalesWidget: siteId is required in window.salesWidgetConfig');
    return;
  }

  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  let scriptOrigin = window.location.origin;
  try {
    scriptOrigin = new URL(currentScript?.src || "", window.location.href).origin;
  } catch {
    // Keep current origin fallback.
  }
  
  // Create iframe with widget
  const iframe = document.createElement('iframe');
  iframe.src = `${scriptOrigin}/widget-embed/${encodeURIComponent(siteId)}`;
  iframe.style.cssText = 'position:fixed;top:6px;left:6px;width:calc(100vw - 12px);height:calc(100vh - 12px);border:none;z-index:9999;';
  iframe.setAttribute('allow', 'clipboard-write');
  
  // Insert into DOM after page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(iframe);
    });
  } else {
    document.body.appendChild(iframe);
  }
  
  // Handle messages from iframe (optional)
  window.addEventListener('message', (event) => {
    // Add origin validation if needed
    // if (event.origin !== 'https://yourdomain.com') return;
    
    // Handle widget events
    if (event.data.type === 'widget-resize') {
      iframe.style.height = event.data.height + 'px';
    }
  });
})();
