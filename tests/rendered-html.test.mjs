import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Car-Master loading state and landing content", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Car-Master \| 차량 시공 거래를 하나의 흐름으로<\/title>/i);
  assert.match(html, /aria-label="카마스터 불러오는 중"/);
  assert.match(html, /카마스터 워크스페이스를 불러오고 있습니다/);
  assert.match(html, /가격 확인부터 시공 완료까지/);
  assert.match(html, /카마스터 시작하기/);
});

test("keeps the loading state in the route-level loading component", async () => {
  const [loading, page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(loading, /system-state-page/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /카마스터 워크스페이스를 불러오고 있습니다/);
  assert.match(page, /<LandingPage/);
  assert.match(layout, /Car-Master \| 차량 시공 거래를 하나의 흐름으로/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview/);
});
