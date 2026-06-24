import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './zh.json';
import en from './en.json';
import fr from './fr.json';
import es from './es.json';
import ru from './ru.json';
import ar from './ar.json';
import de from './de.json';

const SUPPORTED = ['zh', 'en', 'fr', 'es', 'ru', 'ar', 'de'];

// 默认语言：localStorage > 浏览器语言 > 中文（localStorage 包 try/catch，防预览沙箱崩页）
function detectLang(): string {
  try {
    const saved = localStorage.getItem('hyxq_lang');
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch {
    /* 预览沙箱禁用 localStorage 时忽略 */
  }
  const nav = ((typeof navigator !== 'undefined' && navigator.language) || 'zh').toLowerCase();
  if (nav.startsWith('zh')) return 'zh';
  const two = nav.slice(0, 2);
  return SUPPORTED.includes(two) ? two : 'en';
}

// 缺失的键回退到英文（渐进式本地化：5 门新语言只译了主界面，其余自动回退 en）
i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
    fr: { translation: fr },
    es: { translation: es },
    ru: { translation: ru },
    ar: { translation: ar },
    de: { translation: de },
  },
  lng: detectLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// 若用户尚未显式选过语言，把检测到的语言写回，保持 store 与 i18n 一致
try {
  if (!localStorage.getItem('hyxq_lang')) localStorage.setItem('hyxq_lang', i18n.language);
} catch {
  /* ignore */
}

// 整体布局锁定 LTR（不随阿语镜像，避免界面左右颠倒迷路）。
// 阿语文字本身仍由浏览器 bidi 正确从右往左渲染；对话中的阿语气泡在 GradedChat 内单独 dir=rtl。
function applyDir(lng: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = lng;
  }
}
applyDir(i18n.language);
i18n.on('languageChanged', applyDir);

export default i18n;
