# `/data` · 学生扩充区说明

> **这个文件夹是给后续同学补充内容的地方。改这里的文件即可，无需改代码。**
> 所有文件都是纯 JSON / Markdown，保存后刷新页面（或重启 `pnpm dev`）即生效。

## 目录一览

| 文件 / 目录 | 作用 | 谁会用到 |
|---|---|---|
| `countries.json` | 地球仪上的国家点 | M2 地球仪 |
| `geo/` | 中国 / 省份 GeoJSON（地图下钻） | M3 地图（待补） |
| `hanzi.json` | 汉字闯关的字库 | M4 汉字闯关 |
| `hsk_vocab/1.json … 6.json` | HSK 各级词表（对话超纲校验用） | M5 分级对话 |
| `taboo.json` | 文化禁忌库（按国别） | M5 反谄媚/文化校验 |
| `kb_seed/*.md` | 知识库文档（城市/主题） | M3 城市页、M5 RAG |

---

## 1. 加一个国家（`countries.json`）

数组里加一项：

```json
{
  "code": "EG",                 // ISO 两位国家码
  "name_zh": "埃及",
  "name_en": "Egypt",
  "lat": 30.0444,               // 纬度（首都即可）
  "lng": 31.2357,               // 经度
  "hasContent": true,           // 是否已有该国知识库内容（true 会高亮可进入）
  "native_lang": "ar",          // 母语代码（可选）
  "welcome_native": "مرحبا بكم في كوكب هوانيو"  // 母语欢迎语（可选，开场用）
}
```

## 2. 加一个汉字（`hanzi.json`）

```json
{
  "char": "月",
  "pinyin": "yuè",
  "strokes": 4,
  "radical": "月",
  "hsk": 1,
  "story_zh": "「月」像一弯月牙……（字源/文化故事，中文）",
  "story_native": "The character 月 (yuè, moon) … （母语/英文对照）",
  "words": [
    { "word": "月亮", "pinyin": "yuèliang", "meaning_en": "moon" }
  ]
}
```

> 笔顺动画由前端 `hanzi-writer` 自动按字生成，**不用手动准备笔顺数据**。

## 3. 加 HSK 词表（`hsk_vocab/<级别>.json`）

每级一个文件，数组里每项 `{ "word": "词", "pinyin": "拼音" }`。
当前是**示例子集**，建议后续把官方完整 HSK 词表整理粘贴进来（拼音可留空，校验只看「词」）。

## 4. 加文化禁忌（`taboo.json`）

```json
{ "country": "EG", "topic": "饮食", "note": "提醒：避免推荐含猪肉/酒精……" }
```
`country` 用国家码；`"*"` 表示对所有国家通用。

## 5. 加一篇知识库文档（`kb_seed/<英文短名>.md`）

文件名用英文/拼音（避免中文文件名编码问题）。开头是 YAML 元信息，正文用 Markdown：

```markdown
---
id: chengdu-chuanju
title: 成都川剧变脸
country: CN
city: 成都
topic: 文化
tags: [戏曲, 非遗, 四川]
source: seed
---

正文……（介绍这个城市/主题的图文知识，会出现在城市文化页，并供对话引用）
```

---

## 6. 关于 `geo/`（M3 地图，目前待补）

中国与省份地图需要 GeoJSON。推荐用阿里云 DataV.GeoAtlas 公开数据：

- 中国：`https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json` → 存为 `geo/china.json`
- 陕西：`https://geo.datav.aliyun.com/areas_v3/bound/610000_full.json` → 存为 `geo/shaanxi.json`
- 其它省份把 `610000` 换成对应行政区划码即可。

下载后放进 `geo/`，M3 地图模块会自动注册使用。
