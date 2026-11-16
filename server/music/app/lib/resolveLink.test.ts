import { expect, test } from "bun:test";
import { cleanSpotifyTitle, cleanYoutubeTitle, parseLink } from "./resolveLink";

test("parseLink understands Spotify and YouTube links and normalises them", () => {
  expect(parseLink("https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC?si=abc")).toEqual({
    provider: "spotify", url: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", kind: "track",
  });
  expect(parseLink("https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3")?.kind).toBe("album");
  expect(parseLink("https://youtu.be/dQw4w9WgXcQ?t=3")?.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  expect(parseLink("https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=x")?.provider).toBe("youtube");
  expect(parseLink("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.kind).toBe("video");
});

test("parseLink refuses anything outside the host list (no SSRF) and malformed input", () => {
  for (const bad of [
    "http://127.0.0.1:3103/api/music/track", "https://evil.com/watch?v=dQw4w9WgXcQ",
    "https://open.spotify.com.evil.com/track/4uLU6hMCjMI75M1A2tKUQC", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
    "file:///etc/passwd", "javascript:alert(1)", "hola mundo", "https://www.youtube.com/watch?v=corto", "https://open.spotify.com/user/xyz",
  ])
    expect(parseLink(bad)).toBeNull();
});

test("cleanYoutubeTitle drops the noise", () => {
  expect(cleanYoutubeTitle("Rick Astley - Never Gonna Give You Up (Official Video) [4K Remaster]")).toBe("Rick Astley - Never Gonna Give You Up");
  expect(cleanYoutubeTitle("Kendrick Lamar - Not Like Us | Official Audio")).toBe("Kendrick Lamar - Not Like Us");
  expect(cleanYoutubeTitle("Song (feat. Someone)")).toBe("Song (feat. Someone)");
});

test("cleanSpotifyTitle strips the page furniture", () => {
  expect(cleanSpotifyTitle("Listen to Emotion (Deluxe) - Album by Carly Rae Jepsen | Spotify")).toBe("Emotion (Deluxe)");
  expect(cleanSpotifyTitle("Never Gonna Give You Up")).toBe("Never Gonna Give You Up");
  expect(cleanSpotifyTitle("Blinding Lights - song and lyrics by The Weeknd | Spotify")).toBe("Blinding Lights");
});
