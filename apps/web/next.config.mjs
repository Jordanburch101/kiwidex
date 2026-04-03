/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@workspace/ui", "@workspace/db"],
  images: {
    remotePatterns: [
      { hostname: "**.rnz.co.nz" },
      { hostname: "**.rnztools.nz" },
      { hostname: "**.stuff.co.nz" },
      { hostname: "**.nzherald.co.nz" },
      { hostname: "**.1news.co.nz" },
      { hostname: "**.tvnz.co.nz" },
      { hostname: "**.cloudfront.net" },
      { hostname: "**.wp.com" },
      { hostname: "**.newsroom.co.nz" },
      { hostname: "**.interest.co.nz" },
    ],
  },
};

export default nextConfig;
