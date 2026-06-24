// 运行时从 CDN（jsdelivr）加载 hanzi-writer（笔顺动画 + 书写测验）。免 npm 安装。
// 它会自动从 cdn.jsdelivr.net/npm/hanzi-writer-data 拉取每个字的笔顺数据。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let p: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadHanziWriter(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.HanziWriter) return Promise.resolve(w.HanziWriter);
  if (p) return p;
  p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.0/dist/hanzi-writer.min.js';
    s.async = true;
    s.onload = () => resolve(w.HanziWriter);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return p;
}
