import Link from "next/link";

const links = [
  { href: "/assessment", label: "Assessment" },
  { href: "/registry", label: "Registry" },
  { href: "/methodology", label: "Methodology" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border/80">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-medium tracking-tight">
          AI Fit Engine
        </Link>
        <nav className="flex flex-wrap justify-end gap-3 text-sm text-muted-foreground">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>Not a personality test, clinical tool, or hiring screen.</p>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/methodology" className="hover:text-foreground">
            Limits
          </Link>
        </div>
      </div>
    </footer>
  );
}
