import React from 'react';
import ReactDOM from 'react-dom/client';
// Base styles first so component stylesheets can override them.
import './styles/global.scss';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
