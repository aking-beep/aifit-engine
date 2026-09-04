import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border/80">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-medium tracking-tight">
          AI Fit Engine
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/assessment" className="hover:text-foreground">
            Assessment
          </Link>
          <Link href="/methodology" className="hover:text-foreground">
            Methodology
          </Link>
        </nav>
      </div>
    </header>
  );
}
