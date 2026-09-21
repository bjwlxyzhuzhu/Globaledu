// 双盲脱敏：把 cases/knowledge/templates 里的地名（宝鸡/钛谷/眉县…）替换为中性词。
// 先把原始数据备份到 TEMP（可回滚），再原地更新。embedding 不动（文本替换不影响检索）。
// 用法（web/）：node --env-file=.env.local scripts/desensitize.mjs
import { createClient } from "@supabase/supabase-js";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import { writeFileSync, mkdirSync } from "node:fs";

const proxy = process.env.DEV_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) { setGlobalDispatcher(new ProxyAgent(proxy)); console.log("[proxy]", proxy); }
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// 顺序＝优先级：具体/长词在前，避免「宝鸡眉县」只替换一半
const MAP = [
  ["青铜器博物院", "某青铜文博馆"], ["长乐塬", "某工业遗址"], ["法门寺", "某佛教文化地标"],
  ["文理学院", "某学院"], ["钛谷", "金属新材料基地"], ["青铜器", "青铜文物"], ["周秦", "先秦"],
  ["眉县", "某县"], ["凤翔", "某区"], ["扶风", "某县"], ["岐山", "某县"], ["千阳", "某县"],
  ["陈仓", "某区"], ["渭滨", "某区"], ["金台", "某区"], ["渭北", "某地区"], ["陕北", "某地区"], ["关中", "某地区"], ["秦岭", "某山区"],
  ["宝鸡", "某市"], ["西安", "邻市"], ["陕西", "某省"],
];
const clean = (s) => { if (typeof s !== "string") return s; let o = s; for (const [a, b] of MAP) o = o.split(a).join(b); return o; };
const cleanArr = (a) => Array.isArray(a) ? a.map(clean) : a;
const hit = (s) => typeof s === "string" && MAP.some(([a]) => s.includes(a));

const OUT = "C:\\Users\\Administrator\\AppData\\Local\\Temp\\desens-backup";
mkdirSync(OUT, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-");

async function run() {
  // ===== cases =====
  const { data: cases } = await admin.from("cases").select("id,title,region,industry,situation,task,points");
  writeFileSync(`${OUT}\\cases-${ts}.json`, JSON.stringify(cases, null, 0), "utf8");
  let cN = 0;
  for (const c of cases || []) {
    const upd = { title: clean(c.title), region: clean(c.region), industry: clean(c.industry), situation: clean(c.situation), task: clean(c.task), points: cleanArr(c.points) };
    const changed = upd.title !== c.title || upd.region !== c.region || upd.industry !== c.industry || upd.situation !== c.situation || upd.task !== c.task || JSON.stringify(upd.points) !== JSON.stringify(c.points);
    if (changed) { const { error } = await admin.from("cases").update(upd).eq("id", c.id); if (error) console.warn("case", c.id, error.message); else cN++; }
  }
  console.log(`✓ cases 脱敏 ${cN}/${cases?.length || 0}`);

  // ===== templates =====
  const { data: tpls } = await admin.from("templates").select("id,name,category");
  let tN = 0;
  for (const t of tpls || []) {
    if (hit(t.name) || hit(t.category)) { const { error } = await admin.from("templates").update({ name: clean(t.name), category: clean(t.category) }).eq("id", t.id); if (!error) tN++; }
  }
  console.log(`✓ templates 脱敏 ${tN}/${tpls?.length || 0}`);

  // ===== knowledge（分页）=====
  const backup = [];
  let kN = 0, total = 0;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("knowledge").select("id,title,chunk").range(from, from + 999);
    if (error) { console.error("knowledge read", error.message); break; }
    const batch = data || [];
    for (const k of batch) {
      total++;
      if (hit(k.title) || hit(k.chunk)) {
        backup.push({ id: k.id, title: k.title, chunk: k.chunk });
        const { error: e2 } = await admin.from("knowledge").update({ title: clean(k.title), chunk: clean(k.chunk) }).eq("id", k.id);
        if (!e2) kN++; else console.warn("kn", k.id, e2.message);
      }
    }
    if (batch.length < 1000) break;
  }
  writeFileSync(`${OUT}\\knowledge-${ts}.json`, JSON.stringify(backup, null, 0), "utf8");
  console.log(`✓ knowledge 脱敏 ${kN}/${total}`);
  console.log("备份目录:", OUT);
}
run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
