import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Uploads são montados como volume em produção e não devem ser copiados para o standalone.
  outputFileTracingExcludes: {
    "/*": ["./extras/**/*", "./public/uploads/**/*"],
  },
};

export default nextConfig;
