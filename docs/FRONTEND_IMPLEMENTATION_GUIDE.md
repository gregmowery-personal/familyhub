# Frontend Implementation Guide

## Quick Start

The new design standard for FamilyHub is implemented in `/src/components/SignupPageRedesign.tsx`. This component should be used as the reference for all new UI development.

## Required Setup

### 1. Tailwind Configuration
Ensure your Tailwind config includes these color extensions:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Sage Green palette
        'brand-sage': '#87A89A',
        'brand-sage-light': '#C5DAD1',
        
        // Lavender palette  
        'brand-lavender': '#9B98B0',
        
        // Use Tailwind's built-in colors for consistency
        // emerald, purple, slate are already configured
      }
    }
  }
}
```

### 2. Global CSS Variables
Add to your global CSS:

```css
:root {
  /* Brand Colors */
  --sage-primary: #87A89A;
  --sage-light: #C5DAD1;
  --lavender-primary: #9B98B0;
  
  /* Spacing Units (8px base) */
  --spacing-unit: 0.5rem;
  
  /* Border Radius */
  --radius-sm: 0.75rem;  /* 12px */
  --radius-md: 1rem;     /* 16px */
  --radius-lg: 1.5rem;   /* 24px */
  --radius-xl: 2rem;     /* 32px */
}
```

## Component Templates

### Page Layout Template
```tsx
export default function PageName() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-0 bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Left: Brand/Content Section */}
          <div className="bg-gradient-to-br from-purple-50 via-emerald-50/40 to-slate-50 p-12 lg:p-16">
            {/* Your brand content */}
          </div>
          
          {/* Right: Interactive Section */}
          <div className="p-12 lg:p-16 bg-white">
            {/* Your form/interactive content */}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Form Input Template
```tsx
<div>
  <label htmlFor="fieldName" className="block text-sm font-medium text-slate-700 mb-1.5">
    Field Label
  </label>
  <input
    id="fieldName"
    name="fieldName"
    type="text"
    value={formData.fieldName}
    onChange={handleInputChange}
    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl 
      focus:outline-none focus:ring-2 focus:ring-purple-500/20 
      focus:border-purple-500 transition-colors text-slate-800 ${
      errors.fieldName ? 'border-red-300 bg-red-50/50' : 'border-slate-200'
    }`}
    placeholder="Helpful placeholder"
    required
  />
  {errors.fieldName && (
    <p className="mt-1 text-sm text-red-600">{errors.fieldName}</p>
  )}
</div>
```

### Button Templates
```tsx
{/* Primary Button */}
<button
  type="submit"
  className="w-full py-3.5 px-6 bg-gradient-to-r from-purple-600 to-purple-700 
    hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-xl 
    shadow-sm hover:shadow-md transform hover:-translate-y-0.5 
    transition-all duration-200"
>
  Primary Action
</button>

{/* Secondary Button */}
<button
  type="button"
  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl 
    hover:bg-slate-50 transition-colors font-medium text-slate-700"
>
  Secondary Action
</button>

{/* Ghost Button */}
<button
  type="button"
  className="text-purple-600 hover:text-purple-700 font-medium 
    underline-offset-2 hover:underline transition-colors"
>
  Tertiary Action
</button>
```

### Alert/Message Templates
```tsx
{/* Success Message */}
<div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
  <p className="text-emerald-800 text-sm font-medium">{successMessage}</p>
</div>

{/* Error Message */}
<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
  <p className="text-red-800 text-sm font-medium">{errorMessage}</p>
</div>

{/* Info Message */}
<div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
  <p className="text-blue-800 text-sm font-medium">{infoMessage}</p>
</div>
```

## Common Patterns

### Loading States
```tsx
{isLoading ? (
  <span className="flex items-center justify-center gap-2">
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" 
        stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
    Loading...
  </span>
) : (
  'Submit'
)}
```

### Trust Signals List
```tsx
<ul className="space-y-4 pt-6">
  <li className="flex items-center gap-3">
    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
      <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    </div>
    <span className="text-slate-700 font-medium">Trust signal text</span>
  </li>
