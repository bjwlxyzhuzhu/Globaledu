import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import Hud from '../components/Hud';
import { BackButton } from '../components/MapUI';
import { useStore } from '../store/useStore';
import { authHeaders } from '../lib/api';

interface Slide {
  heading_zh: string;
  heading_en: string;
  points_zh: string[];
  points_en: string[];
}
interface StudioDoc {
  title_zh: string;
  title_en: string;
  slides: Slide[];
  summary_zh: string;
  summary_en: string;
}
interface TraceStep {
  agent: string;
  step: string;
  i: number;
  total: number;
}

const TASKS = [
  { id: 'doc', icon: '📄', zh: '图文文档', en: 'Document' },
  { id: 'report', icon: '📊', zh: '学习报告', en: 'Report' },
  { id: 'poster', icon: '🖼️', zh: '海报文案', en: 'Poster' },
  { id: 'speech', icon: '🎤', zh: '演讲稿', en: 'Speech' },
  { id: 'lesson', icon: '📚', zh: '微课提纲', en: 'Lesson' },
];

export default function Studio() {
  const { t, i18n } = useTranslation();
  const zh = i18n.language === 'zh';
  const hskLevel = useStore((s) => s.hskLevel);

  const [taskType, setTaskType] = useState('doc');
  const [topic, setTopic] = useState('');
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [doc, setDoc] = useState<StudioDoc | null>(null);
  const [mock, setMock] = useState(false);
  const [running, setRunning] = useState(false);

  const generate = async () => {
    if (running) return;
    setRunning(true);
    setTrace([]);
    setDoc(null);
    try {
      const resp = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ taskType, topic, hskLevel }),
      });
      if (!resp.ok) {
        // gate/限流是 JSON 响应而非 SSE 流，按后端文案提示
        const j = (await resp.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error || `HTTP ${resp.status}`);
      }
      const reader = resp.body?.getReader();
      if (!reader) throw new Error('no stream');
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const ev = /event: (.*)/.exec(block)?.[1]?.trim();
          const dataM = /data: ([\s\S]*)/.exec(block)?.[1];
          if (!dataM) continue;
          const data = JSON.parse(dataM);
          if (ev === 'trace') setTrace((prev) => [...prev, data as TraceStep]);
          else if (ev === 'result') {
            setDoc(data.doc as StudioDoc);
            setMock(!!data.mock);
          }
        }
      }
    } catch {
      /* 出错忽略 */
    } finally {
      setRunning(false);
    }
  };

  const exportPpt = async () => {
    if (!doc) return;
    try {
      const PptxGenJS = (await import('pptxgenjs')).default;
      const p = new PptxGenJS();
      p.defineLayout({ name: 'W', width: 10, height: 5.63 });
      p.layout = 'W';
      const cover = p.addSlide();
      cover.background = { color: '0A1020' };
      cover.addText(doc.title_zh, { x: 0.5, y: 1.8, w: 9, h: 1, fontSize: 34, color: 'F5C542', bold: true, align: 'center' });
      cover.addText(doc.title_en, { x: 0.5, y: 2.9, w: 9, h: 0.6, fontSize: 18, color: 'FFFFFF', align: 'center' });
      cover.addText('寰语星球 · Huanyu Planet', { x: 0.5, y: 4.7, w: 9, h: 0.4, fontSize: 11, color: '7C9CFF', align: 'center' });
      for (const sl of doc.slides) {
        const s = p.addSlide();
        s.background = { color: '0E1530' };
        s.addText(`${sl.heading_zh}   ${sl.heading_en}`, { x: 0.4, y: 0.3, w: 9.2, h: 0.7, fontSize: 24, color: '3FD2FF', bold: true });
        const bullets = sl.points_zh.map((z, i) => ({
          text: `${z}\n${sl.points_en[i] || ''}`,
          options: { bullet: true, fontSize: 15, color: 'FFFFFF', breakLine: true, paraSpaceAfter: 12 },
        }));
        s.addText(bullets, { x: 0.7, y: 1.3, w: 8.6, h: 3.8, valign: 'top' });
      }
      await p.writeFile({ fileName: `${doc.title_zh || 'huanyu'}.pptx` });
    } catch {
      alert('PPT 导出需要 pptxgenjs，安装后重试。');
    }
  };

  const exportMd = () => {
    if (!doc) return;
    const md =
      `# ${doc.title_zh} / ${doc.title_en}\n\n` +
      doc.slides
        .map((sl) => `## ${sl.heading_zh} / ${sl.heading_en}\n` + sl.points_zh.map((z, i) => `- ${z} / ${sl.points_en[i] || ''}`).join('\n'))
        .join('\n\n') +
      `\n\n> ${doc.summary_zh}\n> ${doc.summary_en}\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = `${doc.title_zh || 'huanyu'}.md`;
    a.click();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen">
      <Hud />
      <BackButton to="/globe" />
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        <h1 className="text-3xl font-bold text-glow">🎬 {t('studio.title')}</h1>
        <p className="mt-2 text-white/60 text-sm">{t('studio.subtitle')}</p>

        {/* 任务类型 */}
        <div className="mt-6 flex flex-wrap gap-2">
          {TASKS.map((tk) => (
            <button
              key={tk.id}
              onClick={() => setTaskType(tk.id)}
              className={`px-3.5 py-2 rounded-xl text-sm transition ${taskType === tk.id ? 'btn-primary' : 'glass hover:border-starcyan/60'}`}
            >
              {tk.icon} {zh ? tk.zh : tk.en}
            </button>
          ))}
        </div>

        {/* 主题输入 + 生成 */}
        <div className="mt-4 flex gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            placeholder={t('studio.topicPlaceholder')}
            className="flex-1 rounded-xl bg-space-900/70 border border-white/15 px-4 py-2.5 text-sm outline-none focus:border-starcyan/60"
          />
          <button onClick={generate} disabled={running} className="btn-primary px-6 py-2.5 rounded-xl text-sm disabled:opacity-50">
            {running ? t('studio.generating') : `✨ ${t('studio.generate')}`}
          </button>
        </div>

        <div className="mt-8 grid lg:grid-cols-2 gap-6">
          {/* 智能体协作 trace */}
          <div className="glass rounded-3xl p-5">
            <h2 className="font-semibold text-glow mb-3">🤖 {t('studio.crew')}</h2>
            {trace.length === 0 && !running && <p className="text-white/45 text-sm">{t('studio.crewHint')}</p>}
            <div className="space-y-2">
              <AnimatePresence>
                {trace.map((s) => (
                  <motion.div
                    key={s.i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 text-sm glass rounded-xl px-3 py-2"
                  >
                    <span className="text-xs text-emerald-300">{s.i + 1}/{s.total}</span>
                    <span className="font-medium">{s.agent}</span>
                    <span className="text-white/55 text-xs">{s.step}</span>
                    <span className="ml-auto text-emerald-400">✓</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {running && trace.length < 6 && <div className="text-sm text-white/50 pl-1">{t('chat.thinking')}</div>}
            </div>
          </div>

          {/* 产出预览 */}
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-glow">📑 {t('studio.preview')}</h2>
              {doc && (
                <div className="flex gap-1.5">
                  <button onClick={exportPpt} className="text-xs btn-primary px-3 py-1.5 rounded-lg">📊 {t('studio.exportPpt')}</button>
                  <button onClick={exportMd} className="text-xs glass px-3 py-1.5 rounded-lg hover:border-starcyan/60">⬇ MD</button>
                </div>
              )}
            </div>
            {!doc && <p className="text-white/45 text-sm">{t('studio.previewHint')}</p>}
            {doc && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 className="text-lg font-bold text-gold">{doc.title_zh}</h3>
                <p className="text-xs text-white/50 mb-3">{doc.title_en}</p>
                {mock && <p className="text-[11px] text-amber-300 mb-2">{t('chat.demo')}</p>}
                <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
                  {doc.slides.map((sl, i) => (
                    <div key={i} className="bg-space-900/50 rounded-2xl p-3">
                      <div className="text-sm font-semibold text-starcyan">{sl.heading_zh} · {sl.heading_en}</div>
                      <ul className="mt-1.5 space-y-1">
                        {sl.points_zh.map((z, k) => (
                          <li key={k} className="text-xs text-white/80">
                            • {z}
                            {sl.points_en[k] && <span className="text-white/45"> / {sl.points_en[k]}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
