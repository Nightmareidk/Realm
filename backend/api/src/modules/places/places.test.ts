import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  browser,
  createTestApp,
  newAccount,
  sessionCookie,
  type TestContext,
} from "../../test/helpers";

let t: TestContext;
const realFetch = globalThis.fetch;
let asked: string[] = [];
let answer: () => Response = () => new Response("{}");

beforeAll(async () => {
  t = await createTestApp();
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith("https://photon.komoot.io/")) return realFetch(input, init);
    asked.push(url);
    return answer();
  }) as typeof fetch;
});
afterEach(() => {
  asked = [];
});
afterAll(async () => {
  globalThis.fetch = realFetch;
  await t.close();
});

let ip = 0;
async function person() {
  const res = await t.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    headers: browser(),
    payload: newAccount(),
    remoteAddress: `10.62.${Math.floor(++ip / 250)}.${ip % 250}`,
  });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("no session");
  return cookie;
}
const get = (cookie: string | undefined, url: string) =>
  t.app.inject({ method: "GET", url: `/v1${url}`, headers: browser(cookie) });

const feature = (props: Record<string, unknown>, lng: number, lat: number) => ({
  type: "Feature",
  properties: props,
  geometry: { type: "Point", coordinates: [lng, lat] },
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("place search", () => {
  it("needs a signed-in person", async () => {
    expect((await get(undefined, "/places/search?q=moda")).statusCode).toBe(401);
  });

  it("finds places with a readable address, near the person, and keeps the answer", async () => {
    const cookie = await person();
    answer = () =>
      json({
        features: [
          feature(
            {
              osm_type: "N",
              osm_id: 1,
              osm_value: "cafe",
              name: "Moda Kahve",
              street: "Moda Caddesi",
              housenumber: "12",
              district: "Caferağa",
              city: "Kadıköy",
              state: "İstanbul",
              country: "Türkiye",
            },
            29.025,
            40.982,
          ),
          feature({ osm_type: "N", osm_id: 2 }, 0, 0),
        ],
      });
    const res = await get(cookie, "/places/search?q=moda%20kahve&lat=40.98765&lng=29.02345");
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([
      {
        id: "osm:N1",
        name: "Moda Kahve",
        address: "Moda Caddesi 12, Caferağa, Kadıköy, İstanbul, Türkiye",
        lat: 40.982,
        lng: 29.025,
      },
    ]);
    // Only a rough spot (about 1 km) leaves Realm, and no account or IP of theirs.
    expect(asked[0]).toContain("lat=40.99");
    expect(asked[0]).toContain("lon=29.02");

    const again = await get(cookie, "/places/search?q=moda%20kahve&lat=40.98765&lng=29.02345");
    expect(again.json().items).toHaveLength(1);
    expect(asked).toHaveLength(1);
  });

  it("keeps to towns and cities when asked", async () => {
    const cookie = await person();
    answer = () =>
      json({
        features: [
          feature(
            { osm_type: "R", osm_id: 3, osm_value: "city", name: "İzmir", country: "Türkiye" },
            27.1,
            38.4,
          ),
          feature(
            { osm_type: "R", osm_id: 4, osm_value: "suburb", name: "İzmirli", country: "Türkiye" },
            35,
            38,
          ),
        ],
      });
    const res = await get(cookie, "/places/search?q=izmir&cities=1");
    expect(res.json().items.map((p: { name: string }) => p.name)).toEqual(["İzmir"]);
    expect(asked[0]).toContain("osm_tag=place");
  });

  it("names a tapped point but keeps the pin where it was put", async () => {
    const cookie = await person();
    answer = () =>
      json({
        features: [
          feature(
            { osm_type: "W", osm_id: 5, name: "Galata Kulesi", city: "Beyoğlu" },
            28.9741,
            41.0256,
          ),
        ],
      });
    const res = await get(cookie, "/places/at?lat=41.02571&lng=28.97402");
    expect(res.json().place).toMatchObject({ name: "Galata Kulesi", lat: 41.02571, lng: 28.97402 });
  });

  it("says busy, and waits a minute, when the service is overloaded", async () => {
    const cookie = await person();
    answer = () => new Response("slow down", { status: 429 });
    const first = await get(cookie, "/places/search?q=kadikoy%20iskele");
    expect(first.statusCode).toBe(503);
    expect(first.json().error.code).toBe("SERVICE_UNAVAILABLE");
    const second = await get(cookie, "/places/search?q=besiktas%20iskele");
    expect(second.statusCode).toBe(503);
    expect(asked).toHaveLength(1);
    await t.deps.kv.del("places:backoff");
  });

  it("refuses odd input", async () => {
    const cookie = await person();
    expect((await get(cookie, "/places/search?q=a")).statusCode).toBe(400);
    expect((await get(cookie, "/places/at?lat=200&lng=0")).statusCode).toBe(400);
  });
});
