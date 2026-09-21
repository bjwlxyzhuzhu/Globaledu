// 用 APIMart gpt-image-2 生成 6 个「萌系动物球体」搭子头像，存 public/crew/{key}.png。
// 运行： node --env-file=.env.local scripts/gen-crew.mjs
// 幂等：已存在且 >2KB 的文件跳过，失败可重跑续生成。
import { writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { setGlobalDispatcher, ProxyAgent } from "undici";

const proxy = process.env.DEV_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) { setGlobalDispatcher(new ProxyAgent(proxy)); console.log("[proxy]", proxy); }
const BASE = process.env.APIMART_BASE_URL;
const H = { Authorization: "Bearer " + process.env.APIMART_API_KEY, "Content-Type": "application/json" };
const MODEL = "gpt-image-2";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const outDir = new URL("../public/crew/", import.meta.url);
try { mkdirSync(outDir, { recursive: true }); } catch {}

// 统一风格：圆滚滚的萌系吉祥物球体，大眼睛，科幻霓虹描边，深底（即使不透明也能融进深色舱内）
const STYLE =
  "adorable kawaii chibi mascot character shaped like a round glossy sphere ball, big sparkly eyes, " +
  "soft chubby cheeks, friendly smile, cute, 3d render, smooth studio lighting, subtle sci-fi neon rim light, " +
  "centered single character, plain solid dark navy background #0A0E22, no text, no words, no logo.";

const DEFS = [
  { key: "boss",     animal: "giant panda wearing a tiny kung-fu headband, confident wise leader vibe" },
  { key: "mentor",   animal: "majestic tiger with a calm authoritative look, king-of-the-mountain vibe" },
  { key: "industry", animal: "fierce but cute wolf, determined go-getter, ready-to-charge vibe" },
  { key: "teacher",  animal: "loyal friendly shiba-like dog, warm dependable vibe" },
  { key: "student",  animal: "agile energetic leopard cub, quick and clever sparkly vibe" },
  { key: "advisor",  animal: "sturdy hardworking ox/bull, steady diligent down-to-earth vibe" },
  { key: "strategy", animal: "noble eagle with sharp far-seeing visionary eyes, strategist vibe" },
  { key: "design",   animal: "beautiful elegant cat with stylish charming graceful designer vibe" },
];

async function submit(prompt, size) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(BASE + "/images/generations", { method: "POST", headers: H, body: JSON.stringify({ model: MODEL, prompt, size, n: 1, background: "transparent" }) });
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { j = {}; }
    const id = j?.data?.[0]?.task_id || j?.task_id;
    if (id) return id;
    if (/wait|later|rate|limit|503|busy/i.test(t)) { console.log("  限流，等 20s 重试…"); await sleep(20000); continue; }
    throw new Error("提交失败：" + t.slice(0, 200));
  }
  throw new Error("提交重试耗尽");
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
    catch (e) { console.log("  网络抖动重试", (e.message || "").slice(0, 40)); await sleep(5000); continue; }
    const st = String(o.status || "").toLowerCase();
    const img = findImage(o);
    if (img && (st === "succeeded" || st === "success" || st === "completed" || st === "done" || o.progress === 100)) return img;
    if (st === "failed" || st === "error" || st === "cancelled") throw new Error("任务失败：" + JSON.stringify(o).slice(0, 200));
    await sleep(5000);
  }
  throw new Error("轮询超时");
}

for (const d of DEFS) {
  const file = new URL(d.key + ".png", outDir);
  if (existsSync(file) && statSync(file).size > 2000) { console.log("跳过(已存在)", d.key); continue; }
  console.log("→ 生成", d.key, d.animal.slice(0, 28));
  const prompt = d.animal + ", " + STYLE;
  try {
    let id; try { id = await submit(prompt, "1024x1024"); } catch (e) { console.log("  重试 submit:", e.message.slice(0, 60)); await sleep(8000); id = await submit(prompt, "1024x1024"); }
    const img = await poll(id);
    const buf = img.url ? Buffer.from(await fetch(img.url).then((x) => x.arrayBuffer())) : Buffer.from(img.b64, "base64");
    if (!buf || buf.length < 2000) throw new Error("图片异常");
    writeFileSync(file, buf);
    console.log("  ✓", d.key, (buf.length / 1024).toFixed(0) + "KB");
  } catch (e) { console.log("  ✗", d.key, "失败：", (e.message || "").slice(0, 80)); }
  await sleep(1500);
}
console.log("完成。");
