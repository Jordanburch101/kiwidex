import { ImageResponse } from "next/og";
import { getOgMetrics } from "@/lib/og-data";

export const alt = "The Kiwidex — New Zealand Economy Dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const metrics = await getOgMetrics();

  // Fetch fonts for Satori (next/og requires raw font data)
  const [playfairData, notoData400, notoData600] = await Promise.all([
    fetch(
      "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.ttf"
    ).then((res) => res.arrayBuffer()),
    fetch(
      "https://fonts.gstatic.com/s/notosans/v42/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99d.ttf"
    ).then((res) => res.arrayBuffer()),
    fetch(
      "https://fonts.gstatic.com/s/notosans/v42/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyAjBN9d.ttf"
    ).then((res) => res.arrayBuffer()),
  ]);

  const today = new Date().toLocaleDateString("en-NZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#faf8f3",
        padding: "48px 56px",
        fontFamily: "Noto Sans",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          borderBottom: "3px solid #2a2520",
          paddingBottom: 20,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: "#998",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          The New Zealand Economy
        </span>
        <span
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#2a2520",
            fontFamily: "Playfair Display",
            marginTop: 4,
          }}
        >
          The Kiwidex
        </span>
        <span
          style={{
            fontSize: 14,
            color: "#998",
            marginTop: 8,
          }}
        >
          {today}
        </span>
      </div>

      {/* Metric Grid: 2 rows x 3 cols */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          marginTop: 32,
          gap: 0,
          flex: 1,
        }}
      >
        {metrics.map((metric, i) => (
          <div
            key={metric.label}
            style={{
              width: "33.33%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 16px",
              borderBottom: i < 3 ? "1px solid #e5e0d5" : "none",
              borderRight: (i + 1) % 3 === 0 ? "none" : "1px solid #e5e0d5",
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "#998",
                textTransform: "uppercase",
                letterSpacing: "0.15em",
                fontWeight: 600,
              }}
            >
              {metric.label}
            </span>
            <span
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: "#2a2520",
                fontFamily: "Playfair Display",
                marginTop: 8,
              }}
            >
              {metric.value}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          borderTop: "2px solid #2a2520",
          paddingTop: 16,
        }}
      >
        <span style={{ fontSize: 14, color: "#998" }}>kiwidex.co.nz</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Playfair Display",
          data: playfairData,
          weight: 700,
          style: "normal",
        },
        {
          name: "Noto Sans",
          data: notoData400,
          weight: 400,
          style: "normal",
        },
        {
          name: "Noto Sans",
          data: notoData600,
          weight: 600,
          style: "normal",
        },
      ],
    }
  );
}
