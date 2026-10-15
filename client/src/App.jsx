import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppRouter } from './router/AppRouter';
import { ErrorBoundary } from './pages/system/SystemPages';

export function App() {
  return (
    <ErrorBoundary fullPage>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
