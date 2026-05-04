import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DebugProvider } from './components/debug/DebugProvider';
import './index.css';
import 'leaflet/dist/leaflet.css';

createRoot(document.getElementById('root')!).render(
  <DebugProvider>
    <App />
  </DebugProvider>
);