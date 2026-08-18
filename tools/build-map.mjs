// 지역별 배경/테두리를 통일하고, 실제로 화면에 칠해지는 가장 큰 땅덩어리
// 안에만 핀 마커를 배치해 public/images/korea-region-map.svg를 만든다.
//
// <canvas> 2D에 지역마다 고유 색을 칠해 실제로 래스터라이즈된 픽셀을
// 그대로 읽는다 — 이게 사용자 화면에 보이는 것과 일치하는 판정이다.
//
// ★ 핵심 함정: 이 원본 SVG는 17개 지역 중 16개에
//   transform="translate(106.95522,19.462687)" 가 걸려 있고 sejong만 없다.
//   따라서 points 속성의 raw 좌표 != 화면에 실제로 그려지는 위치다.
//   (이걸 놓쳐서 핀이 전부 왼쪽 위로 약 107,19 만큼 밀려 찍혔고, 검증
//   스크립트도 똑같이 transform을 무시해 "정상"이라고 잘못 보고했다.)
//   그래서 래스터라이즈할 때 각 지역의 transform을 그대로 적용하고,
//   그 결과로 얻은 좌표(=최종 화면 좌표계)에 핀을 직접 찍는다. 핀은
//   <svg> 직계 자식이라 transform이 없으므로 이 좌표가 곧 정답이다.
import fs from "node:fs";
import { chromium } from "playwright-core";

const SRC =
  "c:\\Users\\jaejin\\.codex\\.chatgpt-projects\\g-p-6a588145e1b481919791107bce5bf190\\car-master-local\\public\\images\\Map_of_South_Korea-blank.svg";
const OUT =
  "c:\\Users\\jaejin\\.codex\\.chatgpt-projects\\g-p-6a588145e1b481919791107bce5bf190\\car-master-local\\public\\images\\korea-region-map.svg";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const DENSITY = {
  seoul: 8,
  incheon: 4,
  gyeonggi: 8,
  busan: 3,
  daegu: 2,
  gwangju: 2,
  daejeon: 2,
  ulsan: 2,
  sejong: 1,
  gangwon: 2,
  chungbuk: 2,
  chungnam: 2,
  jeonbuk: 2,
  jeonnam: 2,
  gyeongbuk: 2,
  gyeongnam: 3,
  jeju: 2,
};

let raw = fs.readFileSync(SRC, "utf8");

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.setContent(`<!DOCTYPE html><html><body>${raw}<canvas id="cv"></canvas></body></html>`);

