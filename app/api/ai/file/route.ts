import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { extractFile } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX = 20 * 1024 * 1024; // 20MB
const ALLOWED = ["pdf", "docx", "txt", "pptx", "xlsx", "xls"]; // 图片在前端直接转 base64，不到这里

/** 上传文档 → 服务端解析为文本（供智能体读取）。≤20MB。 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "缺少文件" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "文件超过 20MB" }, { status: 413 });

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED.includes(ext)) return NextResponse.json({ error: "不支持的格式：" + ext }, { status: 415 });

  const buf = Buffer.from(await file.arrayBuffer());
  const r = await extractFile(buf, file.name, file.type || "");
  if (r.kind === "error") return NextResponse.json({ error: r.error }, { status: 422 });
  if (r.kind !== "text" || !r.text) return NextResponse.json({ error: "没解析出文本（可能是扫描件/空文件）" }, { status: 422 });
  return NextResponse.json({ name: file.name, kind: "text", text: r.text, chars: r.text.length });
}
