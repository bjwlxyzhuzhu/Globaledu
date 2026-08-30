# 寰语星球：云端 Docker 部署说明

## 1. 准备环境变量

在解压后的项目根目录复制环境变量样例：

```bash
cp .env.example .env
```

编辑 `.env`，至少填写：

```env
DEEPSEEK_API_KEY=请填写新的服务器专用密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-pro
```

请勿把填写后的 `.env` 上传到 Git 仓库或发送给无关人员。

## 2. 启动服务

服务器需安装 Docker Engine 和 Docker Compose 插件，然后在项目根目录执行：

```bash
docker compose up -d --build
```

默认访问地址：

```text
http://服务器公网IP:8787
```

健康检查：

```bash
curl http://127.0.0.1:8787/api/health
```

## 3. 常用维护命令

```bash
# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f --tail=200

# 更新代码后重新构建
docker compose up -d --build

# 停止服务（保留学习数据）
docker compose down
```

SQLite 学习数据存放在 Docker 命名卷 `huanyu-data` 中。不要执行 `docker compose down -v`，否则会删除该数据卷。

## 4. 云服务器放行端口

在云平台安全组和服务器防火墙中放行 TCP `8787`。正式对外服务时，建议再使用 Nginx 或云平台网关绑定域名并配置 HTTPS。

## 5. 安全说明

- 本交付包不含真实 API 密钥和运行数据库。
- 请为服务器新建 DeepSeek API 密钥，不要重复使用曾通过聊天或截图发送的密钥。
- `.dockerignore` 会阻止 Docker 把 `.env` 打进镜像。
