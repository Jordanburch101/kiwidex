/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/db"],
  images: {
    remotePatterns: [
      { hostname: "www.rnz.co.nz" },
      { hostname: "media.rnz.co.nz" },
      { hostname: "media.rnztools.nz" },
      { hostname: "www.stuff.co.nz" },
      { hostname: "resources.stuff.co.nz" },
    ],
  },
}

export default nextConfig