const dotResult = await page.evaluate((DENSITY) => {
  const SCALE = 3; // 3배 해상도로 래스터라이즈 (2400x3600) — 촘촘한 판정용
  const W = 800 * SCALE;
  const H = 1200 * SCALE;
  const canvas = document.getElementById("cv");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, W, H);

  const ids = Object.keys(DENSITY);

  // 지역에 걸린 translate(tx,ty)를 읽어온다 (없으면 0,0).
  function translateOf(el) {
    const t = el.getAttribute("transform");
    if (!t) return [0, 0];
    const m = t.match(/translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)/);
    return m ? [Number(m[1]), Number(m[2])] : [0, 0];
  }

  // ★ 한 캔버스에 17개 지역을 한꺼번에 그리면 안 된다. 광주는 전남 폴리곤
  //   "안"에 들어있는 enclave라, 나중에 그린 전남이 광주를 통째로 덮어버려
  //   광주 픽셀이 0개가 된다(실제로 광주가 fallback 처리됐다). 세종/대전도
  //   같은 위험이 있다. 그래서 지역마다 캔버스를 비우고 그 지역 하나만
  //   그린 뒤 판정한다.
  function drawOnly(el) {
    ctx.clearRect(0, 0, W, H);
    const tag = el.tagName.toLowerCase();
    const [tx, ty] = translateOf(el);
    ctx.fillStyle = "#ffffff";
    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.translate(tx, ty); // ← 실제 렌더링과 동일한 좌표 변환
    if (tag === "polyline" || tag === "polygon") {
      const nums = el.getAttribute("points").match(/-?\d+\.?\d*/g).map(Number);
      ctx.beginPath();
      ctx.moveTo(nums[0], nums[1]);
      for (let i = 2; i < nums.length - 1; i += 2) ctx.lineTo(nums[i], nums[i + 1]);
      ctx.closePath();
      ctx.fill();
    } else if (tag === "path") {
      ctx.fill(new Path2D(el.getAttribute("d")));
    }
    ctx.restore();
  }

  function farthestPointSample(candidates, count) {
    if (candidates.length <= count) return candidates;
    const chosen = [candidates[Math.floor(candidates.length / 2)]];
    while (chosen.length < count) {
      let best = null;
      let bestDist = -1;
      for (const c of candidates) {
        const minDist = Math.min(...chosen.map(([cx, cy]) => (c[0] - cx) ** 2 + (c[1] - cy) ** 2));
        if (minDist > bestDist) {
          bestDist = minDist;
          best = c;
        }
      }
      chosen.push(best);
    }
    return chosen;
  }

  const out = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    drawOnly(el);
    // getBBox()는 요소 자신의 transform 적용 "전" 좌표계를 준다 — 위에서
    // 캔버스에 그릴 때 translate를 적용했으므로 여기서도 더해줘야 한다.
    const bboxRaw = el.getBBox();
    const [tx, ty] = translateOf(el);
    const bbox = { x: bboxRaw.x + tx, y: bboxRaw.y + ty, width: bboxRaw.width, height: bboxRaw.height };
    const minPX = Math.max(0, Math.floor(bbox.x * SCALE) - 2);
    const minPY = Math.max(0, Math.floor(bbox.y * SCALE) - 2);
    const maxPX = Math.min(W - 1, Math.ceil((bbox.x + bbox.width) * SCALE) + 2);
    const maxPY = Math.min(H - 1, Math.ceil((bbox.y + bbox.height) * SCALE) + 2);

    // 이 지역 bbox 범위만 읽는다 (전체 캔버스보다 훨씬 빠르다).
    const bw = maxPX - minPX + 1;
    const bh = maxPY - minPY + 1;
    const imgData = ctx.getImageData(minPX, minPY, bw, bh).data;
    function isLandPx(px, py) {
      const lx = px - minPX;
      const ly = py - minPY;
      if (lx < 0 || ly < 0 || lx >= bw || ly >= bh) return false;
      return imgData[(ly * bw + lx) * 4 + 3] > 0; // alpha
    }

    // 지역 크기에 맞춘 샘플링 간격 (픽셀 단위) — 너무 촘촘하면 느리다.
    const step = Math.max(1, Math.round(Math.min(maxPX - minPX, maxPY - minPY) / 220));
    const cols = Math.floor((maxPX - minPX) / step) + 1;
    const rows = Math.floor((maxPY - minPY) / step) + 1;

    const inside = new Uint8Array(cols * rows);
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const px = minPX + cx * step;
        const py = minPY + cy * step;
        if (isLandPx(px, py)) inside[cy * cols + cx] = 1;
      }
    }

    // flood-fill로 연결 요소 찾기 (4방향, 실제 픽셀 인접 기준이라 다리
    // 방향에 의한 오판이 없다 — 픽셀 자체가 진짜 안 이어지면 절대 안 이어짐)
    const compId = new Int32Array(cols * rows).fill(-1);
    const compSize = [];
    for (let start = 0; start < cols * rows; start++) {
      if (!inside[start] || compId[start] !== -1) continue;
      const id2 = compSize.length;
      let size = 0;
      const stack = [start];
      compId[start] = id2;
      while (stack.length) {
        const p = stack.pop();
        size++;
        const px2 = p % cols;
        const py2 = (p - px2) / cols;
        for (const [nx, ny] of [
          [px2 + 1, py2],
          [px2 - 1, py2],
          [px2, py2 + 1],
          [px2, py2 - 1],
        ]) {
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const np = ny * cols + nx;
          if (inside[np] && compId[np] === -1) {
            compId[np] = id2;
            stack.push(np);
          }
        }
      }
      compSize.push(size);
    }

    if (compSize.length === 0) {
      out[id] = { dots: [[(bbox.x + bbox.width / 2), (bbox.y + bbox.height / 2)]], note: "fallback" };
      continue;
    }
    let bestComp = 0;
    for (let i = 1; i < compSize.length; i++) if (compSize[i] > compSize[bestComp]) bestComp = i;

    // 가장 큰 덩어리 안에서, 사방 clearance(맵 단위) 반경이 전부 육지인
    // "해안선에서 충분히 떨어진" 점만 후보로 남긴다. 이게 없으면 핀이
    // 해안 끄트머리에 걸쳐 바다 위에 뜬 것처럼 보인다(제주 서쪽 끝에서
    // 실제로 그렇게 보였다). 넉넉한 값부터 시도해 후보가 안 나오면 줄인다.
    const clearances = [7, 5, 3, 1.5, 0];
    let pool = [];
    let usedClearance = 0;
    for (const clearance of clearances) {
      const rPx = clearance * SCALE;
      const found = [];
      for (let idx = 0; idx < cols * rows; idx++) {
        if (compId[idx] !== bestComp) continue;
        const px2 = idx % cols;
        const py2 = (idx - px2) / cols;
        const absX = minPX + px2 * step;
        const absY = minPY + py2 * step;
        let ok = true;
        if (rPx > 0) {
          for (let a = 0; a < 12 && ok; a++) {
            const th = (2 * Math.PI * a) / 12;
            if (!isLandPx(Math.round(absX + Math.cos(th) * rPx), Math.round(absY + Math.sin(th) * rPx))) {
              ok = false;
            }
          }
        }
        if (ok) found.push([absX / SCALE, absY / SCALE]);
      }
      if (found.length > 0) {
        pool = found;
        usedClearance = clearance;
        break;
      }
    }
    out[id] = {
      dots: farthestPointSample(pool, DENSITY[id]),
      note: `mainCompPx=${compSize[bestComp]}/${compSize.reduce((a, b) => a + b, 0)} step=${step} clearance=${usedClearance}`,
    };
  }
  return out;
}, DENSITY);

