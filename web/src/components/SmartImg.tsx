import { useEffect, useRef, useState, type ReactNode } from 'react';

// 全局图片加载限流（信号量）：pollinations 并发出图会被限流，故串行化——最多 MAX 张同时加载，
// 其余排队。配合失败重试+退避，让一页多张 AI 图几乎都能最终加载；彻底失败再回退 fallback。
let active = 0;
const MAX = 4;
const waiters: Array<() => void> = [];
function acquire(): Promise<void> {
  if (active < MAX) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiters.push(resolve));
}
function release() {
  const next = waiters.shift();
  if (next) next(); // 名额转交下一位（active 不变）
  else active = Math.max(0, active - 1);
}

export default function SmartImg({
  src,
  alt,
  className,
  fallback,
  maxRetry = 2,
}: {
  src: string;
  alt?: string;
  className?: string;
  fallback: ReactNode;
  maxRetry?: number;
}) {
  const [realSrc, setRealSrc] = useState<string | null>(null);
  const [dead, setDead] = useState(false);
  const triesRef = useRef(0);
  const hasSlotRef = useRef(false);
  const cancelledRef = useRef(false);

  const giveBack = () => {
    if (hasSlotRef.current) {
      hasSlotRef.current = false;
      release();
    }
  };
  const start = () => {
    acquire().then(() => {
      if (cancelledRef.current) {
        release();
        return;
      }
      hasSlotRef.current = true;
      setRealSrc(triesRef.current ? `${src}&_r=${triesRef.current}` : src);
    });
  };

  useEffect(() => {
    cancelledRef.current = false;
    triesRef.current = 0;
    hasSlotRef.current = false;
    setDead(false);
    setRealSrc(null);
    start();
    return () => {
      cancelledRef.current = true;
      giveBack();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (dead) return <>{fallback}</>;
  return (
    <>
      {!realSrc && fallback}
      {realSrc && (
        <img
          src={realSrc}
          alt={alt}
          className={className}
          onLoad={giveBack}
          onError={() => {
            giveBack();
            if (triesRef.current < maxRetry) {
              triesRef.current += 1;
              setRealSrc(null);
              setTimeout(() => {
                if (!cancelledRef.current) start();
              }, 1500 + triesRef.current * 2500);
            } else {
              setDead(true);
            }
          }}
        />
      )}
    </>
  );
}
