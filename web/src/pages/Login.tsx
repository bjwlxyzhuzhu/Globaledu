import { useTranslation } from 'react-i18next';
import Placeholder from '../components/Placeholder';

export default function Login() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.login')} milestone="M7" />;
}
