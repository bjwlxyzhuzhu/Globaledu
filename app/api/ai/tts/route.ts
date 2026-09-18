import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apimart } from "@/lib/ai/apimart";
import { getCredits, deductCredits } from "@/lib/credits";
import { COST, MODELS } from "@/lib/ai/models";

export const runtime = "nodejs";

/** 按性别选音色：千问/阿里 用其中文音色，其余走 OpenAI 兼容音色（挑更自然、贴合人设的） */
function voiceFor(baseUrl: string, model: string, gender: string) {
  const female = gender !== "male"; // 默认女声
  if (/dashscope|aliyun/i.test(baseUrl) || /qwen|cosyvoice/i.test(model)) {
    return female ? "Cherry" : "Ethan"; // 千问：Cherry 女 / Ethan 男
  }
  // OpenAI 兼容（gpt-4o-mini-tts 等）：shimmer 女声更温暖明快、ash 男声更沉稳亲切（优于 nova/onyx 的“洋腔”）
  return female ? "shimmer" : "ash";
}

/** gpt-4o*-tts 支持 instructions 控制语气：用它要求“自然中文普通话”并贴合人设（小创=热情女 / 小闯=沉稳男） */
function instructionsFor(model: string, gender: string): string | undefined {
  if (!/4o.*tts/i.test(model)) return undefined; // 仅 gpt-4o*-tts 接受 instructions
  return gender === "male"
    ? "用自然、地道的中文普通话朗读。语气沉稳、亲切、有条理，像一位冷静可靠的男向导；语速适中，吐字清晰，不要有外国口音。"
    : "用自然、地道的中文普通话朗读。语气热情、明快、有感染力，像一位活力四射的女向导；语速略快、略带笑意，不要有外国口音。";
}

/**
 * 数字人语音 TTS：把「小航」的文本回答转成语音。
 * 优先用用户在账户中心「数字人语音」绑定的 key（千问 qwen-tts）；否则平台默认（APIMart，扣 1 积分）。
 * 任意失败都返回 JSON（带 fallback:true），前端据此回退到浏览器内置 TTS，保证一定能发声。
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let text = "";
  let gender = "female";
  try {
    const body = await req.json();
    text = (body?.text ?? "").toString().slice(0, 800).trim();
    gender = body?.gender === "male" ? "male" : "female";
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "空文本" }, { status: 400 });

  // 解析 TTS 客户端：用户绑定的千问 key 优先，否则平台默认
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_api_keys")
    .select("base_url, api_key, model")
    .eq("user_id", user.id)
    .eq("purpose", "tts")
    .maybeSingle();

  let client: OpenAI;
  let model: string;
  let baseUrl: string;
  let usingOwnKey: boolean;
  if (data?.api_key && data?.base_url) {
    client = new OpenAI({ baseURL: data.base_url, apiKey: data.api_key });
    model = data.model || "qwen-tts";
    baseUrl = data.base_url;
    usingOwnKey = true;
  } else {
    client = apimart;
    model = MODELS.tts;
    baseUrl = process.env.APIMART_BASE_URL || "";
    usingOwnKey = false;
    let credits = 0;
    try {
      credits = await getCredits(user.id);
    } catch {
      credits = 0;
    }
    if (credits < COST.tts) {
      return NextResponse.json({ error: "积分不足", fallback: true }, { status: 402 });
    }
  }

  try {
    const voice = voiceFor(baseUrl, model, gender);
    const instructions = instructionsFor(model, gender);
    const speech = await client.audio.speech.create({
      model,
      voice: voice as never,
      input: text,
      ...(instructions ? { instructions } : {}),
    } as Parameters<typeof client.audio.speech.create>[0]);
    const buf = Buffer.from(await speech.arrayBuffer());
    if (!usingOwnKey) await deductCredits(user.id, "tts", COST.tts, { model });
    return new Response(buf, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "TTS 失败：" + (e instanceof Error ? e.message : "未知"), fallback: true },
      { status: 502 }
    );
  }
}
