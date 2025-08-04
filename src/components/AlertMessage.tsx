import React from 'react';

interface AlertMessageProps {
  type: 'error' | 'success' | 'info' | 'warning';
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export default function AlertMessage({ 
  type, 
  title, 
  message, 
  onDismiss, 
  className = '' 
}: AlertMessageProps) {
  const alertClasses = {
    error: 'alert-error border-error/20 bg-error/10',
    success: 'alert-success border-success/20 bg-success/10',
    info: 'alert-info border-info/20 bg-info/10',
    warning: 'alert-warning border-warning/20 bg-warning/10'
  };

  const iconMapping = {
    error: (
      <svg 
        className="stroke-current shrink-0 w-6 h-6" 
        fill="none" 
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
      </svg>
    ),
    success: (
      <svg 
        className="stroke-current shrink-0 w-6 h-6" 
        fill="none" 
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
      </svg>
    ),
    info: (
      <svg 
        className="stroke-current shrink-0 w-6 h-6" 
        fill="none" 
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
      </svg>
    ),
    warning: (
      <svg 
        className="stroke-current shrink-0 w-6 h-6" 
        fill="none" 
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth="2" 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" 
        />
      </svg>
    )
  };

  return (
    <div 
      className={`alert border-2 p-4 rounded-lg ${alertClasses[type]} ${className}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {iconMapping[type]}
      <div className="flex-1">
        {title && (
          <h3 className="font-semibold text-sm mb-1">
            {title}
          </h3>
        )}
        <p className="text-sm leading-relaxed">
          {message}
        </p>
      </div>
      
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="btn btn-sm btn-ghost min-h-[32px] h-8 w-8 p-0"
          aria-label="Dismiss message"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M6 18L18 6M6 6l12 12" 
            />
          </svg>
        </button>
      )}
    </div>
  );
}