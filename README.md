# 双创AI星际 · web（M1 骨架）

面向大学生创新创业竞赛的智能体集群网站。本目录是 Next.js 14 应用。

## 本地运行

```bash
pnpm install          # 首次（已配国内 npmmirror 源，见 .npmrc）
pnpm dev              # http://localhost:3000
pnpm build            # 生产构建（已验证通过）
```

## 首次激活（让登录/积分真正可用）

首页动效无需任何配置即可看；**登录与扣积分**需两步一次性激活：

1. **建表**：打开 Supabase 控制台 → SQL Editor → New query → 粘贴 `supabase/migrations/0001_init.sql` 全文 → Run。
2. **建演示账号**：
   ```bash
   node --env-file=.env.local scripts/seed.mjs
   ```

### 演示账号（登录页用「学号 + 密码」）
| 角色 | 学号 | 密码 |
|---|---|---|
| 学生 | `202596057038` | `Student@2026` |
| 管理员 | `admin` | `Admin@2026` |

登录后右上角显示真实积分；点右下角**宇航员小航**打开对话，发消息会走 `/api/ai/chat`（APIMart）并**每次扣 1 积分**（数据库 `deduct_credits` 原子扣分 + 写 `usage_logs`）。

## 环境变量（`.env.local`，不提交）
见 `.env.example`。`NEXT_PUBLIC_*` 为浏览器端（受 RLS）；`SUPABASE_SERVICE_ROLE_KEY` / `APIMART_API_KEY` 仅服务端。

## 目录
```
app/                  页面与 API
  page.tsx            首页（Server Component：读登录积分）
  login/page.tsx      学号登录
  api/ai/chat/route.ts  扣积分服务端示例（鉴权→预检→APIMart→原子扣分）
  api/credits/route.ts  查积分
  globals.css         设计系统（移植自定稿原型）
components/
  GalaxyHome.tsx      首页 React 外壳 + 小航对话
  galaxyEngine.js     银河动效引擎（机器抽取自原型，勿手改）
lib/
  supabase/{client,server,admin}.ts   三类客户端
  ai/{apimart,models}.ts · credits.ts · auth.ts
supabase/migrations/0001_init.sql      建表 + RLS + deduct_credits RPC
scripts/seed.mjs       演示账号
middleware.ts          会话刷新
Dockerfile · docker-compose.yml        部署骨架（9 月底阿里云上线用）
```

## Docker（部署用，9 月底上线）
```bash
docker compose --env-file .env.local up --build   # → http://服务器:3000
```

## 设计来源
所有动效定稿在 `../设计风格预览/风格A_银河探索.html`；`galaxyEngine.js` 由它机器生成。改设计请改原型再重新抽取，不要直接改引擎。

## 进度
- ✅ M1：脚手架 · 设计系统/首页移植 · Supabase 登录 · profiles/credits · 扣积分 API · Docker 骨架
- ⏭ M2 起：学习中心 6 模块 + AI 客服 RAG（知识库在 `../RAG/`）；应用中心各功能；管理端（名单导入、知识库上传带标签）

## 生产运行与开机自启（本机常驻）

平台以**生产模式**常驻本机，脱离编辑器/桌面应用独立运行。

```bash
node node_modules/next/dist/bin/next build   # 改完代码要重新构建，生产模式没有热更新
```

| 操作 | 命令（PowerShell） |
|---|---|
| 启动 | `schtasks /Run /TN "双创AI星际-网站"` |
| 停止 | `Get-NetTCPConnection -LocalPort 3000 -State Listen \| ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }` 后再 `Get-Process node \| Stop-Process -Force` |
| 看日志 | `Get-Content web\logs\server.log -Tail 50 -Wait` |
| 取消开机自启 | `schtasks /Delete /TN "双创AI星际-网站" /F` |

机制：计划任务「双创AI星际-网站」在**登录后 20 秒**触发，并**每 10 分钟**再跑一次；
`scripts/serve.mjs` 发现 3000 端口已在服务就直接退出，所以重复触发不会起第二个实例，
真挂了则下一次触发把它拉起来。`serve.mjs` 自身还带看门狗，服务进程异常退出 3 秒后自动重启。
无窗口启动靠 `scripts/start-hidden.vbs`（**该文件必须保持 CRLF + UTF-16LE 编码**，
换成 LF 会让 Windows Script Host 静默卡死）。

只监听 `127.0.0.1`。要让同局域网的学生机访问，把 `serve.mjs` 里的 `HOST` 改成 `0.0.0.0`
并在防火墙放行 3000 端口。

> 注意：生产服务占用 3000 端口，此时再跑 `pnpm dev` / `node scripts/dev-watchdog.mjs` 会端口冲突。
> 要开发就先停掉常驻服务，或给 dev 换个端口。
