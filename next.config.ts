import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/wholesale-orders": ["src/lib/assets/hotta-order-template.xlsx"],
  },
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
