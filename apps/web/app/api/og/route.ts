import sharp from "sharp";
import { getOgMetrics } from "@/lib/og-data";

export async function GET() {
  const metrics = await getOgMetrics();

  const today = new Date().toLocaleDateString("en-NZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const metricCells = metrics
    .map((m, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 100 + col * 340;
      const y = 300 + row * 120;
      const borderRight =
        col < 2
          ? `<line x1="${x + 300}" y1="${y - 20}" x2="${x + 300}" y2="${y + 80}" stroke="#e5e0d5" stroke-width="1"/>`
          : "";
      const borderBottom =
        row === 0
          ? `<line x1="${x - 40}" y1="${y + 90}" x2="${x + 300}" y2="${y + 90}" stroke="#e5e0d5" stroke-width="1"/>`
          : "";
      return `
      <text x="${x + 130}" y="${y + 10}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#999" letter-spacing="2">${escapeXml(m.label.toUpperCase())}</text>
      <text x="${x + 130}" y="${y + 58}" text-anchor="middle" font-family="Georgia, serif" font-size="34" font-weight="700" fill="#2a2520">${escapeXml(m.value)}</text>
      ${borderRight}
      ${borderBottom}`;
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#faf8f3"/>
  <rect x="56" y="48" width="1088" height="3" fill="#2a2520"/>
  <text x="600" y="100" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="400" fill="#999" letter-spacing="4">THE NEW ZEALAND ECONOMY</text>
  <text x="600" y="175" text-anchor="middle" font-family="Georgia, serif" font-size="64" font-weight="700" fill="#2a2520">The Kiwidex</text>
  <text x="600" y="225" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" fill="#999">${escapeXml(today)}</text>
  ${metricCells}
  <rect x="56" y="565" width="1088" height="2" fill="#2a2520"/>
  <text x="600" y="600" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" fill="#999">kiwidex.co.nz</text>
</svg>`;

  const png = await sharp(Buffer.from(svg)).resize(1200, 630).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
