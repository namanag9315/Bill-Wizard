import { ReactNode } from 'react';

type AppShellProps = {
  sidebar: ReactNode;
  mobileTabs: ReactNode;
  children: ReactNode;
};

export default function AppShell({ sidebar, mobileTabs, children }: AppShellProps) {
  return (
    <div className="flex h-dvh w-full bg-canvas">
      <div className="hidden h-dvh w-[210px] shrink-0 md:block">{sidebar}</div>
      <main className="flex-1 overflow-y-auto bg-canvas pb-16 md:pb-0">{children}</main>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden">{mobileTabs}</div>
    </div>
  );
}

