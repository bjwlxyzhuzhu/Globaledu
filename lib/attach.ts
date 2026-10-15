// 客户端附件处理：图片本地读为 base64（走视觉模型），文档 POST /api/ai/file 解析为文本。
export const MAX_SIZE = 20 * 1024 * 1024; // 20MB
export const IMG_EXT = ["png", "jpg", "jpeg", "webp"];
export const DOC_EXT = ["pdf", "docx", "txt", "pptx", "xlsx", "xls"];
export const ALLOWED = [...IMG_EXT, ...DOC_EXT];
export const ACCEPT = ".pdf,.docx,.txt,.pptx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,image/*";

export type Att = { name: string; kind: "text" | "image"; text?: string; dataUrl?: string };

function readDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("读取失败"));
    r.readAsDataURL(file);
  });
}

export async function uploadAttachment(file: File): Promise<Att> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED.includes(ext)) throw new Error(`不支持的格式 .${ext}`);
  if (file.size > MAX_SIZE) throw new Error(`「${file.name}」超过 20MB`);
  if (IMG_EXT.includes(ext)) {
    return { name: file.name, kind: "image", dataUrl: await readDataUrl(file) };
  }
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/ai/file", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("请先登录再上传附件");
  if (!res.ok) throw new Error(data.error || `解析失败 ${res.status}`);
  return { name: file.name, kind: "text", text: data.text };
}
