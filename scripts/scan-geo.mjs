// 扫描 cases/knowledge 里残留的地域/文化识别词。用法（web/）：node --env-file=.env.local scripts/scan-geo.mjs
import { createClient } from "@supabase/supabase-js";
import { setGlobalDispatcher, ProxyAgent } from "undici";
const proxy = process.env.DEV_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) setGlobalDispatcher(new ProxyAgent(proxy));
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const WATCH = ["宝鸡", "钛谷", "眉县", "凤翔", "扶风", "岐山", "陈仓", "渭滨", "金台", "渭北", "陕北", "秦岭", "西安", "陕西",
  "周秦", "青铜器", "法门寺", "西府", "关中", "渭河", "渭水", "雍城", "炎帝", "姜炎", "麟游", "千阳", "陇县", "太白", "凤县", "蔡家坡", "北首岭", "长乐塬", "文理学院"];
const found = new Map();
const scan = (s) => { if (typeof s !== "string") return; for (const w of WATCH) if (s.includes(w)) found.set(w, (found.get(w) || 0) + 1); };

const { data: cases } = await admin.from("cases").select("title,region,industry,situation,task,points");
for (const c of cases || []) { scan(c.title); scan(c.region); scan(c.industry); scan(c.situation); scan(c.task); (c.points || []).forEach(scan); }
let total = 0;
for (let from = 0; ; from += 1000) {
  const { data } = await admin.from("knowledge").select("title,chunk").range(from, from + 999);
  const b = data || []; for (const k of b) { scan(k.title); scan(k.chunk); } total += b.length;
  if (b.length < 1000) break;
}
console.log("扫描 cases", cases?.length, "+ knowledge", total);
if (found.size === 0) console.log("✓ 无残留识别词");
else { console.log("⚠ 残留："); for (const [w, n] of [...found.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${w}\t${n}`); }
process.exit(0);
