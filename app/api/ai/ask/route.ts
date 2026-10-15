import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAIClient } from "@/lib/ai/resolve";
import { getCredits, deductCredits } from "@/lib/credits";
import { COST } from "@/lib/ai/models";
import { apimart } from "@/lib/ai/apimart";
import { webSearch } from "@/lib/ai/websearch";
import { webfetchBlock } from "@/lib/ai/webfetch";
import { ASK_GATES, parseRadar, logEvidence, excerpt } from "@/lib/evidence";

export const runtime = "nodejs";

const EMBED_MODEL = process.env.EMBED_MODEL || "text-embedding-3-small";

type Msg = { role: string; content: string };
type Hit = { title: string; source: string; chunk: string; similarity: number };

/**
 * AI 客服（RAG 百问百答）：把问题向量化 → 在知识库(pgvector)检索 Top-K → 作为资料上下文
 * 拼进 system，再按数字人(小闯/小创)人设作答；平台 key 扣 1 积分。检索失败则降级为普通问答。
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录，请先登录" }, { status: 401 });

  let body: { messages?: Msg[]; system?: string; model?: string; web?: boolean; maxTokens?: number; plugins?: string[]; attachments?: { name: string; kind: string; text?: string; dataUrl?: string }[]; evidence?: { kind?: string; title?: string; meta?: Record<string, unknown>; project?: string; rubric?: { dim: string; w: number }[] } };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "请求格式错误" }, { status: 400 }); }
  const overrideModel = (typeof body?.model === "string" && body.model.trim()) ? body.model.trim() : null;
  const wantWeb = body?.web === true;
  const mtRaw = Number(body?.maxTokens);
  const maxTokens = Number.isFinite(mtRaw) && mtRaw > 0 ? Math.min(8192, Math.max(512, Math.round(mtRaw))) : undefined;
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0)
    return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });

  // 附件：文档转文本注入上下文，图片走视觉模型
  const atts = Array.isArray(body?.attachments) ? body!.attachments! : [];
  const docText = atts.filter((a) => a.kind === "text" && a.text)
    .map((a) => `【附件：${a.name}】\n${a.text}`).join("\n\n").slice(0, 20000);
  const images = atts.filter((a) => a.kind === "image" && a.dataUrl);

  const lastUserTxt = (() => { const c = [...messages].reverse().find((m) => m.role === "user")?.content; return typeof c === "string" ? c : ""; })();
  const lastUser = (lastUserTxt + " " + docText).trim().slice(0, 1500);

  // —— 知识库检索（失败不致命，降级为无 RAG）——
  let context = "";
  const sources: { title: string; source: string }[] = [];
  if (lastUser) {
    try {
      const emb = await apimart.embeddings.create({ model: EMBED_MODEL, input: lastUser });
      const vec = emb.data[0].embedding as number[];
      const admin = createAdminClient();
      const { data } = await admin.rpc("match_knowledge", {
        query_embedding: "[" + vec.join(",") + "]",
        match_count: 6,
      });
      const good = (((data as Hit[]) || []).filter((h) => h.similarity > 0.2));
      if (good.length) {
        context = good.map((h, i) => `【资料${i + 1}·${h.source}/${h.title || ""}】${h.chunk}`).join("\n");
        const seen = new Set<string>();
        for (const h of good) {
          const k = (h.source || "") + "/" + (h.title || "");
          if (!seen.has(k)) { seen.add(k); sources.push({ title: h.title || "", source: h.source || "" }); }
        }
      }
    } catch { /* 检索失败 → 无 RAG 继续 */ }
  }

  // —— 联网检索（可选，需配置 SEARCH_API_*；未配置则降级）——
  let webText = "";
  let webUsed = false;
  if (wantWeb && lastUser) {
    const hit = await webSearch(lastUser);
    if (hit) { webText = hit.text; webUsed = true; for (const it of hit.items) if (it.title) sources.push({ title: it.title, source: "联网检索" }); }
  }

  // —— 插件·网页抓取（真实功能）：启用且用户消息里有网址 → 服务端抓取正文注入 ——
  let fetchText = "";
  const plugins = Array.isArray(body?.plugins) ? body!.plugins! : [];
  if (plugins.includes("webfetch") && lastUserTxt) {
    const { block, fetched } = await webfetchBlock(lastUserTxt);
    fetchText = block;
    for (const f of fetched) if (f.ok) sources.push({ title: f.url, source: "网页抓取" });
  }

  const { client, model, usingOwnKey } = await resolveAIClient(user.id, "chat");

  let credits = Infinity;
  if (!usingOwnKey) {
    try { credits = await getCredits(user.id); }
    catch (e) { return NextResponse.json({ error: "读取积分失败：" + (e instanceof Error ? e.message : "") }, { status: 500 }); }
    if (credits < COST.chat)
      return NextResponse.json(
        { error: "积分不足。可在右上头像→账户中心绑定你自己的 API Key（用自己的额度，不扣积分）。", remaining: credits },
        { status: 402 }
      );
  }

  // system 可能很长（驾驶舱专家提示词 + 技能注入 + 项目上下文 + 篇幅/结构指令），放宽上限避免被截断导致指令丢失、成稿过短
  const persona = (body?.system || "").toString().slice(0, 16000);
  const webBlock = (webUsed ? `\n以下是「联网检索」到的实时网页资料，可结合作答并注明来源网址：\n${webText}` : "") + fetchText;
  const ragSys = (context
    ? `以下是从「双创AI星际」知识库检索到的资料，请优先据此作答，并在合适处自然带出依据；资料不足时可结合专业常识，但不要编造具体数据或来源：\n${context}`
    : `（本次未检索到强相关资料，请凭专业知识谨慎作答，不要编造具体数据或来源。）`) + webBlock;
  const sysMsgs: Msg[] = [];
  if (persona) sysMsgs.push({ role: "system", content: persona });
  const attNote = (docText || images.length)
    ? "\n\n用户上传了附件，相关内容已附在最新提问中（图片为视觉输入），请结合附件作答。"
    : "";
  sysMsgs.push({ role: "system", content: ragSys + attNote });

  // 把文档文本/图片并入最近一条用户消息
  const outMsgs: { role: string; content: unknown }[] = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
  if (docText || images.length) {
    let li = -1;
    for (let i = outMsgs.length - 1; i >= 0; i--) if (outMsgs[i].role === "user") { li = i; break; }
    if (li >= 0) {
      const base = typeof outMsgs[li].content === "string" ? (outMsgs[li].content as string) : "";
      const withDoc = docText ? `${base}\n\n${docText}` : base;
      outMsgs[li].content = images.length
        ? [{ type: "text", text: withDoc }, ...images.map((im) => ({ type: "image_url", image_url: { url: im.dataUrl } }))]
        : withDoc;
    }
  }

  const complete = async (mdl: string) => {
    const stream = await client.chat.completions.create({ model: mdl, messages: [...sysMsgs, ...outMsgs] as never, stream: true, ...(maxTokens ? { max_tokens: maxTokens } : {}) });
    let t = ""; for await (const chunk of stream) t += chunk.choices[0]?.delta?.content ?? ""; return t;
  };
  // 用户可选模型：优先用所选模型，失败则回退平台默认模型（选错不致命）
  const wantModel = overrideModel || model;
  let text = "";
  let usedModel = wantModel;
  try {
    text = await complete(wantModel);
  } catch (e) {
    if (overrideModel && overrideModel !== model) {
      try { text = await complete(model); usedModel = model; }
      catch (e2) { return NextResponse.json({ error: "AI 调用失败：" + (e2 instanceof Error ? e2.message : "未知错误") }, { status: 502 }); }
    } else {
      return NextResponse.json({ error: "AI 调用失败：" + (e instanceof Error ? e.message : "未知错误") }, { status: 502 });
    }
  }

  // —— 成长星图存证：达到里程碑门槛的产出，由服务端盖章写入证据链（失败不致命）——
  const ev = body?.evidence;
  const evKind = (ev?.kind || "").trim();
  if (evKind && ASK_GATES[evKind] && ASK_GATES[evKind](text)) {
    const dims = evKind === "defense_radar" ? parseRadar(text, ev?.rubric) : null;
    if (dims && ev?.meta && typeof ev.meta.key === "string") dims.key = ev.meta.key;
    if (evKind !== "defense_radar" || dims) {
      await logEvidence({
        userId: user.id, kind: evKind, title: ev?.title || "", dims,
        projectId: typeof ev?.project === "string" ? ev.project : null,
        payload: { q: excerpt(lastUserTxt, 300), a: excerpt(text), meta: ev?.meta || {}, model: usedModel },
      });
    }
  }

  const meta = { webRequested: wantWeb, webUsed, model: usedModel };
  if (usingOwnKey) return NextResponse.json({ text, remaining: null, ownKey: true, sources, ...meta });
  const r = await deductCredits(user.id, "chat", COST.chat, { model: usedModel, rag: sources.length, web: webUsed });
  return NextResponse.json({ text, remaining: r.ok ? r.remaining : credits, ownKey: false, sources, ...meta });
}
