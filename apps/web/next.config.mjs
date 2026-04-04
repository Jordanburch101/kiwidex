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
      { hostname: "**.guim.co.uk" },
      { hostname: "**.edairynews.com" },
      { hostname: "**.i-scmp.com" },
      { hostname: "**.abc-cdn.net.au" },
      { hostname: "**.bbci.co.uk" },
    ],
  },
};

export default nextConfig;
