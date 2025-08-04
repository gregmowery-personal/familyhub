# FamilyHub Design Standards

## Overview
This document establishes the design standards for FamilyHub.care based on our new signup page design. All UI components and pages should follow these guidelines to maintain consistency and create a warm, accessible experience for our users (primarily caregivers aged 30-60).

**Reference Implementation:** `/src/components/SignupPageRedesign.tsx`

## Core Design Principles

### 1. Human-Centered & Warm
- Use calming, supportive language that acknowledges the challenges of caregiving
- Avoid technical jargon - write for non-tech-savvy users
- Lead with empathy and understanding in all messaging

### 2. Accessibility First
- WCAG AA compliance is mandatory
- Minimum 44px touch targets on all interactive elements
- 4.5:1 contrast ratio for all text
- Clear focus indicators on all interactive elements
- Proper ARIA labels and semantic HTML

### 3. Trust & Security
- Always emphasize privacy and security
- Use trust signals (checkmarks, testimonials, security badges)
- Clear, transparent communication about data usage

## Color Palette

### Primary Colors
```css
/* Sage Green - Primary accent for positive actions */
--color-emerald: #87A89A;
--color-emerald-light: #C5DAD1;
--color-emerald-50: rgb(236 253 245);
--color-emerald-100: rgb(209 250 229);
--color-emerald-600: rgb(5 150 105);

/* Lavender - Secondary accent for warmth */
--color-purple: #9B98B0;
--color-purple-50: rgb(250 245 255);
--color-purple-500: rgb(168 85 247);
--color-purple-600: rgb(147 51 234);
--color-purple-700: rgb(126 34 206);

/* Neutral Grays - Text and UI elements */
--color-slate-50: rgb(248 250 252);
--color-slate-100: rgb(241 245 249);
--color-slate-200: rgb(226 232 240);
--color-slate-500: rgb(100 116 139);
--color-slate-600: rgb(71 85 105);
--color-slate-700: rgb(51 65 85);
--color-slate-800: rgb(30 41 59);
```

### Gradient Backgrounds
```css
/* Main page background */
background: linear-gradient(to bottom right, 
  from-slate-50, 
  via-purple-50/30, 
  to-emerald-50/20
);

/* Brand section background */
background: linear-gradient(to bottom right,
  from-purple-50,
  via-emerald-50/40,
  to-slate-50
);

/* Button gradients */
background: linear-gradient(to right,
  from-purple-600,
  to-purple-700
);
```

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

### Font Sizes & Weights
- **Headings:**
  - H1: 2.5rem-5rem (responsive), font-bold
  - H2: 2rem-4rem (responsive), font-bold
  - H3: 1.5rem-2rem, font-semibold

- **Body Text:**
  - Large: 1.125rem (18px), leading-relaxed
  - Regular: 1rem (16px), leading-normal
  - Small: 0.875rem (14px)

- **Readability:**
  - Line height: 1.5-1.75 for body text
  - Max line length: 65-75 characters for optimal reading
  - Generous spacing between sections

## Component Patterns

### Forms

#### Input Fields
```tsx
/* Standard input field styling */
className="w-full px-4 py-3 bg-slate-50 border rounded-xl 
  focus:outline-none focus:ring-2 focus:ring-purple-500/20 
  focus:border-purple-500 transition-colors text-slate-800"

/* Error state */
className="border-red-300 bg-red-50/50"
```

- Minimum height: 48px (py-3 with proper font size)
- Background: Light gray (bg-slate-50) for better visibility
- Border radius: Rounded (rounded-xl) for softer appearance
- Clear focus states with ring effect
- Generous padding for easy touch targets

#### Buttons
```tsx
/* Primary button */
className="w-full py-3.5 px-6 bg-gradient-to-r from-purple-600 to-purple-700 
  hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-xl 
  shadow-sm hover:shadow-md transform hover:-translate-y-0.5 
  transition-all duration-200"

/* Secondary button */
className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl 
  hover:bg-slate-50 transition-colors"
```

- Minimum height: 48px
- Clear hover states with subtle animations
- Gradient backgrounds for primary actions
- Rounded corners for friendliness

### Cards & Containers
```tsx
/* Main container */
className="bg-white rounded-3xl shadow-xl overflow-hidden"

/* Card sections */
className="p-12 lg:p-16"
```

- Large border radius (rounded-3xl) for main containers
- Generous padding for breathing room
- Soft shadows for depth without harshness

### Layout Patterns

