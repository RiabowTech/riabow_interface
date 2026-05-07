/** Figma MCP exports (node 156:2400) — local SVGs, not expiring remote URLs */
export const refFigmaAsset = {
  line2: new URL("./assets/line2.svg", import.meta.url).href,
  line3: new URL("./assets/line3.svg", import.meta.url).href,
  line5: new URL("./assets/line5.svg", import.meta.url).href,
  line7: new URL("./assets/line7.svg", import.meta.url).href,
  line8: new URL("./assets/line8.svg", import.meta.url).href,
  checkMuted: new URL("./assets/union12.svg", import.meta.url).href,
  checkAccent: new URL("./assets/union13.svg", import.meta.url).href,
  share: new URL("./assets/share.svg", import.meta.url).href,
} as const;
