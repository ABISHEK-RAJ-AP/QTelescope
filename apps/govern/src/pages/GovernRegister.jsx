import QreAuthMarketingPage from '@qre-theme/QreAuthMarketingPage.jsx';
import QreInlineRegister from '@qre-theme/QreInlineRegister.jsx';

export default function GovernRegister({ onHome, onSignIn, onRegister, onRegistered, onFooterNavigate }) {
  return (
    <QreAuthMarketingPage
      activeAuth="register"
      wide
      title="Create Govern account"
      subtitle="Create an operator or researcher profile. Admin and approver roles are assigned by platform operators after sign-in."
      onHome={onHome}
      onSignIn={onSignIn}
      onRegister={onRegister}
      onFooterNavigate={onFooterNavigate}
    >
      {(fieldBridge) => (
        <QreInlineRegister
          onFieldChange={fieldBridge}
          onSuccess={onRegistered}
          footerLink={
            <div className="cert-auth-footer">
              <p>
                Already registered?{' '}
                <button type="button" className="cert-auth-link" onClick={onSignIn}>
                  Sign in
                </button>
              </p>
            </div>
          }
        />
      )}
    </QreAuthMarketingPage>
  );
}