#### Two-Column Split Layout
- Left side: Brand messaging, value proposition, trust signals
- Right side: Forms or interactive content
- Mobile: Stack vertically with brand section first

#### Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## Iconography

### Style Guidelines
- Use emoji icons for warmth and approachability
- Alternatively, use simple SVG icons with rounded edges
- Consistent size: 24-48px depending on context
- Colors should match the component's color scheme

### Common Icons
- ✓ Checkmark (success, features)
- 🛡️ Shield (security, privacy)
- 💚 Heart (care, family)
- 📅 Calendar (scheduling)
- 🤝 Hands (collaboration)

## Messaging & Copy

### Voice & Tone
- **Warm and supportive:** "We understand caregiving can be overwhelming"
- **Clear and simple:** Avoid technical terms
- **Encouraging:** "You've got this, and we're here to help"
- **Inclusive:** Consider multi-generational users

### Key Messages
1. **Headlines:** Focus on emotional benefits, not features
   - Good: "Family life, beautifully organized"
   - Avoid: "Advanced scheduling system"

2. **CTAs:** Action-oriented and encouraging
   - Good: "Start Organizing Today"
   - Avoid: "Submit" or "Click Here"

3. **Error Messages:** Helpful and non-technical
   - Good: "Please enter a valid email address"
   - Avoid: "Invalid email format"

## Accessibility Checklist

### Every Component Must:
- [ ] Meet WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text)
- [ ] Have 44px minimum touch targets
- [ ] Include proper ARIA labels
- [ ] Support keyboard navigation
- [ ] Have visible focus indicators
- [ ] Work with screen readers
- [ ] Be tested at 200% zoom

### Form Specific:
- [ ] Label all inputs clearly
- [ ] Provide helpful error messages
- [ ] Group related fields
- [ ] Mark required fields
- [ ] Support autofill

## Implementation Guidelines

### For Frontend Engineers

1. **Use the SignupPageRedesign as reference:**
   ```bash
   src/components/SignupPageRedesign.tsx
   ```

2. **Maintain consistency:**
   - Import and extend existing utility classes
   - Use the established color variables
   - Follow the spacing system (4px base unit)

3. **Component Structure:**
   ```tsx
   // Standard component wrapper
   <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-emerald-50/20">
     <div className="container mx-auto px-4">
       {/* Content */}
     </div>
   </div>
   ```

4. **Responsive Design:**
   - Mobile-first approach
   - Use Tailwind's responsive prefixes (sm:, md:, lg:)
   - Test on actual devices, not just browser DevTools

5. **Performance:**
   - Lazy load images
   - Minimize JavaScript for better performance on older devices
   - Ensure smooth animations (use transform over position changes)

### For UI Designers

1. **Design Files Setup:**
   - Use 8px grid system
   - Set up color styles matching our palette
   - Create component library based on SignupPageRedesign

2. **Key Design Elements:**
   - Rounded corners (12-24px radius)
   - Soft shadows (avoid harsh drop shadows)
   - Gradient overlays for visual interest
   - White space for breathing room

3. **Prototyping:**
   - Show hover states for all interactive elements
   - Include loading states
   - Design for both light and eventual dark mode

## Testing Requirements

### Visual Testing
- Test on multiple screen sizes (320px - 1920px width)
- Verify at 200% browser zoom
- Check with Windows High Contrast mode
- Test with browser reading mode

### User Testing
- Test with users aged 30-60
- Include users with varying tech proficiency
- Test with actual caregivers when possible
- Gather feedback on readability and ease of use

## Migration Path

### Updating Existing Components

1. **Priority Order:**
   - Authentication pages (login, password reset)
   - Dashboard
   - Settings pages
   - Secondary features

2. **Gradual Migration:**
   - Update color palette globally first
   - Update typography system
   - Refactor components one by one
   - Maintain backwards compatibility during transition

3. **Component Checklist:**
   When updating a component, ensure:
   - [ ] Colors match new palette
   - [ ] Typography follows new standards
   - [ ] Spacing is consistent (use p-12/16 pattern)
   - [ ] Accessibility requirements are met
   - [ ] Mobile responsiveness is tested
   - [ ] Loading states are smooth

## Questions & Support

For questions about these design standards:
1. Reference the SignupPageRedesign component
2. Check this documentation
3. Consult with the design team lead

Remember: Our users are often stressed caregivers. Every design decision should make their lives easier, not harder.

---

*Last Updated: Today*
*Reference Implementation: `/src/components/SignupPageRedesign.tsx`*