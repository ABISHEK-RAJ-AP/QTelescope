import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { initTheme } from '@qre-theme/theme.js';
import '@qre-theme/tokens.css';
import '@qre-theme/shell.css';
import './index.css';
import './studio.css';
import './styles/cert-public-marketing.css';

initTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename="/build">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
