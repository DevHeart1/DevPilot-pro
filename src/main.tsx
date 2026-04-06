import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import { config } from './lib/config/env';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Auth0Provider
      domain={config.auth0Domain}
      clientId={config.auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: config.auth0Audience,
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Auth0Provider>
  </StrictMode>,
);
