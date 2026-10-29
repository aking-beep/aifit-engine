import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** A plain, on-brand share card: product name, one headline, one line. No photos, no claims beyond the page. */
export function ogCard(product: string, headline: string, line: string) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#08090C", color: "#F4F5F7", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#F4F5F7" }} />
          <div style={{ fontSize: 30, color: "#C9CDD6" }}>{product}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1000 }}>{headline}</div>
          <div style={{ fontSize: 30, color: "#9AA3B2", maxWidth: 980 }}>{line}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#5EEAD4" }}>
          <div>ARC Transformation Group</div>
          <div style={{ color: "#9AA3B2" }}>Free · five minutes · no account needed</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
