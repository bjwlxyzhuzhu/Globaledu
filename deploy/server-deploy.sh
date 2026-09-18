#!/usr/bin/env bash
# 寰语星球 · 服务器端一键部署 / 更新脚本
#
# 用法（在服务器上，项目目录 = 本脚本的上级目录）：
#   bash deploy/server-deploy.sh            # 在线构建（服务器可访问 Docker Hub / npm 镜像）
#   bash deploy/server-deploy.sh --offline  # 离线：加载已上传的 huanyu-planet-image.tar.gz，不重新构建
#
# 前置：已安装 Docker Engine + Compose 插件；已在项目根目录准备好 .env。

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OFFLINE=0
[ "${1:-}" = "--offline" ] && OFFLINE=1

echo "==> 项目目录：$ROOT"

# 1) 环境变量
if [ ! -f .env ]; then
  cp .env.example .env
  echo "!! 已从 .env.example 生成 .env，请先填写 DEEPSEEK_API_KEY / ADMIN_PASSWORD / AUTH_SECRET 后重跑本脚本。"
  exit 1
fi
for k in ADMIN_PASSWORD AUTH_SECRET; do
  v="$(grep -E "^${k}=" .env | head -1 | cut -d= -f2-)"
  case "$v" in
    ""|admin888|please-change-this-to-a-long-random-string)
      echo "!! .env 中 ${k} 仍是默认值或为空，对外服务前必须改掉。"; exit 1;;
  esac
done

# 2) 镜像
if [ "$OFFLINE" = "1" ]; then
  IMG_TAR="${IMG_TAR:-huanyu-planet-image.tar.gz}"
  [ -f "$IMG_TAR" ] || { echo "!! 未找到镜像包 $IMG_TAR"; exit 1; }
  echo "==> 离线加载镜像 $IMG_TAR"
  gunzip -c "$IMG_TAR" | docker load
  docker compose up -d          # 不加 --build，直接用已加载的 huanyu-planet:latest
else
  echo "==> 在线构建并启动"
  docker compose up -d --build
fi

# 3) 健康检查
echo "==> 等待健康检查"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8787/api/health >/dev/null 2>&1; then
    echo "==> 服务已就绪：$(curl -fsS http://127.0.0.1:8787/api/health)"
    docker compose ps
    exit 0
  fi
  sleep 3
done

echo "!! 健康检查超时，最近日志："
docker compose logs --tail=120
exit 1
