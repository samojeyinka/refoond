(() => {
  const script = document.currentScript instanceof HTMLScriptElement ? document.currentScript : document.querySelector('script[data-refoond-widget]');
  if (!(script instanceof HTMLScriptElement)) return;

  const scriptUrl = new URL(script.src, window.location.href);
  const publicKey = script.dataset.publicKey || scriptUrl.searchParams.get('publicKey') || '';
  if (publicKey.length < 8 || document.querySelector(`[data-refoond-widget-key="${CSS.escape(publicKey)}"]`)) return;

  const launcherText = script.dataset.launcherText || 'Chat';
  const primaryColor = script.dataset.primaryColor || '#4f46e5';
  const root = document.createElement('div');
  root.dataset.refoondWidgetKey = publicKey;
  root.style.position = 'fixed';
  root.style.right = '20px';
  root.style.bottom = '20px';
  root.style.zIndex = '2147483000';
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.alignItems = 'flex-end';
  root.style.gap = '12px';

  const frame = document.createElement('iframe');
  const frameId = `refoond-widget-frame-${publicKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  frame.id = frameId;
  frame.title = 'Support chat';
  frame.src = `${new URL('widget-preview', scriptUrl).href}?embed=1&publicKey=${encodeURIComponent(publicKey)}`;
  frame.hidden = true;
  frame.loading = 'lazy';
  frame.allow = 'clipboard-write';
  frame.style.width = 'min(400px, calc(100vw - 24px))';
  frame.style.height = 'min(680px, calc(100dvh - 96px))';
  frame.style.border = '1px solid #e4e4e7';
  frame.style.borderRadius = '12px';
  frame.style.background = '#ffffff';
  frame.style.colorScheme = 'light dark';

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.textContent = launcherText;
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', frameId);
  launcher.style.minHeight = '44px';
  launcher.style.padding = '0 18px';
  launcher.style.border = '0';
  launcher.style.borderRadius = '9999px';
  launcher.style.background = primaryColor;
  launcher.style.color = '#ffffff';
  launcher.style.font = '600 14px system-ui, sans-serif';
  launcher.style.cursor = 'pointer';
  launcher.style.boxShadow = 'none';

  const setOpen = (open) => {
    frame.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.textContent = open ? 'Close' : launcherText;
  };

  launcher.addEventListener('click', () => setOpen(frame.hidden));
  root.append(frame, launcher);
  document.body.append(root);
})();
