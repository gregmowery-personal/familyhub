# 🏡 FamilyHub.care

**A private, shared coordination tool for families coordinating life across generations.**  
FamilyHub.care helps families of all types stay connected with shared calendars, task coordination, check-ins, and important information — from busy parents managing kids' schedules to families caring for aging loved ones.

---

## 🚀 MVP Features

- ✅ Family dashboard with shared calendar & notes  
- ✅ Task assignments with due dates and comments  
- ✅ Daily check-in prompts ("Soccer practice pickup?", "Homework done?", "Has Mom taken her meds?")  
- ✅ Contact book for family, friends, doctors, schools, and service providers  
- ✅ Private cloud document vault (school forms, insurance, contacts, appointments)  
- ✅ Role-based access with age-appropriate interfaces (kids, parents, grandparents)

---

## 🛠 Tech Stack

- **Frontend**: React + Tailwind CSS  
- **Backend**: Supabase (PostgreSQL + Auth + Storage)  
- **AI Assistant**: OpenAI / Claude (optional for task summarization or help)  
- **Hosting**: Vercel / Netlify  
- **Auth**: Supabase Auth with Magic Link & OAuth options  
- **Storage**: Supabase Bucket (PDFs, Notes – non-medical only)

---

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager
- Git

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/familyhub.git
cd familyhub
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

4. Run the development server
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:3000`

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run typecheck` - Type checking

### Project Structure

```
familyhub/
├── src/                 # Source code
│   ├── app/            # Next.js App Router pages
│   ├── components/     # React components
│   ├── lib/           # Utilities and Supabase clients
│   ├── hooks/         # Custom React hooks
│   ├── types/         # TypeScript definitions
│   └── utils/         # Helper functions
├── public/            # Static assets
├── .claude/agents/    # AI development agents
└── docs/              # Documentation
```

## Security & Privacy

- **Family-focused, not medical**: No HIPAA compliance needed
- **Private by default**: All data encrypted in transit and at rest
- **Multi-generational access**: Role-based permissions with age-appropriate interfaces
- **Secure authentication**: Supabase Auth with magic links and OAuth
- **Document storage**: Private cloud vault for all important family documents

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/familyhub/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/familyhub/discussions)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**FamilyHub.care** - Keeping families connected across generations.