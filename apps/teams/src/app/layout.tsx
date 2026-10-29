import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import { THEME_BOOT_SCRIPT } from '@/design/Theme';
import { Providers } from '@/components/providers';
import { siteUrl } from '@/lib/site-url';
import './globals.css';

const DESCRIPTION =
  'A defensible assessment of one workload: whether to use AI at all, what to build, what it costs to run, what has to be true before it ships.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'AI Fit Teams — should you build this?',
  description: DESCRIPTION,
  openGraph: { title: 'AI Fit Teams — should you build this?', description: DESCRIPTION, siteName: 'AI Fit Teams', type: 'website', url: '/' },
  twitter: { card: 'summary_large_image', title: 'AI Fit Teams — should you build this?', description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:text-label-md focus:text-on-accent"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
