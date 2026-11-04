import { Link, useLocation, useNavigate } from 'react-router-dom';
import QreInlineSignIn from '@qre-theme/QreInlineSignIn.jsx';
import DevHeaderContinue from '@qre-theme/DevHeaderContinue.jsx';
import CertAuthShell from '../cert-studio/CertAuthShell.jsx';

export default function BuildLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  function afterSignIn() {
    const from = location.state?.from;
    navigate(typeof from === 'string' && from.startsWith('/') ? from : '/', { replace: true });
  }

  return (
    <CertAuthShell
      title="Sign in"
      subtitle="Access your Q-Forge projects, circuit IDE, and simulation workspace."
      footer={
        <div className="cert-auth-footer">
          <p>
            Need an account?{' '}
            <Link to="/register" className="cert-auth-link">
              Register here
            </Link>
          </p>
        </div>
      }
    >
      <QreInlineSignIn
        appName="Q-Forge"
        onSuccess={afterSignIn}
        devContinueSlot={<DevHeaderContinue />}
        hideDecorativeIcons
      />
    </CertAuthShell>
  );
}
