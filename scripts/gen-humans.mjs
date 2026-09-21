// 用平台 APIMart 的图像模型生成两个数字人配图：小闯（水系/蓝/男）、小创（火系/橙/女）。
// APIMart 的 gpt-image-2 为异步任务：POST /images/generations → task_id → 轮询 GET /tasks/{id}。
// 运行： node --env-file=.env.local scripts/gen-humans.mjs
import { writeFileSync, existsSync } from "node:fs";
import { setGlobalDispatcher, ProxyAgent } from "undici";

const proxy = process.env.DEV_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) { setGlobalDispatcher(new ProxyAgent(proxy)); console.log("[proxy]", proxy); }

const BASE = process.env.APIMART_BASE_URL;
const H = { Authorization: "Bearer " + process.env.APIMART_API_KEY, "Content-Type": "application/json" };
const MODEL = "gpt-image-2";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STYLE =
  "cute chibi cartoon mascot, friendly AI guide astronaut character, clean thick-line vector illustration, " +
  "soft neon glow, big expressive friendly eyes, glassmorphism sci-fi, centered bust portrait, deep-space starfield background, high quality, app mascot, consistent matching-pair character design";

const JOBS = [
  { file: "human-water.png", prompt:
    "A CALM young MALE astronaut AI guide mascot. Cool, composed, confident and steady expression. " +
    "Sleek CYAN and BLUE spacesuit and space helmet with a clear glass visor. Glowing ice-blue WATER energy aura, gentle wave and droplet motifs. " + STYLE },
  { file: "human-fire.png", prompt:
    "A PASSIONATE young FEMALE astronaut AI guide mascot. Warm, enthusiastic, energetic bright smile, feminine face and visible hairstyle. " +
    "Sleek ORANGE, RED and AMBER spacesuit and space helmet with a clear glass visor. Glowing FIRE energy aura, flame and spark motifs. " + STYLE },
];

async function submit(prompt) {
  const r = await fetch(BASE + "/images/generations", {
    method: "POST", headers: H,
    body: JSON.stringify({ model: MODEL, prompt, size: "1024x1024", n: 1 }),
  });
  const j = await r.json();
  const id = j?.data?.[0]?.task_id || j?.task_id;
  if (!id) throw new Error("提交失败：" + JSON.stringify(j).slice(0, 200));
  return id;
}

// 递归在结果对象里找图片 url 或 b64
function findImage(o) {
  let url = null, b64 = null;
  (function walk(v) {
    if (url || b64 || v == null) return;
    if (typeof v === "string") {
      if (/^https?:\/\/\S+/i.test(v) && /(\.(png|jpe?g|webp)|image|img|file|oss|cos|cdn|blob|amazonaws|aliyun)/i.test(v)) url = v;
      else if (/^data:image\//.test(v)) b64 = v.split(",")[1];
      else if (v.length > 500 && /^[A-Za-z0-9+/=\s]+$/.test(v)) b64 = v.replace(/\s+/g, "");
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object") Object.values(v).forEach(walk);
  })(o);
  return url ? { url } : b64 ? { b64 } : null;
}

async function poll(id) {
  for (let i = 0; i < 80; i++) {
    let o;
    try {
      const r = await fetch(BASE + "/tasks/" + id, { headers: H });
      o = (await r.json())?.data || {};
    } catch (e) {
      process.stdout.write(`\n  网络抖动，重试：${(e.message || "").slice(0, 40)}\n`);
      await sleep(5000);
      continue;
    }
    const st = String(o.status || "").toLowerCase();
    process.stdout.write(`\r  ${id.slice(0, 14)} ${st} ${o.progress ?? ""}%      `);
    const img = findImage(o);
    if (img && (st === "succeeded" || st === "success" || st === "completed" || st === "done" || o.progress === 100)) {
      process.stdout.write("\n");
      return { img, raw: o };
    }
    if (st === "failed" || st === "error" || st === "cancelled") throw new Error("任务失败：" + JSON.stringify(o).slice(0, 240));
    await sleep(5000);
  }
  throw new Error("轮询超时");
}

for (const j of JOBS) {
  const out = new URL("../public/" + j.file, import.meta.url);
  if (existsSync(out)) { console.log("↷ 跳过已存在", j.file); continue; }
  console.log("→ 生成", j.file);
  const id = await submit(j.prompt);
  const { img, raw } = await poll(id);
  let buf;
  if (img.url) {
    console.log("  url:", img.url.slice(0, 90));
    buf = Buffer.from(await fetch(img.url).then((x) => x.arrayBuffer()));
  } else {
    buf = Buffer.from(img.b64, "base64");
  }
  if (!buf || buf.length < 2000) throw new Error("图片异常，原始结果：" + JSON.stringify(raw).slice(0, 240));
  writeFileSync(new URL("../public/" + j.file, import.meta.url), buf);
  console.log("  ✓ 已存", j.file, (buf.length / 1024).toFixed(0) + "KB");
}
console.log("完成");
