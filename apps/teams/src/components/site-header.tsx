'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo, ThemeToggle, arcUtm, cn, trackConversion, withUtm } from '@/design';
import { ARC_LINKS } from '@/lib/arc';

const BOOKING = withUtm(ARC_LINKS.booking, arcUtm('ai-fit-teams', 'header', null));

/**
 * Public header. The current route is marked for assistive technology and
 * visibly. ARC Control is a separate product: an ordinary link out.
 */
export function SiteHeader({ controlUrl, account }: { controlUrl: string; account: 'workspace' | 'signin' | null }) {
  const pathname = usePathname() ?? '/';
  const items = [
    { href: '/assess', label: 'New assessment' },
    { href: '/methodology', label: 'Methodology' },
    { href: '/#pricing', label: 'Pricing' },
    ...(account === 'workspace' ? [{ href: '/workspace', label: 'Workspace' }] : account === 'signin' ? [{ href: '/signin', label: 'Sign in' }] : []),
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
        <Link href="/" className="inline-flex min-h-10 items-center rounded-sm">
          <Logo product="Teams" />
        </Link>
        <nav aria-label="Main" className="-mx-2 flex-1">
          <ul className="flex flex-wrap items-center gap-x-1">
            {items.map((item) => {
              const current = !item.href.includes('#') && (pathname === item.href || pathname.startsWith(`${item.href}/`));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'inline-flex min-h-10 items-center border-b-2 px-2 text-label-md transition-colors',
                      current ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <a
                href={BOOKING}
                target="_blank"
                rel="noopener"
                onClick={() => trackConversion('booking_clicked', { app: 'ai-fit-teams', placement: 'header' })}
                className="inline-flex min-h-10 items-center border-b-2 border-transparent px-2 text-label-md text-accent hover:underline"
              >
                Talk to ARC
              </a>
            </li>
            <li>
              <a href={controlUrl} className="inline-flex min-h-10 items-center border-b-2 border-transparent px-2 text-label-md text-fg-muted hover:text-fg">
                ARC Control
              </a>
            </li>
          </ul>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
