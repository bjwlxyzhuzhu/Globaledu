// 浏览器端「Markdown → Word(.doc)」导出，零依赖：用 HTML blob + Word MIME，
// Word/WPS 均可正常打开并继续编辑。P5 排版升级：封面页 + 中文公文级版式（黑体标题/宋体正文/
// 首行缩进/1.5 倍行距/A4 页边距）+ Markdown 表格，导出即像一份能直接上交的文档。

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  // 先转义，再处理 **加粗** 与 *斜体*
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
}

const isTableRow = (s: string) => /^\s*\|.*\|\s*$/.test(s);
const isTableSep = (s: string) => /^\s*\|[\s:|-]+\|\s*$/.test(s);
const splitCells = (s: string) => s.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

/** Markdown → HTML：标题 / 有序·无序列表 / 表格 / 引用 / 加粗斜体 / 段落。 */
function mdToHtml(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    let m: RegExpMatchArray | null;
    if (/^\s*$/.test(line)) { closeList(); continue; }
    // 表格：表头行 + 分隔行 + 数据行
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeList();
      const head = splitCells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push(splitCells(lines[i])); i++; }
      i--;
      out.push("<table><thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
        rows.map((r) => "<tr>" + head.map((_, k) => `<td>${inline(r[k] ?? "")}</td>`).join("") + "</tr>").join("") + "</tbody></table>");
      continue;
    }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      closeList();
      const lvl = m[1].length;
      out.push(`<h${lvl}>${inline(m[2].replace(/\*\*/g, ""))}</h${lvl}>`);
    } else if ((m = line.match(/^\s*>\s?(.*)$/))) {
      closeList();
      out.push(`<blockquote>${inline(m[1])}</blockquote>`);
    } else if ((m = line.match(/^\s*[-*•·]\s+(.*)$/))) {
      if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+[.、)]\s+(.*)$/))) {
      if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
      out.push(`<li>${inline(m[1])}</li>`);
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

/** 公文级版式（Word 与打印 PDF 共用）：黑体标题、宋体正文、首行缩进、1.5 倍行距、表格边框 */
const DOC_CSS =
  "body{font-family:SimSun,'宋体',serif;font-size:12pt;line-height:1.6;color:#000;text-align:justify;}" +
  "h1{font-family:SimHei,'黑体','Microsoft YaHei',sans-serif;font-size:16pt;text-align:center;margin:22pt 0 12pt;}" +
  "h2{font-family:SimHei,'黑体','Microsoft YaHei',sans-serif;font-size:14pt;margin:16pt 0 8pt;}" +
  "h3{font-family:SimHei,'黑体','Microsoft YaHei',sans-serif;font-size:12pt;margin:12pt 0 6pt;}" +
  "h4{font-family:SimHei,'黑体',sans-serif;font-size:12pt;margin:10pt 0 4pt;}" +
  "p{margin:0 0 6pt;text-indent:2em;}" +
  "ul,ol{margin:4pt 0 8pt 30pt;}li{margin:2pt 0;}" +
  "blockquote{margin:6pt 20pt;padding:4pt 10pt;border-left:3px solid #999;color:#444;font-family:KaiTi,'楷体',serif;}" +
  "table{border-collapse:collapse;width:100%;margin:8pt 0;font-size:10.5pt;}" +
  "th,td{border:1px solid #666;padding:4pt 6pt;text-align:left;}th{background:#f0f0f0;font-family:SimHei,'黑体',sans-serif;}" +
  "strong{font-family:SimHei,'黑体',sans-serif;}";

/** 封面页 HTML（标题 + 副题 + 日期），Word 里独占一页 */
function coverHtml(title: string, subtitle: string): string {
  const date = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  return (
    `<div style="text-align:center;">` +
    `<p style="text-indent:0;margin-top:140pt;">&nbsp;</p>` +
    `<p style="text-indent:0;font-family:SimHei,'黑体',sans-serif;font-size:26pt;font-weight:bold;line-height:1.5;">${esc(title)}</p>` +
    (subtitle ? `<p style="text-indent:0;font-size:14pt;color:#333;margin-top:18pt;">${esc(subtitle)}</p>` : "") +
    `<p style="text-indent:0;font-size:12pt;color:#555;margin-top:160pt;">${date}</p>` +
    `<p style="text-indent:0;font-size:10.5pt;color:#888;margin-top:8pt;">双创AI星际 · AI 辅助生成初稿，请核验数据并替换占位后使用</p>` +
    `</div><br clear="all" style="page-break-before:always;mso-break-type:page-break" />`
  );
}

/** 触发浏览器下载一个 .doc 文件（Word/WPS 可打开）。body 接收 Markdown 文本。 */
export function downloadWord(filename: string, title: string, body: string, subtitle = "") {
  const pageCss =
    "@page WordSection1{size:595.3pt 841.9pt;margin:72pt 90pt 72pt 90pt;mso-header-margin:35.4pt;mso-footer-margin:35.4pt;}" +
    "div.WordSection1{page:WordSection1;}";
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8"><title>${esc(title)}</title>` +
    `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->` +
    `<style>${pageCss}${DOC_CSS}</style></head>` +
    `<body><div class="WordSection1">` +
    (title ? coverHtml(title, subtitle) : "") +
    mdToHtml(body) +
    `</div></body></html>`;
  triggerDownload(new Blob(["﻿", html], { type: "application/msword" }), filename.endsWith(".doc") ? filename : filename + ".doc");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 下载为 Markdown(.md)。 */
export function downloadMarkdown(filename: string, md: string) {
  triggerDownload(
    new Blob(["﻿", md], { type: "text/markdown;charset=utf-8" }),
    filename.endsWith(".md") ? filename : filename + ".md",
  );
}

/** 打开打印窗口导出 PDF（用浏览器「另存为 PDF」，零依赖）。body 接收 Markdown，与 Word 同版式。 */
export function printPdf(title: string, body: string) {
  const w = window.open("", "_blank", "width=900,height=720");
  if (!w) { alert("浏览器拦截了弹窗，请允许弹窗后重试，或改用 Word / Markdown 导出。"); return; }
  const css = DOC_CSS + "body{max-width:760px;margin:0 auto;padding:28px;}@media print{body{padding:0;}}";
  const html =
    `<html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head>` +
    `<body><h1>${esc(title)}</h1>${mdToHtml(body)}` +
    `<scr` + `ipt>window.onload=function(){setTimeout(function(){window.print();},350);};</scr` + `ipt></body></html>`;
  w.document.write(html);
  w.document.close();
}

let pptxLib: unknown = null;
async function loadPptx(): Promise<{ new (): { defineLayout: (o: object) => void; layout: string; addSlide: () => { background: object; addText: (t: unknown, o: object) => void }; writeFile: (o: object) => Promise<string> } }> {
  const g = window as unknown as { PptxGenJS?: unknown };
  if (pptxLib) return pptxLib as never;
  if (g.PptxGenJS) return (pptxLib = g.PptxGenJS) as never;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
    s.onload = () => res();
    s.onerror = () => rej(new Error("PPTX 插件加载失败（需联网）"));
    document.head.appendChild(s);
  });
  return (pptxLib = g.PptxGenJS) as never;
}

