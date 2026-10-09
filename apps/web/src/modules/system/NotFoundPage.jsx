import { useNavigate } from 'react-router';
import { useSelector } from 'react-redux';
import { NotFound404, Page } from '@hms/ui';
import { roleHome } from '../../app/access.js';
import { selectSession } from '../../app/session.js';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { data } = useSelector(selectSession);
  return (
    <Page width="medium">
      <NotFound404 className="mt-8" onHome={() => navigate(data ? roleHome(data) : '/login')} />
    </Page>
  );
}
