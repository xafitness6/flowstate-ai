import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/dashboard.html", destination: "/dashboard" },
      { source: "/onboarding.html", destination: "/onboarding" },
      { source: "/onboarding/calibration.html", destination: "/onboarding/calibration" },
      { source: "/", destination: "/" },
    ];
  },
};

export default nextConfig;
