import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Kiwidex",
    short_name: "Kiwidex",
    description: "Live New Zealand economic indicators dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#2a2520",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
