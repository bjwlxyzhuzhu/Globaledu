import { motion } from 'framer-motion';

// 星门 / 帷幕：两扇半屏向两侧拉开，露出后面的星球。
export default function Curtain({ open }: { open: boolean }) {
  const base = 'fixed top-0 bottom-0 w-1/2 z-20 pointer-events-none';
  const ease = [0.7, 0, 0.3, 1] as const;
  return (
    <>
      <motion.div
        className={`${base} left-0`}
        style={{
          background: 'linear-gradient(90deg, #05060f 60%, #0a0e22)',
          boxShadow: '40px 0 90px rgba(139,108,255,0.30)',
        }}
        initial={{ x: 0 }}
        animate={{ x: open ? '-100%' : 0 }}
        transition={{ duration: 1.2, ease }}
      >
        <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-transparent via-starviolet to-transparent" />
      </motion.div>
      <motion.div
        className={`${base} right-0`}
        style={{
          background: 'linear-gradient(270deg, #05060f 60%, #0a0e22)',
          boxShadow: '-40px 0 90px rgba(63,210,255,0.30)',
        }}
        initial={{ x: 0 }}
        animate={{ x: open ? '100%' : 0 }}
        transition={{ duration: 1.2, ease }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-transparent via-starcyan to-transparent" />
      </motion.div>
    </>
  );
}
