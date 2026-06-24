import { useTranslation } from 'react-i18next';
import Placeholder from '../components/Placeholder';

export default function NotFound() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.notFound')} />;
}
