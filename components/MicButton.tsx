"use client";
// 语音输入按钮：点麦克风说话 → 实时转成文字回填输入框。基于浏览器原生 Web Speech API（Chrome/Edge 支持），零依赖。
import { useEffect, useRef, useState } from "react";

// 最小化 Web Speech API 类型（lib.dom 未内置 webkitSpeechRecognition）
type SRAlt = { transcript: string };
type SRResult = { isFinal: boolean; 0: SRAlt };
type SREvent = { resultIndex: number; results: { length: number; [i: number]: SRResult } };
type SR = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type SRCtor = new () => SR;

function getSRCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** 麦克风语音输入：识别到的文字通过 onText 回调交给父组件（一般是追加到输入框）。 */
export default function MicButton({ onText, accent = "#22d3ee", size = 42, title }: { onText: (t: string) => void; accent?: string; size?: number; title?: string }) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    setSupported(!!getSRCtor());
    return () => { try { recRef.current?.abort(); } catch { /* ignore */ } };
  }, []);

  function stop() { try { recRef.current?.stop(); } catch { /* ignore */ } setListening(false); }
  function start() {
    const Ctor = getSRCtor();
    if (!Ctor) { setSupported(false); return; }
    let rec = recRef.current;
    if (!rec) {
      rec = new Ctor();
      rec.lang = "zh-CN"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        let fin = "", itm = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const t = r[0]?.transcript || "";
          if (r.isFinal) fin += t; else itm += t;
        }
        setInterim(itm);
        if (fin) { onText(fin.trim()); setInterim(""); }
      };
      rec.onend = () => { setListening(false); setInterim(""); };
      rec.onerror = (ev) => {
        setListening(false); setInterim("");
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed")
          alert("麦克风未授权：请在浏览器地址栏点开权限、允许使用麦克风后重试。");
      };
      recRef.current = rec;
    }
    try { rec.start(); setListening(true); } catch { /* 已在录音 */ }
  }

  const base: React.CSSProperties = {
    width: size, height: size, flex: "0 0 auto", borderRadius: 11, display: "grid", placeItems: "center",
    fontSize: Math.round(size * 0.42), cursor: supported ? "pointer" : "not-allowed", fontFamily: "inherit",
    border: `1px solid ${listening ? "#ff5a6e" : "var(--line)"}`, background: listening ? "rgba(255,90,110,.16)" : "rgba(255,255,255,.04)",
    color: listening ? "#ff5a6e" : (supported ? accent : "var(--mut)"), position: "relative", transition: "all .15s",
    boxShadow: listening ? "0 0 0 4px rgba(255,90,110,.12)" : "none", opacity: supported ? 1 : 0.5,
  };

  if (!supported) {
    return <button type="button" disabled title="当前浏览器不支持语音输入，请用 Chrome 或 Edge" style={base}>🎤</button>;
  }
  return (
    <button type="button" onClick={() => (listening ? stop() : start())}
      title={listening ? "正在聆听…点击停止" : (title || "语音输入：点击说话")}
      style={{ ...base, animation: listening ? "micpulse 1.1s ease-in-out infinite" : "none" }}>
      {listening ? "■" : "🎤"}
      {interim && (
        <span style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, whiteSpace: "nowrap", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", padding: "5px 9px", borderRadius: 9, background: "rgba(8,12,30,.94)", border: `1px solid ${accent}66`, color: "#dce6ff", fontSize: 12, fontWeight: 500, boxShadow: "0 6px 18px #0008", pointerEvents: "none" }}>
          {interim}
        </span>
      )}
      <style>{`@keyframes micpulse{0%,100%{box-shadow:0 0 0 4px rgba(255,90,110,.10)}50%{box-shadow:0 0 0 7px rgba(255,90,110,.22)}}`}</style>
    </button>
  );
}
