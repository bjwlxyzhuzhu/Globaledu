// 用 APIMart gpt-image-2 生成「指挥中心」素材：station.png(单个工位/座椅，透明底，按人数动态摆放) +
// room.png(更沉浸的指挥中心实景背景)。运行： node --env-file=.env.local scripts/gen-room.mjs
// 幂等：已存在且 >2KB 跳过，失败可重跑。存 public/cockpit/{station,room}.png
import { writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { setGlobalDispatcher, ProxyAgent } from "undici";

const proxy = process.env.DEV_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) { setGlobalDispatcher(new ProxyAgent(proxy)); console.log("[proxy]", proxy); }
const BASE = process.env.APIMART_BASE_URL;
const H = { Authorization: "Bearer " + process.env.APIMART_API_KEY, "Content-Type": "application/json" };
const MODEL = "gpt-image-2";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = new URL("../public/cockpit/", import.meta.url);
try { mkdirSync(outDir, { recursive: true }); } catch {}

const DEFS = [
  {
    key: "station", size: "1024x1024", transparent: true,
    prompt: "A single futuristic operator workstation for one person: a sleek curved control console desk with a glowing holographic screen and an ergonomic high-tech chair behind it, viewed from a slightly elevated three-quarter front angle, glowing cyan and violet neon edge lighting, clean sci-fi industrial design, isolated on a fully transparent background. No person, no people, no characters, no text, no words, no logo.",
  },
  {
    key: "room", size: "1536x1024", transparent: false,
    prompt: "Wide cinematic interior of a futuristic spaceship mission-control command center / bridge, a tiered dark metallic floor, a huge glowing holographic viewscreen mounted high on the far wall, a panoramic windshield showing a cyan and violet hyperspace star tunnel, moody atmosphere lit by blue and purple neon, volumetric light, ultra detailed, photoreal sci-fi, empty room. No people, no characters, no text, no words, no logo.",
  },
];

async function submit(prompt, size, transparent) {
  for (let a = 0; a < 4; a++) {
    const body = { model: MODEL, prompt, size, n: 1 };
    if (transparent) body.background = "transparent";
    const r = await fetch(BASE + "/images/generations", { method: "POST", headers: H, body: JSON.stringify(body) });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = {}; }
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
  for (let i = 0; i < 90; i++) {
    let o; try { o = (await fetch(BASE + "/tasks/" + id, { headers: H }).then((x) => x.json()))?.data || {}; }
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
  console.log("→ 生成", d.key);
  try {
    let id; try { id = await submit(d.prompt, d.size, d.transparent); } catch (e) { console.log("  重试 submit:", e.message.slice(0, 60)); await sleep(8000); id = await submit(d.prompt, d.size === "1536x1024" ? "1024x1024" : d.size, d.transparent); }
    const img = await poll(id);
    const buf = img.url ? Buffer.from(await fetch(img.url).then((x) => x.arrayBuffer())) : Buffer.from(img.b64, "base64");
    if (!buf || buf.length < 2000) throw new Error("图片异常");
    writeFileSync(file, buf);
    console.log("  ✓", d.key, (buf.length / 1024).toFixed(0) + "KB");
  } catch (e) { console.log("  ✗", d.key, "失败：", (e.message || "").slice(0, 80)); }
  await sleep(1500);
}
console.log("完成。");
