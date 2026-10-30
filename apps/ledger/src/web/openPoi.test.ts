import { describe, expect, test } from "vite-plus/test";
import { distance, poisFromResponse, searchUrl } from "./openPoi.ts";

const paramsOf = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe("searchUrl", () => {
  test("中心と半径は経度・緯度の順で送る", () => {
    const url = searchUrl("", { center: { lng: 139.767, lat: 35.681 }, radius: 300.4 }, 50);
    expect(url.startsWith("https://api.openpoiapi.com/v1/search?")).toBe(true);
    expect(paramsOf(url)).toEqual({ center: "139.767,35.681", radius: "300", limit: "50" });
  });

  test("キーワードは前後の空白を落として送る", () => {
    const url = searchUrl(" コンビニ ", { center: { lng: 139, lat: 35 }, radius: 500 }, 10);
    expect(paramsOf(url).q).toBe("コンビニ");
  });

  test("表示範囲は API が受け付ける範囲に収めて送る", () => {
    const url = searchUrl(
      "",
      { bbox: { minLng: -200, minLat: -89, maxLng: 139.8, maxLat: 35.7 } },
      50,
    );
    expect(paramsOf(url).bbox).toBe("-180,-85,139.8,35.7");
  });
});

describe("poisFromResponse", () => {
  test("文字列の座標も読み、業種がなければカテゴリを使う", () => {
    const pois = poisFromResponse({
      count: 2,
      results: [
        {
          name: "テスト食堂",
          address: "東京都千代田区丸の内1-1",
          business_type: "飲食店営業",
          category: "restaurant",
          lat: "35.68",
          lng: "139.76",
        },
        { name: "テスト商店", address: "", category: "shop", lat: 35.1, lng: 139.1 },
      ],
    });
    expect(pois).toEqual([
      {
        name: "テスト食堂",
        kind: "飲食店営業",
        address: "東京都千代田区丸の内1-1",
        position: { lng: 139.76, lat: 35.68 },
      },
      { name: "テスト商店", kind: "shop", address: "", position: { lng: 139.1, lat: 35.1 } },
    ]);
  });

  test("座標や名前のない施設は地図に置けないので除く", () => {
    const pois = poisFromResponse({
      results: [
        { name: "座標なし", lat: "", lng: "" },
        { name: "", lat: 35, lng: 139 },
      ],
    });
    expect(pois).toEqual([]);
  });

  test("思わぬ形の応答なら空にする", () => {
    expect(poisFromResponse(null)).toEqual([]);
    expect(poisFromResponse({ results: "x" })).toEqual([]);
  });
});

describe("distance", () => {
  test("東京駅から皇居（約 1.2km）までの距離を測る", () => {
    const meters = distance({ lng: 139.7671, lat: 35.6812 }, { lng: 139.7528, lat: 35.6852 });
    expect(meters).toBeGreaterThan(1200);
    expect(meters).toBeLessThan(1500);
  });
});
