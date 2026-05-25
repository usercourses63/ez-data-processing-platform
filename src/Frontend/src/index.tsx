import React from 'react';
import ReactDOM from 'react-dom/client';

// Self-hosted Rubik font (replaces Google Fonts CDN). Each weight ships all
// subsets (latin, latin-ext, hebrew, cyrillic, arabic) with unicode-range, so
// browsers download only the glyphs they need.
import '@fontsource/rubik/300.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/600.css';
import '@fontsource/rubik/700.css';

import './index.css';
import App from './App';
import './i18n';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
