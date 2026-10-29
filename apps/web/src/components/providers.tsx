"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { track } from "@vercel/analytics";
import {
  AdPixels, AttributionCapture, ConsentBanner, LinkProvider, ThemeProvider, ToastProvider, anyPixel, registerTracker, validPixels, type LinkLike,
} from "@/design";

const NextLink: LinkLike = ({ href, ...rest }) => <Link href={href} {...rest} />;

const PIXELS = validPixels({
  meta: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  gtag: process.env.NEXT_PUBLIC_GTAG_ID,
  linkedin: process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID,
});

/** Conversion events go to Vercel Web Analytics (cookieless). Pixels get them only after consent. */
function Tracking() {
  useEffect(() => registerTracker((event, props) => track(event, props)), []);
  return null;
}

/** Theme, toasts, next/link for every design-system link, analytics and attribution. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LinkProvider component={NextLink}>
        <ToastProvider>{children}</ToastProvider>
      </LinkProvider>
      <AttributionCapture />
      <Tracking />
      <Analytics />
      <AdPixels ids={PIXELS} />
      <ConsentBanner needed={anyPixel(PIXELS)} />
    </ThemeProvider>
  );
}
