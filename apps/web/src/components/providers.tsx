"use client";

import Link from 'next/link';
import { LinkProvider, ThemeProvider, ToastProvider, type LinkLike } from '@/design';

const NextLink: LinkLike = ({ href, ...rest }) => <Link href={href} {...rest} />;

/** Theme, toasts, and next/link for every design-system link. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LinkProvider component={NextLink}>
        <ToastProvider>{children}</ToastProvider>
      </LinkProvider>
    </ThemeProvider>
  );
}
