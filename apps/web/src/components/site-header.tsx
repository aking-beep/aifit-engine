"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReadingLevelToggle } from "@/components/reading-level";

const links = [
  { href: "/assessment", label: "Try it" },
  { href: "/methodology", label: "How it works" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border/80 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          Fit
          <span className="text-primary">.</span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ReadingLevelToggle />
          <nav aria-label="Primary" className="flex flex-wrap justify-end gap-3 text-sm text-muted-foreground">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={active ? "text-foreground font-medium" : "hover:text-foreground"}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>Free, anonymous, and for anyone. Delete your session anytime.</p>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/methodology" className="hover:text-foreground">
            How it works
          </Link>
          <a
            href="https://github.com/aking-beep/aifit-engine"
            className="hover:text-foreground"
            rel="noreferrer"
            target="_blank"
          >
            Source
          </a>
        </div>
      </div>
    </footer>
  );
}
