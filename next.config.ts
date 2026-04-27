import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/short-form-video/settings/visuals-style",
        destination: "/short-form-video/settings/images#image-styles",
        permanent: false,
      },
      {
        source: "/short-form-video/settings/sound-design",
        destination: "/short-form-video/settings/sound-library",
        permanent: false,
      },
      {
        source: "/short-form-video/:id/visuals",
        destination: "/short-form-video/:id/generate-visuals",
        permanent: false,
      },
      {
        source: "/short-form-video/:id/sound-design",
        destination: "/short-form-video/:id/plan-sound-design",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
