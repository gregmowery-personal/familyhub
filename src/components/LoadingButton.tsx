import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export default function LoadingButton({
  loading = false,
  loadingText = 'Loading...',
  variant = 'primary',
  size = 'md',
  children,
  disabled,
  className = '',
  ...props
}: LoadingButtonProps) {
  const baseClasses = 'btn focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'btn-primary focus:ring-primary',
    secondary: 'btn-secondary focus:ring-secondary', 
    ghost: 'btn-ghost focus:ring-accent'
  };
  
  const sizeClasses = {
    sm: 'btn-sm min-h-[36px]',
    md: 'btn-md min-h-[44px]',
    lg: 'btn-lg min-h-[52px]'
  };

  const isDisabled = disabled || loading;

  return (
    <>
      <button
        {...props}
        disabled={isDisabled}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        aria-disabled={isDisabled}
        aria-describedby={loading ? `${props.id || 'button'}-loading-status` : undefined}
      >
        {loading && (
          <LoadingSpinner 
            size="sm" 
            className="mr-2"
            aria-hidden="true"
          />
        )}
        <span>{loading ? loadingText : children}</span>
      </button>
      
      {/* ARIA live region for loading state announcements */}
      {loading && (
        <div
          id={`${props.id || 'button'}-loading-status`}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {loadingText}
        </div>
      )}
    </>
  );
}