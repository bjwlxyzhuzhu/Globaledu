import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// 学校 WebVPN（深信服 wengine）会把脚本内容包进一层函数以改写 URL，
// 而 ES module 的顶层 export 在函数体内非法，于是整包抛
// "SyntaxError: Unexpected token 'export'"，#root 空白——校外老师就是打不开。
// 因此产物打成传统 IIFE，并去掉 index.html 上的 type="module"/crossorigin。
// 本项目没有动态 import，单文件打包不会丢代码分割能力。
function classicScript(): Plugin {
  return {
    name: 'hyxq-classic-script',
    transformIndexHtml(html) {
      // 必须换成 defer 而不是直接删掉：type="module" 自带延迟执行，
      // 去掉后传统脚本会在 <head> 里同步执行，那时 <div id="root"> 还没解析出来，
      // React 会抛 #299 "Target container is not a DOM element"。
      return html.replace(/\s+type="module"/g, ' defer').replace(/\s+crossorigin/g, '');
    },
  };
}

// /api 代理到后端 Express(8787)；@shared 别名指向仓库根的 shared/
export default defineConfig({
  plugins: [react(), classicScript()],
  build: {
    target: 'es2015',
    modulePreload: false,
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true },
    },
  },
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./../shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': 'http://localhost:8787',
    },
    fs: { allow: ['..'] },
  },
});
