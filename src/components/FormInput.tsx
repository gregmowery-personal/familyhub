import React, { forwardRef, useId } from 'react';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  showRequiredIndicator?: boolean;
}

const FormInput = forwardRef<HTMLInputElement, FormInputProps>(({
  label,
  error,
  helperText,
  required = false,
  showRequiredIndicator = true,
  className = '',
  id,
  ...props
}, ref) => {
  const generatedId = useId();
  const inputId = id || `input-${generatedId}`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  
  const hasError = !!error;
  
  return (
    <div className="form-control w-full">
      <label htmlFor={inputId} className="label">
        <span className="label-text text-base font-medium text-neutral-800">
          {label}
          {required && showRequiredIndicator && (
            <span className="text-error ml-1" aria-label="required">*</span>
          )}
        </span>
      </label>
      
      <input
        ref={ref}
        id={inputId}
        className={`
          input input-bordered w-full text-base
          min-h-[44px] px-4 py-3
          !text-neutral-800 !bg-white
          transition-all duration-200
          ${hasError 
            ? 'input-error border-2 focus:border-error focus:ring-error/20' 
            : 'border-2 border-base-300 focus:border-primary focus:ring-primary/20'
          }
          focus:ring-4 focus:outline-none
          disabled:opacity-60 disabled:cursor-not-allowed
          placeholder:text-neutral-400
          ${className}
        `}
        style={{ color: '#374151', backgroundColor: '#ffffff' }}
        aria-invalid={hasError}
        aria-describedby={`${hasError ? errorId : ''} ${helperText ? helperId : ''}`.trim()}
        required={required}
        {...props}
      />
      
      {/* Helper text */}
      {helperText && !hasError && (
        <div className="label">
          <span id={helperId} className="label-text-alt text-neutral-600">
            {helperText}
          </span>
        </div>
      )}
      
      {/* Error message */}
      {hasError && (
        <div className="label">
          <span 
            id={errorId} 
            className="label-text-alt text-error font-medium"
            role="alert"
            aria-live="polite"
          >
            {error}
          </span>
        </div>
      )}
    </div>
  );
});

FormInput.displayName = 'FormInput';

export default FormInput;