import { Link, useNavigate } from 'react-router-dom';
import QreInlineRegister from '@qre-theme/QreInlineRegister.jsx';
import CertAuthShell from '../cert-studio/CertAuthShell.jsx';

export default function BuildRegisterPage() {
  const navigate = useNavigate();

  function afterRegister() {
    window.setTimeout(() => navigate('/login', { replace: true }), 900);
  }

  return (
    <CertAuthShell
      title="Create account"
      subtitle="Register to create projects and use the Q-Forge circuit IDE."
      maxWidth={520}
      footer={
        <div className="cert-auth-footer">
          <p>
            Already registered?{' '}
            <Link to="/login" className="cert-auth-link">
              Sign in here
            </Link>
          </p>
        </div>
      }
    >
      <QreInlineRegister onSuccess={afterRegister} />
    </CertAuthShell>
  );
}
