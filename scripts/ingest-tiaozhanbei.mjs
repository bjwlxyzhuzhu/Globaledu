// 把「挑战杯」大挑/小挑 资料（挑战杯_提取.jsonl）入库到 knowledge。
// 用法（web/ 目录）： node --env-file=.env.local scripts/ingest-tiaozhanbei.mjs
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const proxy = process.env.DEV_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) { setGlobalDispatcher(new ProxyAgent(proxy)); console.log("[proxy]", proxy); }

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ai = new OpenAI({ baseURL: process.env.APIMART_BASE_URL, apiKey: process.env.APIMART_API_KEY });
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-3-small";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const JSONL = path.join(ROOT, process.argv[2] || "挑战杯_提取.jsonl");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, label, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); }
    catch (e) { console.warn(`  ${label} 第${i}次失败：${(e?.message || e).toString().slice(0, 90)}`); if (i === tries) throw e; await sleep(3000); }
  }
}
function chunkText(t, size = 700, overlap = 80) {
  t = (t || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const out = [];
  for (let i = 0; i < t.length; i += size - overlap) out.push(t.slice(i, i + size));
  return out.filter((x) => x.replace(/\s/g, "").length > 40);
}
const toVec = (v) => "[" + v.join(",") + "]";
async function embedOne(text) {
  for (let i = 1; i <= 2; i++) {
    try { const r = await ai.embeddings.create({ model: EMBED_MODEL, input: text }); return r.data[0].embedding; }
    catch (e) {
      if ((e?.error?.code || e?.code) === "sensitive_words_detected") return null; // 敏感词→跳过该块
      if (i === 2) return null;
      await sleep(2000);
    }
  }
  return null;
}
async function embedAll(texts) {
  const out = new Array(texts.length).fill(null);
  let skipped = 0;
  for (let i = 0; i < texts.length; i += 48) {
    const batch = texts.slice(i, i + 48);
    try {
      const r = await ai.embeddings.create({ model: EMBED_MODEL, input: batch });
      r.data.forEach((d, j) => { out[i + j] = d.embedding; });
    } catch {
      // 整批失败（多半含敏感词）→ 逐条嵌入，跳过失败项
      for (let j = 0; j < batch.length; j++) { const v = await embedOne(batch[j]); out[i + j] = v; if (!v) skipped++; }
    }
    process.stdout.write(`\r  嵌入 ${Math.min(i + 48, texts.length)}/${texts.length}（跳过${skipped}）   `);
  }
  process.stdout.write("\n");
  return out;
}

if (!existsSync(JSONL)) { console.error("✗ 找不到", JSONL); process.exit(1); }
const rows = readFileSync(JSONL, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
console.log(`读到 ${rows.length} 份`);

// 组装所有块（带 source/title）
const items = [];
for (const r of rows) {
  for (const c of chunkText(r.text)) items.push({ source: r.source, title: r.title, chunk: c });
}
console.log(`共 ${items.length} 块，开始嵌入…`);

// 按 source 清旧
const sources = [...new Set(rows.map((r) => r.source))];
for (const s of sources) await withRetry(() => admin.from("knowledge").delete().eq("source", s), "清 " + s);

const vecs = await embedAll(items.map((x) => x.chunk));
const insert = [];
for (let i = 0; i < items.length; i++) {
  if (!vecs[i]) continue; // 跳过被审核拦下的块
  insert.push({ source: items[i].source, title: items[i].title, tags: ["创赛"], chunk: items[i].chunk, embedding: toVec(vecs[i]) });
}
for (let i = 0; i < insert.length; i += 100) {
  const { error } = await withRetry(() => admin.from("knowledge").insert(insert.slice(i, i + 100)), "插 knowledge");
  if (error) throw new Error(error.message);
}
console.log(`✓ 已入库 ${insert.length}/${items.length} 块（跳过 ${items.length - insert.length} 敏感块，来源：${sources.join(" / ")}）`);
const { count } = await admin.from("knowledge").select("*", { count: "exact", head: true });
console.log(`== 完成。knowledge 共 ${count ?? "?"} 块 ==`);
