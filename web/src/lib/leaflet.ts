// 运行时从 CDN（jsdelivr，国内可达）加载 Leaflet，免 npm 安装、规避杀软/EPERM。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let p: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadLeaflet(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (p) return p;
  p = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => resolve(w.L);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return p;
}
