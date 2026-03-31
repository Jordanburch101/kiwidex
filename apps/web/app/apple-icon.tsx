import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#faf8f3",
        borderRadius: 36,
      }}
    >
      <span
        style={{
          fontSize: 120,
          fontWeight: 700,
          color: "#2a2520",
          fontFamily: "Georgia, serif",
        }}
      >
        K
      </span>
    </div>,
    { ...size }
  );
}
