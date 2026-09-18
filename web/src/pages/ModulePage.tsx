import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import Placeholder from '../components/Placeholder';

// /module/:moduleId —— M4 起逐个模块实现（首发：汉字闯关 hanzi）。
export default function ModulePage() {
  const { t } = useTranslation();
  const { moduleId } = useParams();
  return <Placeholder title={`${t('pages.module')}：${moduleId ?? ''}`} milestone="M4" />;
}
