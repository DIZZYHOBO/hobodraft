import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import './theme/variables.css';

import { setupIonicReact } from '@ionic/react';

setupIonicReact({ mode: 'ios' });

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
