import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext.jsx';

export default function ToastContainer() {
  const { toasts } = usePortfolio();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm font-mono text-xs select-none">
      {toasts.map(toast => {
        let bg = 'bg-dark-750 border-dark-600 text-slate-100';
        let Icon = Info;
        let iconColor = 'text-brand-accent';

        if (toast.type === 'success') {
          bg = 'bg-dark-800 border-trade-green/40 text-white';
          Icon = CheckCircle2;
          iconColor = 'text-trade-green';
        } else if (toast.type === 'error') {
          bg = 'bg-dark-800 border-trade-red/40 text-white';
          Icon = AlertCircle;
          iconColor = 'text-trade-red';
        } else if (toast.type === 'warning') {
          bg = 'bg-dark-800 border-brand-gold/40 text-white';
          Icon = AlertTriangle;
          iconColor = 'text-brand-gold';
        }

        return (
          <div
            key={toast.id}
            className={`flex items-start space-x-2.5 p-3 rounded-lg border shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-right-4 duration-200 pointer-events-auto ${bg}`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 text-[11px] leading-relaxed break-words">
              {toast.message}
            </div>
          </div>
        );
      })}
    </div>
  );
}
