import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-dark-900 text-slate-200 flex flex-col items-center justify-center p-6 font-mono select-none">
          <div className="max-w-md w-full bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-trade-red/10 border border-trade-red/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-trade-red" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Terminal Error Recovered</h2>
              <p className="text-xs text-slate-400 mt-1">
                An unexpected interface error was intercepted safely without freezing your workspace.
              </p>
              {this.state.error?.message && (
                <div className="mt-3 p-2 bg-dark-900 border border-dark-700 rounded text-[11px] text-slate-400 font-mono text-left overflow-x-auto">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <button
              onClick={this.handleReload}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-brand-accent hover:bg-brand-accent/90 text-white font-semibold text-xs transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Terminal</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
