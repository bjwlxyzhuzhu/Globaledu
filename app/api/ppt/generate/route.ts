import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getCredits, deductCredits } from "@/lib/credits";
import { COST } from "@/lib/ai/models";
import { logEvidence, excerpt } from "@/lib/evidence";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * 商业级 PPT 生成（对接开源引擎 Presenton，github.com/presenton/presenton）。
 * 平台只做代理：鉴权 → 扣积分 → 调引擎 REST API → 返回下载/在线编辑链接。
 * 引擎自托管（Docker 一条命令），LLM 走 OpenAI 兼容接口可直连 DeepSeek——数据不出自己服务器。
 * 环境变量：
 *   PPTGEN_BASE_URL    引擎地址（服务端调用用），如 http://localhost:5001
 *   PPTGEN_PUBLIC_URL  浏览器访问引擎的地址（默认同上；上生产后填反代域名）
 *   PPTGEN_AUTH        可选 Basic 认证 "user:pass"
 * 未配置 → 501，前端回退到轻量版 pptxgenjs 导出。
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录，请先登录" }, { status: 401 });

  const base = (process.env.PPTGEN_BASE_URL || "").replace(/\/+$/, "");
  if (!base)
    return NextResponse.json(
      { error: "PPT 引擎未配置（PPTGEN_BASE_URL）。请联系管理员部署 Presenton，或先用「轻量导出」。" },
      { status: 501 }
    );

  let body: { content?: string; title?: string; slides?: number; template?: string; exportAs?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "请求格式错误" }, { status: 400 }); }
  const content = (body?.content || "").toString().trim().slice(0, 30000);
  if (content.length < 30) return NextResponse.json({ error: "内容太短：请先生成路演大纲或粘贴项目介绍" }, { status: 400 });
  const nSlides = Math.min(25, Math.max(4, Number(body?.slides) || 12));
  const exportAs = body?.exportAs === "pdf" ? "pdf" : "pptx";

  // 预检积分（引擎生成成本高，按 PPT 单价扣）
  let credits = 0;
  try { credits = await getCredits(user.id); }
  catch (e) { return NextResponse.json({ error: "读取积分失败：" + (e instanceof Error ? e.message : "") }, { status: 500 }); }
  if (credits < COST.ppt)
    return NextResponse.json({ error: "积分不足（生成商业级 PPT 需 " + COST.ppt + " 分）", remaining: credits }, { status: 402 });

  // —— 调 Presenton 引擎（生成需 1-3 分钟，给足超时）——
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.PPTGEN_AUTH) headers.Authorization = "Basic " + Buffer.from(process.env.PPTGEN_AUTH).toString("base64");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 280000);
  let data: { presentation_id?: string; path?: string; edit_path?: string };
  try {
    const res = await fetch(base + "/api/v1/ppt/presentation/generate", {
      method: "POST", headers, signal: ctrl.signal,
      body: JSON.stringify({
        content,
        n_slides: nSlides,
        language: "Chinese",
        template: (body?.template || "general").toString(),
        export_as: exportAs,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json({ error: `PPT 引擎返回错误 ${res.status}：${t.slice(0, 200)}` }, { status: 502 });
    }
    data = await res.json();
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error && e.name === "AbortError" ? "生成超时（内容太长或引擎繁忙），请稍后重试" : "无法连接 PPT 引擎：" + (e instanceof Error ? e.message : "");
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // 拼浏览器可访问的链接（引擎返回相对路径）
  const pub = (process.env.PPTGEN_PUBLIC_URL || base).replace(/\/+$/, "");
  const abs = (p?: string) => (!p ? "" : /^https?:\/\//.test(p) ? p : pub + (p.startsWith("/") ? p : "/" + p));
  const downloadUrl = abs(data.path);
  const editUrl = abs(data.edit_path);

  const r = await deductCredits(user.id, "ppt", COST.ppt, { engine: "presenton", slides: nSlides, exportAs });
  await logEvidence({
    userId: user.id, kind: "export_doc",
    title: `商业级PPT · ${(body?.title || "路演").toString().slice(0, 40)}`,
    payload: { fmt: exportAs + "-engine", slides: nSlides, q: excerpt(content, 200) },
  });
  return NextResponse.json({ downloadUrl, editUrl, remaining: r.ok ? r.remaining : credits });
}
