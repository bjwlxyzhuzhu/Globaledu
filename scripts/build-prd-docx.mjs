import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const sizeOf = require('image-size').imageSize;

const [markdownArg, outputArg] = process.argv.slice(2);
if (!markdownArg || !outputArg) throw new Error('Usage: node build-prd-docx.mjs <input.md> <output.docx>');

const markdownPath = path.resolve(markdownArg);
const markdownDir = path.dirname(markdownPath);
const outputPath = path.resolve(outputArg);
const md = await fs.readFile(markdownPath, 'utf8');
const zip = new JSZip();

const esc = (s = '') => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const plain = (s) => s
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1（$2）')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1');
const para = (text, style = 'Normal', preserve = false, italic = false) => {
  const space = preserve ? ' xml:space="preserve"' : '';
  const italics = italic ? '<w:i/><w:iCs/>' : '';
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:rPr>${italics}</w:rPr><w:t${space}>${esc(plain(text))}</w:t></w:r></w:p>`;
};

const body = [];
const rels = [];
const imageTypes = new Set();
let inCode = false;
let imageIndex = 1;

for (const line of md.split(/\r?\n/)) {
  if (/^```/.test(line)) { inCode = !inCode; continue; }
  if (inCode) { body.push(para(line, 'Code', true)); continue; }

  const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
  if (imageMatch) {
    const [, alt, relPath] = imageMatch;
    const source = path.resolve(markdownDir, relPath.replaceAll('/', path.sep));
    try {
      const bytes = await fs.readFile(source);
      const ext = path.extname(source).slice(1).toLowerCase();
      const mediaName = `image${imageIndex}.${ext}`;
      const rid = `rId${imageIndex}`;
      imageTypes.add(ext);
      zip.file(`word/media/${mediaName}`, bytes);
      rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/>`);
      const dim = sizeOf(bytes);
      const maxCx = 5486400;
      const maxCy = 3657600;
      let cx = maxCx;
      let cy = Math.round(cx * dim.height / dim.width);
      if (cy > maxCy) { cy = maxCy; cx = Math.round(cy * dim.width / dim.height); }
      body.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${imageIndex}" name="Picture ${imageIndex}" descr="${esc(alt)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${esc(alt)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
      body.push(para(`图：${alt}`, 'Caption'));
      imageIndex += 1;
    } catch { /* 缺图时跳过 */ }
    continue;
  }

  const heading = line.match(/^(#{1,6})\s+(.+)$/);
  if (heading) { body.push(para(heading[2], `Heading${Math.min(heading[1].length, 3)}`)); continue; }
  if (/^---+$/.test(line)) continue;
  const quote = line.match(/^>\s?(.*)$/);
  if (quote) { body.push(para(quote[1], 'Quote', false, true)); continue; }
  const bullet = line.match(/^\s*[-*]\s+(.+)$/);
  if (bullet) { body.push(para(`• ${bullet[1]}`, 'ListParagraph')); continue; }
  if (/^\s*\d+\.\s+/.test(line)) { body.push(para(line, 'ListParagraph')); continue; }
  if (/^\|.*\|\s*$/.test(line)) {
    if (!/^\|[\s:|-]+\|\s*$/.test(line)) body.push(para(line.replace(/^\||\|$/g, '').split('|').map((x) => x.trim()).join('　｜　'), 'TableText'));
    continue;
  }
  body.push(line.trim() ? para(line) : '<w:p/>');
}

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join('\n')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567"/></w:sectPr></w:body></w:document>`;

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="微软雅黑"/><w:sz w:val="21"/><w:color w:val="222222"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="320" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="123C69"/><w:sz w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="260" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="176B87"/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="2E5D73"/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="420" w:hanging="210"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360" w:right="360"/><w:shd w:fill="EEF6F8"/></w:pPr><w:rPr><w:i/><w:color w:val="4C6770"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="240"/><w:shd w:fill="F2F4F7"/><w:spacing w:after="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="等线"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:fill="F5F8FA"/><w:spacing w:after="30"/></w:pPr><w:rPr><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:color w:val="666666"/><w:sz w:val="18"/></w:rPr></w:style></w:styles>`;

const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const imageDefaults = [...imageTypes].map((ext) => `<Default Extension="${ext}" ContentType="${mime[ext] || `image/${ext}`}"/>`).join('');
zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imageDefaults}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
zip.file('word/document.xml', documentXml);
zip.file('word/styles.xml', stylesXml);
zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
const now = new Date().toISOString();
zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>寰语星球反向PRD（百度秒哒复刻版）</dc:title><dc:creator>Codex</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
zip.file('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>');

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const docx = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
await fs.writeFile(outputPath, docx);
console.log(JSON.stringify({ path: outputPath, bytes: docx.length, images: imageIndex - 1, sha256: crypto.createHash('sha256').update(docx).digest('hex').toUpperCase() }));
