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
      { hostname: "media.nzherald.co.nz" },
      { hostname: "www.nzherald.co.nz" },
      { hostname: "newsroom.co.nz" },
      { hostname: "www.newsroom.co.nz" },
      { hostname: "i0.wp.com" },
      { hostname: "i1.wp.com" },
      { hostname: "i2.wp.com" },
    ],
  },
}

export default nextConfig
