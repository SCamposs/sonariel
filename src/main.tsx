import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/urbanist/700.css';
import '@fontsource/urbanist/800.css';
import '@fontsource/jetbrains-mono/400.css';
import { App } from './App';
import './styles.css';
import './ui/controls.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
