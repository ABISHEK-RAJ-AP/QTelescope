import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ui/ThemeProvider.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx';
import App from './App.jsx';
import { initA11yFromStorage } from './lib/accessibilityPrefs.js';
import { A11yRuntimeEffects } from './components/shell/A11yRuntimeEffects.jsx';
import './index.css';

initA11yFromStorage();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light">
      <A11yRuntimeEffects />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/app/*" element={<App />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
