import type { MetadataRoute } from "next";

// Web app manifest — lets the site install to a phone home screen as a
// standalone, full-screen app ("Add to Home Screen").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flowstate AI",
    short_name: "Flowstate",
    description: "Your performance operating system.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    orientation: "portrait",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
