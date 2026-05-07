import { describe, it, expect } from "vitest";
import { pickVideoRoute, VIDEO_ROUTE_DIRECT, VIDEO_ROUTE_SCREENSHOT } from "./video-route.js";

describe("pickVideoRoute", () => {
  it("routes YouTube watch pages to direct frame extraction", () => {
    expect(pickVideoRoute("https://www.youtube.com/watch?v=abc")).toBe(VIDEO_ROUTE_DIRECT);
    expect(pickVideoRoute("https://m.youtube.com/watch?v=abc")).toBe(VIDEO_ROUTE_DIRECT);
    expect(pickVideoRoute("https://youtube.com/shorts/abc")).toBe(VIDEO_ROUTE_DIRECT);
  });

  it("routes youtu.be short links to direct frame extraction", () => {
    expect(pickVideoRoute("https://youtu.be/abc")).toBe(VIDEO_ROUTE_DIRECT);
    expect(pickVideoRoute("https://www.youtu.be/abc")).toBe(VIDEO_ROUTE_DIRECT);
  });

  it("routes Twitter / X to screenshot fallback", () => {
    expect(pickVideoRoute("https://twitter.com/user/status/1")).toBe(VIDEO_ROUTE_SCREENSHOT);
    expect(pickVideoRoute("https://www.twitter.com/user/status/1")).toBe(VIDEO_ROUTE_SCREENSHOT);
    expect(pickVideoRoute("https://x.com/user/status/1")).toBe(VIDEO_ROUTE_SCREENSHOT);
    expect(pickVideoRoute("https://www.x.com/user/status/1")).toBe(VIDEO_ROUTE_SCREENSHOT);
  });

  it("routes Bilibili variants to screenshot fallback", () => {
    expect(pickVideoRoute("https://www.bilibili.com/video/BV1")).toBe(VIDEO_ROUTE_SCREENSHOT);
    expect(pickVideoRoute("https://m.bilibili.com/video/BV1")).toBe(VIDEO_ROUTE_SCREENSHOT);
    expect(pickVideoRoute("https://upos-sz-mirrorcoso1.bilivideo.com/abc.mp4")).toBe(VIDEO_ROUTE_SCREENSHOT);
  });

  it("routes TikTok to screenshot fallback", () => {
    expect(pickVideoRoute("https://www.tiktok.com/@user/video/123")).toBe(VIDEO_ROUTE_SCREENSHOT);
    expect(pickVideoRoute("https://tiktok.com/@user/video/123")).toBe(VIDEO_ROUTE_SCREENSHOT);
  });

  it("falls back to direct for unknown hosts", () => {
    expect(pickVideoRoute("https://example.com/video")).toBe(VIDEO_ROUTE_DIRECT);
    expect(pickVideoRoute("https://vimeo.com/12345")).toBe(VIDEO_ROUTE_DIRECT);
  });

  it("returns direct for invalid or empty input rather than throwing", () => {
    expect(pickVideoRoute("")).toBe(VIDEO_ROUTE_DIRECT);
    expect(pickVideoRoute(undefined)).toBe(VIDEO_ROUTE_DIRECT);
    expect(pickVideoRoute(null)).toBe(VIDEO_ROUTE_DIRECT);
    expect(pickVideoRoute("not a url")).toBe(VIDEO_ROUTE_DIRECT);
    expect(pickVideoRoute(42)).toBe(VIDEO_ROUTE_DIRECT);
  });

  it("does not match similar-looking but unrelated hosts", () => {
    expect(pickVideoRoute("https://notyoutube.com/video")).toBe(VIDEO_ROUTE_DIRECT);
    expect(pickVideoRoute("https://faketwitter.com/x")).toBe(VIDEO_ROUTE_DIRECT);
    expect(pickVideoRoute("https://bilibili.org/x")).toBe(VIDEO_ROUTE_DIRECT);
  });
});