/** 导出 PPTX：把 Markdown 按「## 」分节，每节一页（标题 + 要点）。运行时从 CDN 载 pptxgenjs，零本地依赖。 */
export async function downloadPptx(filename: string, title: string, md: string) {
  const Pptx = await loadPptx();
  const pptx = new Pptx();
  pptx.defineLayout({ name: "W", width: 13.33, height: 7.5 });
  pptx.layout = "W";
  const cover = pptx.addSlide();
  cover.background = { color: "0A0E22" };
  cover.addText(title || "商业计划书", { x: 0.6, y: 2.6, w: 12, h: 1.5, fontSize: 40, bold: true, color: "FFFFFF", align: "center" });
  cover.addText("创业星舰 · AI 协同生成", { x: 0.6, y: 4.2, w: 12, h: 0.6, fontSize: 18, color: "8AB4FF", align: "center" });
  const lines = md.replace(/\r/g, "").split("\n");
  const slides: { title: string; bullets: string[] }[] = [];
  let cur: { title: string; bullets: string[] } | null = null;
  const flush = () => { if (cur) slides.push(cur); };
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^#{1,3}\s+(.*)$/);
    if (m) { flush(); cur = { title: m[1].replace(/\*\*/g, ""), bullets: [] }; }
    else if (line) { if (!cur) cur = { title: title || "概述", bullets: [] }; cur.bullets.push(line.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "")); }
  }
  flush();
  const out = slides.length ? slides : [{ title: title || "内容", bullets: [md.slice(0, 800)] }];
  for (const s of out) {
    const sl = pptx.addSlide();
    sl.background = { color: "0A0E22" };
    sl.addText(s.title, { x: 0.5, y: 0.35, w: 12.3, h: 0.9, fontSize: 26, bold: true, color: "FFB657" });
    const body = s.bullets.slice(0, 12).map((b) => ({ text: b, options: { bullet: true, fontSize: 15, color: "E8ECF8", paraSpaceAfter: 6 } }));
    if (body.length) sl.addText(body, { x: 0.7, y: 1.4, w: 12, h: 5.6, valign: "top" });
  }
  await pptx.writeFile({ fileName: filename.endsWith(".pptx") ? filename : filename + ".pptx" });
}