</ul>
```

## Responsive Design

### Breakpoint Strategy
```tsx
// Mobile First Approach
className="
  text-base           // Mobile: 16px
  sm:text-lg          // Small tablets: 18px
  md:text-xl          // Tablets: 20px
  lg:text-2xl         // Desktop: 24px
  
  p-4                 // Mobile: 16px padding
  sm:p-6              // Small tablets: 24px
  md:p-8              // Tablets: 32px
  lg:p-12             // Desktop: 48px
"
```

### Grid Layouts
```tsx
// Responsive grid
className="
  grid 
  grid-cols-1         // Mobile: Single column
  sm:grid-cols-2      // Tablet: Two columns
  lg:grid-cols-3      // Desktop: Three columns
  gap-4 sm:gap-6 lg:gap-8
"
```

## Accessibility Implementation

### Focus Management
```tsx
// Visible focus states
className="focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"

// Skip links
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

### ARIA Labels
```tsx
// Buttons
<button aria-label="Close dialog" aria-expanded={isOpen}>

// Form inputs
<input aria-invalid={hasError} aria-describedby="field-error">

// Loading states
<div role="status" aria-live="polite">
  <span className="sr-only">Loading...</span>
</div>
```

## Animation Guidelines

### Micro-interactions
```tsx
// Hover lift effect
className="transform hover:-translate-y-0.5 transition-all duration-200"

// Smooth color transitions
className="transition-colors duration-200"

// Scale on interaction
className="hover:scale-105 transition-transform duration-200"
```

### Page Transitions
```tsx
// Fade in animation
className="animate-fadeIn"

// Add to global CSS
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}
```

## State Management Patterns

### Form State
```tsx
const [formData, setFormData] = useState({
  firstName: '',
  lastName: '',
  email: '',
});

const [errors, setErrors] = useState({});
const [isLoading, setIsLoading] = useState(false);

const handleInputChange = (e) => {
  const { name, value } = e.target;
  setFormData(prev => ({ ...prev, [name]: value }));
  // Clear error when user types
  if (errors[name]) {
    setErrors(prev => ({ ...prev, [name]: '' }));
  }
};
```

## Performance Considerations

### Image Optimization
```tsx
// Use Next.js Image component
import Image from 'next/image';

<Image
  src="/path/to/image"
  alt="Description"
  width={500}
  height={300}
  loading="lazy"
  className="rounded-xl"
/>
```

### Code Splitting
```tsx
// Lazy load heavy components
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <LoadingSpinner />,
  ssr: false
});
```

## Testing Checklist

Before deploying any new component:

- [ ] Test on mobile devices (320px - 768px)
- [ ] Test on tablets (768px - 1024px)
- [ ] Test on desktop (1024px+)
- [ ] Verify 200% zoom functionality
- [ ] Check keyboard navigation
- [ ] Test with screen reader
- [ ] Verify color contrast (use Chrome DevTools)
- [ ] Test loading states
- [ ] Check error states
- [ ] Verify form validation
- [ ] Test with slow network (Chrome DevTools throttling)

## Common Pitfalls to Avoid

1. **Don't use fixed heights** - Use min-height instead
2. **Don't forget focus states** - Every interactive element needs them
3. **Don't use px for text** - Use rem for better accessibility
4. **Don't skip semantic HTML** - Use proper headings, buttons, etc.
5. **Don't forget loading states** - Every async action needs feedback
6. **Don't use color alone** - Add icons or text for clarity
7. **Don't make touch targets too small** - Minimum 44px

## Resources

- Reference Implementation: `/src/components/SignupPageRedesign.tsx`
- Design Standards: `/docs/DESIGN_STANDARDS.md`
- Tailwind CSS Docs: https://tailwindcss.com/docs
- WCAG Guidelines: https://www.w3.org/WAI/WCAG21/quickref/

## Getting Help

1. Check the SignupPageRedesign component first
2. Review this guide and DESIGN_STANDARDS.md
3. Test your implementation against the checklist
4. Ask for design review before major releases

Remember: We're building for stressed caregivers. Every line of code should make their lives easier.