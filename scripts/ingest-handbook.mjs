// 把《中国国际大学生创新大赛(2026)参赛手册》整本入库到 knowledge(source=国赛手册)，原 PDF 拷到 public/library。
// 用法（web/ 目录）： node --env-file=.env.local scripts/ingest-handbook.mjs
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import { readFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const proxy = process.env.DEV_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) { setGlobalDispatcher(new ProxyAgent(proxy)); console.log("[proxy]", proxy); }

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ai = new OpenAI({ baseURL: process.env.APIMART_BASE_URL, apiKey: process.env.APIMART_API_KEY });
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-3-small";
const SOURCE = "国赛手册";
const TITLE = "中国国际大学生创新大赛(2026)参赛手册";

const WEB = path.resolve(fileURLToPath(import.meta.url), "../..");
const ROOT = path.resolve(WEB, "..");
const TXT = path.join(ROOT, "手册_提取.txt");
const PDF_SRC = "D:\\Documents\\C创新创业大赛\\2026\\霍红光创赛指导手册.pdf";
const PUB = path.join(WEB, "public", "library");

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
async function embedAll(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 48) {
    const r = await withRetry(() => ai.embeddings.create({ model: EMBED_MODEL, input: texts.slice(i, i + 48) }), `embed ${i}`);
    for (const d of r.data) out.push(d.embedding);
    process.stdout.write(`\r  嵌入 ${Math.min(i + 48, texts.length)}/${texts.length}   `);
  }
  process.stdout.write("\n");
  return out;
}

if (!existsSync(TXT)) { console.error("✗ 找不到", TXT, "（请先抽取手册文本）"); process.exit(1); }
const raw = readFileSync(TXT, "utf8").replace(/===== 第\d+页 =====/g, "\n");
const chunks = chunkText(raw);
console.log(`手册文本 ${raw.length} 字 → ${chunks.length} 块`);

console.log("清旧块…");
await withRetry(() => admin.from("knowledge").delete().eq("source", SOURCE), "清 knowledge");
const vecs = await embedAll(chunks);
const rows = chunks.map((c, i) => ({ source: SOURCE, title: TITLE, tags: ["国赛", "创新大赛"], chunk: c, embedding: toVec(vecs[i]) }));
for (let i = 0; i < rows.length; i += 100) {
  const { error } = await withRetry(() => admin.from("knowledge").insert(rows.slice(i, i + 100)), "插 knowledge");
  if (error) throw new Error(error.message);
}
console.log(`✓ knowledge[${SOURCE}] +${rows.length} 块`);

// 拷 PDF 供下载（ascii 文件名，避免中文 URL）
try {
  mkdirSync(PUB, { recursive: true });
  if (existsSync(PDF_SRC)) { copyFileSync(PDF_SRC, path.join(PUB, "guosai-handbook-2026.pdf")); console.log("✓ PDF 已拷到 /library/guosai-handbook-2026.pdf"); }
  else console.warn("⚠ 找不到原 PDF，跳过拷贝：", PDF_SRC);
} catch (e) { console.warn("⚠ 拷 PDF 失败：", e.message); }

const { count } = await admin.from("knowledge").select("*", { count: "exact", head: true });
console.log(`== 完成。knowledge 共 ${count ?? "?"} 块 ==`);
