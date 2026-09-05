import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Development only. The dev server refuses requests for its own scripts and
   * hot-reload endpoints from any origin but the one it was started on, so a
   * phone on the same Wi-Fi opening http://192.168.x.x:3000 receives the HTML
   * but none of the JavaScript — every button is inert. Private network ranges
   * are allowed here so on-device testing works; production is unaffected.
   */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],

  /**
   * resvg ships a native binding per platform and picks it at runtime; bundling
   * it breaks that lookup ("could not resolve @resvg/resvg-js-darwin-x64").
   * Leaving it external lets Node load the binding the way the package expects.
   */
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
