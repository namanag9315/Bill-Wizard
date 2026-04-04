'use client';

import { Download } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

type AppShellProps = {
  sidebar: ReactNode;
  mobileTabs: ReactNode;
  children: ReactNode;
  showInstallButton?: boolean;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function AppShell({
  sidebar,
  mobileTabs,
  children,
  showInstallButton = false
}: AppShellProps) {
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installHint, setInstallHint] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const detectStandalone = () => {
      const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      setIsStandalone(mediaQuery.matches || iosStandalone);
    };

    detectStandalone();

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsMobileBrowser(/android|iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setIsStandalone(true);
      setInstallHint('BillWizard installed successfully.');
      window.setTimeout(() => setInstallHint(null), 2200);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener('change', detectStandalone);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', detectStandalone);
    };
  }, []);

  const canShowInstallAction = showInstallButton && isMobileBrowser && !isStandalone;

  const installButtonLabel = useMemo(() => {
    if (!deferredInstallPrompt) return 'Install App';
    return installing ? 'Installing...' : 'Install App';
  }, [deferredInstallPrompt, installing]);

  const handleInstallClick = useCallback(async () => {
    if (installing) return;

    if (!deferredInstallPrompt) {
      const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
      setInstallHint(
        isIos
          ? 'On iPhone/iPad: tap Share and choose "Add to Home Screen".'
          : 'Use your browser menu and choose "Install app".'
      );
      window.setTimeout(() => setInstallHint(null), 3200);
      return;
    }

    setInstalling(true);
    try {
      await deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
    } finally {
      setInstalling(false);
      setDeferredInstallPrompt(null);
    }
  }, [deferredInstallPrompt, installing]);

  return (
    <div className="flex h-dvh w-full bg-canvas">
      <div className="hidden h-dvh w-[210px] shrink-0 md:block">{sidebar}</div>
      <main className="flex-1 overflow-y-auto bg-canvas pb-16 md:pb-0">{children}</main>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden">{mobileTabs}</div>

      {canShowInstallAction ? (
        <div className="fixed bottom-[126px] right-[14px] z-[70] md:hidden">
          <button
            type="button"
            onClick={() => {
              void handleInstallClick();
            }}
            className="inline-flex h-[32px] items-center gap-[6px] rounded-pill border border-border bg-white px-[10px] text-[11px] font-medium text-[#1C1917] shadow-sm transition-[background-color] duration-150 ease-linear hover:bg-dim disabled:cursor-not-allowed disabled:opacity-70"
            disabled={installing}
          >
            <Download className="h-[11px] w-[11px]" />
            {installButtonLabel}
          </button>
        </div>
      ) : null}

      {installHint ? (
        <div className="fixed bottom-[170px] right-[14px] z-[70] max-w-[240px] rounded-input border border-border bg-white px-[10px] py-[7px] text-[11px] text-[#1C1917] shadow-sm md:hidden">
          {installHint}
        </div>
      ) : null}
    </div>
  );
}
