import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { TradingProvider } from './context/TradingContext.jsx';
import { PortfolioProvider } from './context/PortfolioContext.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <TradingProvider>
        <PortfolioProvider>
          <App />
        </PortfolioProvider>
      </TradingProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
