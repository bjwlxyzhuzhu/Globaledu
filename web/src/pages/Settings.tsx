import { useTranslation } from 'react-i18next';
import Placeholder from '../components/Placeholder';

export default function Settings() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.settings')} milestone="M7" />;
}
