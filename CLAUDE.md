# Claude Project Documentation

## Project Overview
FamilyHub.care - A private, shared coordination tool for families coordinating life across generations. 
**IMPORTANT**: This is NOT for storing medical information - only scheduling and reminders.

## Target Audience
- Primary users: Caregivers aged 30-60
- Often stressed and not tech-savvy
- Managing care across multiple generations
- Need simple, accessible, and warm user experience

## 🎨 CRITICAL: UI/UX Design Standards - MUST READ FOR ALL UI WORK

### When Working on ANY UI Tasks
**YOU MUST:**
1. **Reference the Design Standards**: `/docs/DESIGN_STANDARDS.md`
2. **Follow the Implementation Guide**: `/docs/FRONTEND_IMPLEMENTATION_GUIDE.md`
3. **Use the Reference Component**: `/src/components/SignupPageRedesign.tsx` as the canonical example

### Design Philosophy
- **Warm & Human**: Calming colors (sage green, lavender), supportive messaging
- **Accessible**: WCAG AA compliant, 44px touch targets, high contrast
- **Simple**: Clear language, no jargon, intuitive navigation
- **Trustworthy**: Emphasis on privacy and security

### Key UI Patterns to Follow
- Sage Green (#87A89A) & Lavender (#9B98B0) color palette
- Rounded corners (12-24px radius)
- Generous padding (p-12/p-16)
- Soft shadows, gradient backgrounds
- Large, accessible form inputs
- Two-column layouts (brand messaging + interaction)

**ALWAYS** point team members to these resources when doing UI work!

## Tech Stack
- **Frontend**: React, Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Database**: Supabase PostgreSQL
- **Testing**: Jest, React Testing Library
- **AI**: OpenAI / Claude API (optional features)

## Project Structure
```
familyhub/
├── src/              # Source code
├── tests/            # Test files
├── docs/             # Documentation
└── scripts/          # Build and utility scripts
```

## Development Guidelines

### UI Development Checklist
Before creating or modifying ANY UI component:
- [ ] Read `/docs/DESIGN_STANDARDS.md`
- [ ] Review `/docs/FRONTEND_IMPLEMENTATION_GUIDE.md`
- [ ] Check `/src/components/SignupPageRedesign.tsx` for patterns
- [ ] Ensure WCAG AA accessibility compliance
- [ ] Test on mobile devices
- [ ] Use the established color palette
- [ ] Maintain consistent spacing and typography

### Code Style
- Use consistent indentation (2 spaces or 4 spaces)
- Follow language-specific conventions
- Write clear, self-documenting code
- Keep functions small and focused
- ALWAYS follow the design system for UI components

### Git Workflow
- Use descriptive commit messages
- Create feature branches for new work
- Keep commits atomic and focused

### Testing
- Write tests for new features
- Maintain test coverage
- Run tests before committing

## MVP Features
- Family dashboard with shared calendar & notes
- Task assignments with due dates and comments  
- Daily check-in prompts ("Soccer practice pickup?", "Homework done?", "Has Mom taken her meds?")
- Contact book for family, friends, doctors, schools, and service providers
- Private cloud document vault (school forms, insurance, POAs, appointments)
- Role-based access with multi-generational support (kids, parents, grandparents)

## Available Commands
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint

# Type check
npm run typecheck
```

## Architecture Decisions
[Document key architectural decisions here]

## API Documentation
[API endpoints and usage will be documented here]

## Database Schema
[Database structure will be documented here]

## Environment Variables
```
NODE_ENV=development
PORT=3000
DATABASE_URL=
API_KEY=
```

## Deployment
[Deployment instructions will be added here]

## Troubleshooting
[Common issues and solutions will be documented here]