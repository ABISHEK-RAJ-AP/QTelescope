import QreAuthMarketingPage from '@qre-theme/QreAuthMarketingPage.jsx';
import QreInlineSignIn from '@qre-theme/QreInlineSignIn.jsx';
export default function GovernSignIn({ onDevContinue, onSignedIn, onHome, onSignIn, onRegister, onFooterNavigate }) {
  return (
    <QreAuthMarketingPage
      activeAuth="sign-in"
      title="Sign in to Govern"
      subtitle="Use your Quantum Resource Engine credentials. The portal opens approvals, inventory, metering, and audit for your tenant."
      onHome={onHome}
      onSignIn={onSignIn}
      onRegister={onRegister}
      onFooterNavigate={onFooterNavigate}
    >
      {(fieldBridge) => (
        <QreInlineSignIn
          appName="Govern"
          hideDecorativeIcons
          onFieldChange={fieldBridge}
          onRegister={onRegister}
          onForgotPassword={() => {
            onHome?.();
            window.setTimeout(() => {
              document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
            }, 80);
          }}
          onSuccess={() => {
            onDevContinue?.();
            onSignedIn?.();
            window.location.reload();
          }}
        />
      )}
    </QreAuthMarketingPage>
  );
}
