// M2 知识入库：20 个案例 HTML + 备赛资源包 → cases/templates 表 + knowledge 向量库，并拷可下载文件到 public/library。
// 用法（web/ 目录）： node --env-file=.env.local scripts/ingest-m2.mjs
// 前提：已在 Supabase 跑过 0003_m2_learn_rag.sql；已 pnpm add -D mammoth。
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import { readFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mammoth from "mammoth";

const proxy = process.env.DEV_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) { setGlobalDispatcher(new ProxyAgent(proxy)); console.log("[proxy]", proxy); }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("✗ 缺少 Supabase 环境变量"); process.exit(1); }
const admin = createClient(url, key, { auth: { persistSession: false } });
const ai = new OpenAI({ baseURL: process.env.APIMART_BASE_URL, apiKey: process.env.APIMART_API_KEY });
const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-3-small";

const WEB = path.resolve(fileURLToPath(import.meta.url), "../..");      // .../web
const ROOT = path.resolve(WEB, "..");                                  // .../智能体平台
const RAG = path.join(ROOT, "RAG");
const CASES_HTML = path.join(RAG, "课程资源网站", "cases");
const CASES_ASSETS = path.join(RAG, "课程资源网站", "assets");
const CASES_DOCX = path.join(RAG, "课件-计算机学院-创新创业基础-朱丽叶", "课程资源包_AI区域产业版（习题、案例）", "01_课程案例50个");
const TPL_DIR = path.join(RAG, "课件-计算机学院-创新创业基础-朱丽叶", "备赛资源包");
const PUB_CASES = path.join(WEB, "public", "library", "cases");
const PUB_TPL = path.join(WEB, "public", "library", "templates");
mkdirSync(PUB_CASES, { recursive: true });
mkdirSync(PUB_TPL, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(fn, label, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); }
    catch (e) {
      console.warn(`  ${label} 第${i}次失败：${(e?.message || e).toString().slice(0, 90)}`);
      if (i === tries) throw e;
      await sleep(3000);
    }
  }
}

