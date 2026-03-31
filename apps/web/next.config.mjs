/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@workspace/ui", "@workspace/db"],
  images: {
    remotePatterns: [
      { hostname: "www.rnz.co.nz" },
      { hostname: "media.rnz.co.nz" },
      { hostname: "media.rnztools.nz" },
      { hostname: "www.stuff.co.nz" },
      { hostname: "resources.stuff.co.nz" },
      { hostname: "media.nzherald.co.nz" },
      { hostname: "www.nzherald.co.nz" },
      { hostname: "www.1news.co.nz" },
      { hostname: "images.1news.co.nz" },
    ],
  },
};

export default nextConfig;
