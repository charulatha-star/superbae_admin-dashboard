import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    When the dev server is accessed through a non-localhost hostname (e.g. over
    the LAN via http://192.168.0.145:3000), Next.js 16 blocks cross-origin
    requests to dev-only assets (the client JS bundle) by default. That prevents
    React from hydrating, so onClick handlers / the password toggle stop working
    and submitting the form does a native page reload instead of an API call.
    These origins are whitelisted so the app works on localhost and on the LAN.
  */
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.0.145',
    '*.local',
  ],
};

export default nextConfig;
