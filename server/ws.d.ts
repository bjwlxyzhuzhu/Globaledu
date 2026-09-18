// ws 包无随附类型声明；edge-tts(server/tts/edge.ts) 用到它。补一个最简声明避免 TS7016。
// 如需完整类型可改为 `pnpm -C server add -D @types/ws`。
declare module 'ws';
