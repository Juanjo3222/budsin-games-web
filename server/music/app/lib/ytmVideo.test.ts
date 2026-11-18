import { describe, expect, test } from "bun:test";
import { parseVideoRows, pickOfficialVideo, type VideoRow } from "./ytmVideo";

const row = (o: Partial<VideoRow>): VideoRow => ({ id: "x", title: "T", artist: "A", type: "MUSIC_VIDEO_TYPE_OMV", duration: 200, ...o });

describe("pickOfficialVideo", () => {
  test("takes the official music video of the same song and artist", () => {
    const rows = [
      row({ id: "ugc", title: "Never Gonna Give You Up (Music Box)", artist: "R3 Music Box", type: "MUSIC_VIDEO_TYPE_UGC" }),
      row({ id: "omv", title: "Never Gonna Give You Up", artist: "Rick Astley", duration: 214 }),
    ];
    expect(pickOfficialVideo(rows, "Never Gonna Give You Up", "Rick Astley", 213)?.id).toBe("omv");
  });
  test("ignores fan uploads and concert recordings", () => {
    const rows = [row({ id: "bbc", title: "Never Gonna Give You Up", artist: "Rick Astley", type: "MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC" })];
    expect(pickOfficialVideo(rows, "Never Gonna Give You Up", "Rick Astley")).toBeNull();
  });
  test("another version of the song is not the song", () => {
    const rows = [row({ id: "live", title: "Creep (Live)", artist: "Radiohead" })];
    expect(pickOfficialVideo(rows, "Creep", "Radiohead")).toBeNull();
    expect(pickOfficialVideo(rows, "Creep (Live)", "Radiohead")?.id).toBe("live");
  });
  test("another artist's video of a song with the same name is not it", () => {
    const rows = [row({ id: "o", title: "Believer", artist: "Imagine Dragons" })];
    expect(pickOfficialVideo(rows, "Believer", "Kendrick Lamar")).toBeNull();
  });
  test("a collaboration matches on any of its artists", () => {
    const rows = [row({ id: "c", title: "Industry Baby", artist: "Lil Nas X" })];
    expect(pickOfficialVideo(rows, "Industry Baby", "Lil Nas X, Jack Harlow")?.id).toBe("c");
  });
  test("a cut of a very different length is rejected", () => {
    const rows = [row({ id: "long", title: "Song", artist: "Band", duration: 3600 })];
    expect(pickOfficialVideo(rows, "Song", "Band", 200)).toBeNull();
  });
});

describe("parseVideoRows", () => {
  test("reads id, type, artist and runtime from innertube rows", () => {
    const json = { a: [{ musicResponsiveListItemRenderer: { flexColumns: [
      { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Song", navigationEndpoint: { watchEndpoint: { videoId: "abc", watchEndpointMusicSupportedConfigs: { watchEndpointMusicConfig: { musicVideoType: "MUSIC_VIDEO_TYPE_OMV" } } } } }] } } },
      { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: "Band - Topic" }, { text: " • " }, { text: "1.8B views" }, { text: " • " }, { text: "3:34" }] } } },
    ] } }] };
    expect(parseVideoRows(json)).toEqual([{ id: "abc", title: "Song", artist: "Band", type: "MUSIC_VIDEO_TYPE_OMV", duration: 214 }]);
  });
  test("tolerates junk", () => {
    expect(parseVideoRows(null)).toEqual([]);
    expect(parseVideoRows({ musicResponsiveListItemRenderer: {} })).toEqual([]);
  });
});
