import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { resolveAIClient } from "@/lib/ai/resolve";

export const runtime = "nodejs";

/**
 * 一键润色：把用户输入的提问改写得更清晰、具体、贴合创赛场景，便于 AI 高质量作答。
 * 单次轻量补全、不做 RAG、不扣积分（UX 辅助）。绑定了自己 key 的走自己额度。
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录，请先登录" }, { status: 401 });

  let body: { text?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "请求格式错误" }, { status: 400 }); }
  const raw = (body?.text || "").toString().trim();
  if (!raw) return NextResponse.json({ error: "没有可润色的内容" }, { status: 400 });

  const sys = "你是“提示词润色助手”，服务于大学生创新创业竞赛场景。请把用户给的提问改写得更清晰、具体、有信息量：明确诉求、补上明显缺失的关键信息提示（如赛道/组别、团队构成、项目阶段、想要的产出形式），让 AI 能给出高质量、可落地的回答。要求：保持用户原意与第一人称；只输出润色后的【提问本身】；不要加引号、不要解释、不要分点、不要回答这个问题。";

  try {
    const { client, model } = await resolveAIClient(user.id, "chat");
    const r = await client.chat.completions.create({
      model,
      messages: [{ role: "system", content: sys }, { role: "user", content: raw.slice(0, 2000) }],
    });
    const out = (r.choices?.[0]?.message?.content || "").trim() || raw;
    return NextResponse.json({ text: out });
  } catch (e) {
    return NextResponse.json({ error: "润色失败：" + (e instanceof Error ? e.message : "未知错误") }, { status: 502 });
  }
}
