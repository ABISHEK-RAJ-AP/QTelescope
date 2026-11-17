import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { GovernSessionProvider } from './hooks/useGovernSession.js';
import { initTheme } from '@qre-theme/theme.js';
import '@qre-theme/tokens.css';
import '@qre-theme/shell.css';
import './styles/dashboard-surface.css';
import './styles/govern-app-chrome.css';
import './govern.css';
import './index.css';

initTheme();

createRoot(document.getElementById('root')).render(
  <GovernSessionProvider>
    <App />
  </GovernSessionProvider>,
);
