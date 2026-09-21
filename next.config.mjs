/** @type {import('next').NextConfig} */
const nextConfig = {
  // 首页为命令式 Canvas 动效移植，关闭严格模式避免开发期重复初始化造成的动画叠加
  reactStrictMode: false,
  // Docker 部署：产出最小化 standalone server（.next/standalone/server.js）
  output: "standalone",
  // 启用 instrumentation.ts（本地开发为服务端 fetch 注入代理）
  experimental: { instrumentationHook: true },
};

export default nextConfig;
