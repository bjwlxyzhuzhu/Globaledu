import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

// 本文件位于 server/lib/，数据目录在仓库根的 data/
export const DATA_DIR = path.resolve(import.meta.dirname, '../../data');

/** 读取 data 下的 JSON 文件；不存在或出错时返回 fallback（优雅降级）。 */
export async function readJson<T>(rel: string, fallback: T): Promise<T> {
  try {
    const p = path.join(DATA_DIR, rel);
    if (!existsSync(p)) return fallback;
    return JSON.parse(await readFile(p, 'utf-8')) as T;
  } catch (e) {
    console.warn('[data] 读取失败', rel, (e as Error).message);
    return fallback;
  }
}
