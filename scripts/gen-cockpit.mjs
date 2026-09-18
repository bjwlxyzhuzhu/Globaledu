// 用 APIMart gpt-image-2（异步任务）生成驾驶舱实景背景图，存 public/cockpit-bg.png。
// 运行： node --env-file=.env.local scripts/gen-cockpit.mjs
import { writeFileSync } from "node:fs";
import { setGlobalDispatcher, ProxyAgent } from "undici";

const proxy = process.env.DEV_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) { setGlobalDispatcher(new ProxyAgent(proxy)); console.log("[proxy]", proxy); }
const BASE = process.env.APIMART_BASE_URL;
const H = { Authorization: "Bearer " + process.env.APIMART_API_KEY, "Content-Type": "application/json" };
const MODEL = "gpt-image-2";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROMPT =
  "Wide eye-level view of a futuristic spaceship operations deck / command bridge interior, OPEN and spacious. " +
  "A row of several individual low workstations and glowing holographic console tables arranged across an open floor, NO tall high-back chairs, nothing blocking the view, you can see the whole deck clearly. " +
  "Large panoramic windshield at the back showing a cyan and violet hyperspace star-streak tunnel. Dark interior with blue and purple neon HUD light, sleek sci-fi, cinematic, ultra detailed, atmospheric. " +
  "NO people, NO characters, NO text, NO words, NO logo.";

async function submit(prompt, size) {
  const r = await fetch(BASE + "/images/generations", { method: "POST", headers: H, body: JSON.stringify({ model: MODEL, prompt, size, n: 1 }) });
  const j = await r.json();
  const id = j?.data?.[0]?.task_id || j?.task_id;
  if (!id) throw new Error("提交失败：" + JSON.stringify(j).slice(0, 240));
  return id;
}
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
    try { o = (await fetch(BASE + "/tasks/" + id, { headers: H }).then((x) => x.json()))?.data || {}; }
    catch (e) { console.log("网络抖动重试", (e.message || "").slice(0, 40)); await sleep(5000); continue; }
    const st = String(o.status || "").toLowerCase();
    console.log("  ", id.slice(0, 14), st, (o.progress ?? "") + "%");
    const img = findImage(o);
    if (img && (st === "succeeded" || st === "success" || st === "completed" || st === "done" || o.progress === 100)) return { img, raw: o };
    if (st === "failed" || st === "error" || st === "cancelled") throw new Error("任务失败：" + JSON.stringify(o).slice(0, 240));
    await sleep(5000);
  }
  throw new Error("轮询超时");
}

console.log("→ 生成 cockpit-bg.png");
let id;
try { id = await submit(PROMPT, "1536x1024"); }
catch (e) { console.log("1536x1024 失败，改 1024x1024：", e.message.slice(0, 80)); id = await submit(PROMPT, "1024x1024"); }
const { img, raw } = await poll(id);
const buf = img.url ? Buffer.from(await fetch(img.url).then((x) => x.arrayBuffer())) : Buffer.from(img.b64, "base64");
if (!buf || buf.length < 2000) throw new Error("图片异常：" + JSON.stringify(raw).slice(0, 240));
writeFileSync(new URL("../public/cockpit-bg.png", import.meta.url), buf);
console.log("✓ 已存 public/cockpit-bg.png", (buf.length / 1024).toFixed(0) + "KB");
