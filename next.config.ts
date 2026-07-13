import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/wholesale-orders": ["src/lib/assets/hotta-order-template.xlsx"],
    "/api/account/orders/receipt": ["src/lib/assets/fonts/*.ttf"],
  },
  serverExternalPackages: ["exceljs", "subset-font"],
};

export default nextConfig;
