import "server-only";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";

const MAX_TEXT = 12000; // 注入模型的单文件文本上限

export type Extracted =
  | { kind: "text"; text: string }
  | { kind: "image"; dataUrl: string }
  | { kind: "error"; error: string };

/** 服务端把上传文件解析成文本（图片在前端直接转 base64，不走这里）。 */
export async function extractFile(buf: Buffer, name: string, mime: string): Promise<Extracted> {
  const ext = (name.split(".").pop() || "").toLowerCase();
  try {
    if (ext === "txt" || (mime || "").startsWith("text/")) {
      return { kind: "text", text: buf.toString("utf8").slice(0, MAX_TEXT) };
    }
    if (ext === "docx") {
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return { kind: "text", text: (value || "").trim().slice(0, MAX_TEXT) };
    }
    if (ext === "pdf") {
      // pdf-parse 2.x 为 class API：new PDFParse({data}).getText()
      const mod = (await import("pdf-parse")) as unknown as {
        PDFParse: new (o: { data: Buffer }) => { getText: () => Promise<{ text: string }> };
      };
      const parser = new mod.PDFParse({ data: buf });
      const r = await parser.getText();
      return { kind: "text", text: (r.text || "").trim().slice(0, MAX_TEXT) };
    }
    if (ext === "pptx") {
      const zip = await JSZip.loadAsync(buf);
      const slides = Object.keys(zip.files)
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => (parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0])));
      let out = "";
      for (const n of slides) {
        const xml = await zip.files[n].async("string");
        const texts = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map((m) => m[1]);
        if (texts.length) out += texts.join(" ") + "\n";
      }
      return { kind: "text", text: out.trim().slice(0, MAX_TEXT) };
    }
    if (ext === "xlsx" || ext === "xls") {
      const wb = XLSX.read(buf, { type: "buffer" });
      let out = "";
      for (const sn of wb.SheetNames) out += `# ${sn}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[sn]) + "\n";
      return { kind: "text", text: out.trim().slice(0, MAX_TEXT) };
    }
    return { kind: "error", error: "不支持的格式：" + (ext || "未知") };
  } catch (e) {
    return { kind: "error", error: e instanceof Error ? e.message : "解析失败" };
  }
}