await browser.close();

let totalDots = 0;
for (const [id, r] of Object.entries(dotResult)) {
  totalDots += r.dots.length;
  console.log(id.padEnd(10), r.dots.length + "개", r.note || "");
}
console.log("총 점 개수:", totalDots);

fs.writeFileSync(
  "C:\\Users\\jaejin\\AppData\\Local\\Temp\\claude\\c--Users-jaejin--codex--chatgpt-projects-g-p-6a588145e1b481919791107bce5bf190-car-master-local\\075ac999-ff92-4014-85eb-0e9b445350dc\\scratchpad\\dots.json",
  JSON.stringify(Object.fromEntries(Object.entries(dotResult).map(([id, r]) => [id, { dots: r.dots }])), null, 2),
);

function pinMarkup(x, y) {
  const R = 9;
  const headCy = y - R * 1.8;
  const baseY = headCy + R * 0.72;
  const baseHalfW = R * 0.62;
  return (
    `<ellipse cx="${x.toFixed(2)}" cy="${(y + 1).toFixed(2)}" rx="${(R * 0.85).toFixed(2)}" ry="${(R * 0.32).toFixed(2)}" fill="rgba(15,23,42,0.16)" />` +
    `<polygon points="${(x - baseHalfW).toFixed(2)},${baseY.toFixed(2)} ${(x + baseHalfW).toFixed(2)},${baseY.toFixed(2)} ${x.toFixed(2)},${y.toFixed(2)}" fill="var(--color-primary)" />` +
    `<circle cx="${x.toFixed(2)}" cy="${headCy.toFixed(2)}" r="${R.toFixed(2)}" fill="var(--color-primary)" stroke="#fff" stroke-width="0.8" />` +
    `<circle cx="${x.toFixed(2)}" cy="${headCy.toFixed(2)}" r="${(R * 0.4).toFixed(2)}" fill="#fff" />`
  );
}

const pins = [];
for (const { dots } of Object.values(dotResult)) {
  for (const [x, y] of dots) pins.push(pinMarkup(x, y));
}

raw = raw.replace(/<\?xml[^>]*\?>\s*/, "");
raw = raw.replace(/<!--[\s\S]*?-->\s*/, "");
raw = raw.replace(/<metadata[\s\S]*?<\/metadata>\s*/, "");
raw = raw.replace(/<sodipodi:namedview[\s\S]*?<\/sodipodi:namedview>\s*/, "");
raw = raw.replace(/<defs[^>]*>[\s\S]*?<\/defs>\s*/, "");
raw = raw.replace(/\s+inkscape:connector-curvature="[^"]*"/g, "");

raw = raw.replace(
  /<svg[^>]*>/,
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true" class="korea-region-map">',
);

for (const id of Object.keys(DENSITY)) {
  const marker = `id="${id}"`;
  const idx = raw.indexOf(marker);
  const tagStart = raw.lastIndexOf("<", idx);
  const closeIdx = raw.indexOf("/>", idx);
  const before = raw.slice(0, tagStart);
  const element = raw.slice(tagStart, closeIdx + 2);
  const after = raw.slice(closeIdx + 2);
  const newElement = element.replace(
    /style="[^"]*"/,
    'style="fill:var(--color-line);stroke:#ffffff;stroke-width:2;stroke-linejoin:round"',
  );
  raw = before + newElement + after;
}

raw = raw.replaceAll("<polyline", "<polygon");
raw = raw.replace("</svg>", `${pins.join("")}</svg>`);

fs.writeFileSync(OUT, raw, "utf8");
console.log("작성 완료:", OUT, "크기:", (fs.statSync(OUT).size / 1024).toFixed(1) + "KB");
