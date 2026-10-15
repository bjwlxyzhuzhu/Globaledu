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

默认使用 DeepSeek 官方 `deepseek-v4-pro`，接口地址为 `https://api.deepseek.com`。密钥只放在本地 `.env`，不要写入源码、镜像或提交到 Git。

### 部署 / 演示运行（单进程，推荐交付与答辩用）

```bash
pnpm serve            # 先打包前端 web/dist，再由后端一个进程同端口托管页面+接口
```

打开 **http://localhost:8787** 即可（页面与 `/api` 同端口，无需另开 5173）。
相比 `pnpm dev`（vite + tsx-watch 多进程、带文件监听），单进程模式进程更少、更稳定，
也更不易被安全软件（360 / 火绒 / Defender）误杀 node。若仍被误杀，请把 `node.exe`
或本项目目录加入杀软「信任区 / 排除项」。管理员默认账号 `admin / admin888`（首启自动创建，
请在 `.env` 设 `ADMIN_PASSWORD` 后重启修改）。

### Docker 部署

前提：已安装 Docker Desktop 或 Docker Engine + Compose。

```bash
cp .env.example .env       # Windows 可复制后手动填写
# 在 .env 中设置 DEEPSEEK_API_KEY、ADMIN_PASSWORD、AUTH_SECRET
docker compose up -d --build
docker compose ps
```

打开 **http://localhost:8787**。健康检查：`http://localhost:8787/api/health`。
SQLite 数据保存在命名卷 `huanyu-data` 中，重新构建镜像不会丢失。停止服务使用
`docker compose down`；如需连同数据库一起删除，需明确执行 `docker compose down -v`。

### 中文乱码与 UTF-8

仓库使用 UTF-8（无 BOM）和 LF。`.editorconfig`、`.gitattributes` 已统一编辑器、Git 与 Docker 的编码规则。

若 Windows 旧终端或 Vim 显示乱码：

```powershell
chcp 65001
$OutputEncoding = [Console]::OutputEncoding = [Console]::InputEncoding = [Text.UTF8Encoding]::new()
vim -u .vimrc .env
```

也可以先执行 `powershell -ExecutionPolicy Bypass -File .\scripts\utf8.ps1`，或使用
`.\scripts\dev-utf8.ps1` 启动开发环境，使 Node、Vite 和 PowerShell 日志在同一 UTF-8 会话中显示。

在已打开的 Vim 中也可执行：

```vim
:set encoding=utf-8 fileencoding=utf-8
:edit ++enc=utf-8
```

若文件过去曾被以 GBK 错误保存，不要直接覆盖；先用 `:edit ++enc=gb18030 文件名` 确认中文正常，
再执行 `:set fileencoding=utf-8` 和 `:write` 转换。

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
