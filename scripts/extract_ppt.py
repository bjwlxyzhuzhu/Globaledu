# 抽取国创各赛道路演 PPT 模板文本 → JSONL（含原文件路径，供拷贝下载 + 入库）。
import os, json, zipfile, re

FILES = [
    (r"D:\Documents\C创新创业大赛\2026\模板\5主赛道参考模板.pptx", "国创·路演PPT模板", "国创·高教主赛道 路演PPT模板", "ppt-guochuang-zhu.pptx"),
    (r"D:\Documents\C创新创业大赛\2026\模板\1红旅赛道参考模板（绿色）(1).pptx", "国创·路演PPT模板", "国创·红旅赛道 路演PPT模板（绿色）", "ppt-guochuang-honglv.pptx"),
    (r"D:\Documents\C创新创业大赛\2026\模板\3.产业命题赛道参考模板.pptx", "国创·路演PPT模板", "国创·产业命题赛道 路演PPT模板", "ppt-guochuang-chanye.pptx"),
]
OUT = r"D:\Documents\BJ宝鸡教学\2026上\双创AI实验室智能体大赛\智能体平台\模板_提取.jsonl"

def from_pptx(p):
    out = []
    with zipfile.ZipFile(p) as z:
        for n in sorted([n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)],
                        key=lambda s: int(re.search(r"\d+", s).group())):
            txt = re.findall(r"<a:t>(.*?)</a:t>", z.read(n).decode("utf-8", "ignore"))
            if txt:
                out.append("【第%d页】" % (len(out) + 1) + " ".join(txt))
    return "\n".join(out)

def clean(s):
    return re.sub(r"[\ud800-\udfff]", "", s or "")

rows = []
for p, source, title, slug in FILES:
    if not os.path.isfile(p):
        print("缺文件", p); continue
    t = clean(from_pptx(p).strip())
    rows.append({"source": source, "title": title, "ext": "pptx", "path": p, "slug": slug, "size_kb": round(os.path.getsize(p) / 1024), "text": t})
    print(f"{len(t):>6}字 {os.path.getsize(p)//1024:>5}KB  {title}")

with open(OUT, "w", encoding="utf-8") as f:
    for r in rows:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print("→", OUT)
