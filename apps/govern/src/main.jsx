import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initTheme } from '@qre-theme/theme.js';
import '@qre-theme/tokens.css';
import '@qre-theme/shell.css';
import '@qre-theme/cert-studio/cert-studio-marketing.css';
import '@qre-theme/cert-studio/cert-studio-public-chrome.css';
import '@qre-theme/cert-studio/qre-public-landing-polish.css';
import '@qre-theme/cert-studio/studio-feature-grid.css';
import './styles/dashboard-surface.css';
import './styles/govern-app-chrome.css';
import './govern.css';
import './index.css';

initTheme();

createRoot(document.getElementById('root')).render(<App />);
