import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@spoonate/portal/index.css';
import App from './App.jsx';
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
