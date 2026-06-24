# 寰语星球 · Huanyu Planet

来华留学生**分级中文与中华文化**学习智能体平台。用于「首届教学智能体大赛（超星泛雅主办）」与「研究生人工智能创新大赛」。

> 演示主线：星门开场 → 旋转地球仪 → 点中国 → 省份地图 → 城市文化页 → 汉字闯关 → 分级反谄媚对话 → 智能体集群产出双语报告+动画PPT → 能力画像与证书。

## 技术栈

- 前端 `web/`：Vite + React 18 + TypeScript + Tailwind + React Router + i18next + Zustand + Framer Motion + globe.gl
- 后端 `server/`：Express + TypeScript（tsx 直跑免编译）+ OpenAI 兼容大模型层（默认 DeepSeek，含 mock 兜底）+ Node 内置 `node:sqlite`
- 共享 `shared/`：前后端共用类型
- 数据 `data/`：**学生扩充区**（国家 / 地理 / 汉字 / HSK 词表 / 文化禁忌 / 知识库），详见 `data/README.md`

## 快速开始

```bash
pnpm install          # 国内镜像，扁平安装
cp .env.example .env  # 可不填 key，mock 兜底也能跑
pnpm dev              # 同时启动 web(5173) + server(8787)
```

打开 http://localhost:5173 。后端健康检查：http://localhost:8787/api/health 。

> 没有 DeepSeek key 时，对话/产出会返回占位双语内容，演示线不中断；填入 `DEEPSEEK_API_KEY` 即切真实大模型。

## 构建里程碑（对照 PRD）

- [x] **M1** 脚手架：单仓、前后端互通、LLM 代理（含兜底）、i18n、路由骨架、`/api/chat` 双语
- [x] **M2** 开场+地球：星门开场动画 + globe.gl 旋转地球 + 国家点选
- [ ] **M3** 地图下钻：中国→省→市→城市文化页（ECharts + GeoJSON）
- [ ] **M4** 模块舞台 + 汉字闯关（笔顺/练习/文化故事/计分）
- [ ] **M5** 分级·反谄媚对话引擎（RAG + 超纲/句长/谄媚/禁忌校验 + 指标）
- [ ] **M6** 智能体集群产出 + 轻量动画嵌 PPT
- [ ] **M7** 能力画像/证书 + 教师端 + 超星生态对接桩

## 给后续同学（学生扩充）

要补充国家、城市、汉字、知识库、文化禁忌等内容，**只改 `data/` 下的文件即可**，无需动代码。
字段格式与步骤见 [`data/README.md`](data/README.md)。