const decode = (s) => (s || "")
  .replace(/&#183;|&middot;/g, "·").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').trim();
const strip = (s) => decode((s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const chunkText = (t, size = 600) => {
  t = (t || "").replace(/\s+/g, " ").trim();
  const out = [];
  for (let i = 0; i < t.length; i += size) out.push(t.slice(i, i + size));
  return out.filter((x) => x.length > 30);
};
const toVecLiteral = (v) => "[" + v.join(",") + "]"; // pgvector 文本格式，最稳

async function embedAll(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 48) {
    const batch = texts.slice(i, i + 48);
    const r = await withRetry(() => ai.embeddings.create({ model: EMBED_MODEL, input: batch }), `embed ${i}`);
    for (const d of r.data) out.push(d.embedding);
  }
  return out;
}

async function putKnowledge(source, items) {
  if (!items.length) return;
  await withRetry(() => admin.from("knowledge").delete().eq("source", source), "清 knowledge " + source);
  const vecs = await embedAll(items.map((x) => x.chunk));
  const rows = items.map((x, i) => ({
    source, title: x.title, chunk: x.chunk, tags: x.tags || [], embedding: toVecLiteral(vecs[i]),
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await withRetry(() => admin.from("knowledge").insert(rows.slice(i, i + 100)), "插 knowledge");
    if (error) throw new Error(error.message);
  }
  console.log(`  knowledge[${source}] +${rows.length} 块`);
}

// ---------- 案例 ----------
function parseCase(html, code) {
  const titleRaw = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || "";
  const title = decode(titleRaw.replace(/^案例\d+\s*[|｜]\s*/, "")) || code;
  const pills = [...html.matchAll(/class="metric-pill"[^>]*>([^<]+)</g)].map((m) => decode(m[1]));
  let region = "", industry = "";
  if (pills[1]) { const p = pills[1].split("·").map((s) => s.trim()); region = p[0] || ""; industry = p.slice(1).join(" · "); }
  const points = pills[2] ? pills[2].split(/[、，,]/).map((s) => s.trim()).filter(Boolean) : [];
  const section = (kw) => {
    const m = html.match(new RegExp(`<h2[^>]*>[^<]*${kw}[^<]*<\\/h2>([\\s\\S]*?)(?=<h2|<\\/section>|<\\/article>)`));
    return m ? strip(m[1]) : "";
  };
  const situation = section("情境");
  const task = section("任务");
  const qBlock = (html.match(/讨论问题[\s\S]*?<ol[^>]*>([\s\S]*?)<\/ol>/) || [])[1] || "";
  const questions = [...qBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => strip(m[1])).filter(Boolean);
  return { code, title, region, industry, points, situation, task, questions };
}

async function ingestCases() {
  if (!existsSync(CASES_HTML)) { console.log("跳过案例：找不到", CASES_HTML); return; }
  const files = readdirSync(CASES_HTML).filter((f) => /^case-\d+\.html$/i.test(f)).sort();
  let docxList = []; try { docxList = readdirSync(CASES_DOCX); } catch {}
  const rows = [], kn = [];
  for (const f of files) {
    const code = f.replace(/\.html$/i, "");
    const num = code.match(/\d+/)[0];
    const c = parseCase(readFileSync(path.join(CASES_HTML, f), "utf8"), code);
    let image = null;
    const imgSrc = path.join(CASES_ASSETS, `${code}.png`);
    if (existsSync(imgSrc)) { copyFileSync(imgSrc, path.join(PUB_CASES, `${code}.png`)); image = `/library/cases/${code}.png`; }
    let doc = null;
    const dx = docxList.find((d) => d.startsWith(`案例${num}_`) || d.startsWith(`案例${parseInt(num)}_`));
    if (dx) { copyFileSync(path.join(CASES_DOCX, dx), path.join(PUB_CASES, `${code}.docx`)); doc = `/library/cases/${code}.docx`; }
    rows.push({
      code: c.code, title: c.title, region: c.region, industry: c.industry, points: c.points,
      situation: c.situation, task: c.task, questions: c.questions, analysis: [], image, doc,
      tags: [c.industry].filter(Boolean),
    });
    const text = [c.title, c.region && `区域:${c.region}`, c.industry && `产业:${c.industry}`,
      c.points.length && `知识点:${c.points.join("、")}`, c.situation && `情境:${c.situation}`,
      c.task && `课堂任务:${c.task}`, c.questions.length && `讨论问题:${c.questions.join(" ")}`]
      .filter(Boolean).join("。");
    for (const ch of chunkText(text)) kn.push({ title: c.title, chunk: ch, tags: [c.industry].filter(Boolean) });
  }
  const { error } = await withRetry(() => admin.from("cases").upsert(rows, { onConflict: "code" }), "写 cases");
  if (error) throw new Error(error.message);
  console.log(`案例 cases：${rows.length} 条`);
  await putKnowledge("案例", kn);
}

// ---------- 模板 ----------
function categoryOf(name) {
  if (/计划书|BP/i.test(name)) return "计划书";
  if (/PPT|路演/.test(name)) return "路演PPT";
  if (/合同/.test(name)) return "合同";
  if (/专利|软著|查新|检测|成果|批示|论文/.test(name)) return "申报材料";
  if (/指南|命题|手册|事项|问题|话术/.test(name)) return "备赛指南";
  return "其他";
}
async function ingestTemplates() {
  if (!existsSync(TPL_DIR)) { console.log("跳过模板：找不到", TPL_DIR); return; }
  const files = readdirSync(TPL_DIR).filter((f) => /\.(docx|pptx)$/i.test(f)).sort();
  const rows = [], kn = [];
  for (const f of files) {
    const num = (f.match(/^(\d+)/) || [])[1] || String(rows.length + 1).padStart(2, "0");
    const ext = f.split(".").pop().toLowerCase();
    const slug = `tpl-${num}.${ext}`;
    copyFileSync(path.join(TPL_DIR, f), path.join(PUB_TPL, slug));
    const size_kb = Math.round(statSync(path.join(TPL_DIR, f)).size / 1024);
    const name = f.replace(/^\d+[_-]?/, "").replace(/\.(docx|pptx)$/i, "");
    const category = categoryOf(f);
    rows.push({ name, category, file: `/library/templates/${slug}`, ext, size_kb, intro: "", sort: parseInt(num) || 0, tags: [category] });
    if (ext === "docx") {
      try {
        const { value } = await mammoth.extractRawText({ path: path.join(TPL_DIR, f) });
        if ((value || "").trim().length > 120) {
          for (const ch of chunkText(value)) kn.push({ title: name, chunk: ch, tags: [category] });
        }
      } catch (e) { console.warn("  docx 抽取失败", name, (e?.message || "").slice(0, 60)); }
    }
  }
  await withRetry(() => admin.from("templates").delete().neq("id", 0), "清 templates");
  const { error } = await withRetry(() => admin.from("templates").insert(rows), "插 templates");
  if (error) throw new Error(error.message);
  console.log(`模板 templates：${rows.length} 条`);
  await putKnowledge("备赛资源", kn);
}

console.log("== M2 入库开始 ==");
await ingestCases();
await ingestTemplates();
const { count } = await admin.from("knowledge").select("*", { count: "exact", head: true });
console.log(`== 完成。knowledge 共 ${count ?? "?"} 块；public/library 已就绪 ==`);
