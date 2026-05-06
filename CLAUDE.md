# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LCMS is a comprehensive Letter of Credit (L/C) and Telegraphic Transfer (T/T) management system built with Next.js 14, React 18, and Firebase. It serves as a business operations platform for trade finance, handling everything from LC/TT management to inventory, quotes, invoices, and HR attendance tracking.

## Common Development Commands

### Development Server
```bash
# Start development server
npm run dev

# Start with GenKit AI development
npm run genkit:dev

# Start GenKit with file watching
npm run genkit:watch
```

### Building & Deployment
```bash
# Build for production
npm run build

# Build with bundle analysis
npm run build:analyze
```

### Code Quality
```bash
# Run ESLint
npm run lint

# Fix ESLint issues automatically
npm run lint:fix

# Type checking
npm run typecheck

# Find console logs (for cleanup)
npm run find:console
```

### Testing
```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14 with App Router, React 18, TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **AI/ML**: GenKit with Google AI integration
- **State Management**: TanStack Query (React Query)
- **Form Handling**: React Hook Form with Zod validation
- **Notifications**: WhatsApp, Email (Resend), Firebase Messaging

### Directory Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (Firebase functions)
│   ├── dashboard/         # Main dashboard pages
│   ├── login/             # Authentication pages
│   ├── register/          # Registration pages
│   └── globals.css        # Global styles
├── components/            # Reusable components
│   ├── ui/               # shadcn/ui base components
│   └── ...              # Business-specific components
├── lib/                  # Utilities and configurations
│   ├── firebase/        # Firebase setup
│   ├── utils/           # Utility functions
│   ├── api/             # API helpers
│   ├── data/            # Data helpers
│   ├── services/        # Business logic services
│   └── notifications/   # Notification handlers
└── ai/                   # AI/ML flows and GenKit configurations
```

### Key Architectural Patterns

#### 1. Firebase Integration
- Firestore is used as the primary database with persistent caching
- Authentication handles user management with role-based access (RBAC)
- Storage handles file uploads (images, documents)
- Real-time updates through Firestore listeners

#### 2. Role-Based Access Control (RBAC)
- User roles: Super Admin, Admin, Accounts, Commercial, Service, Supervisor, DemoManager, Viewer
- Data isolation for supervisors (can only see their team's data)
- Module-based permissions (users only see relevant sections)

#### 3. AI/ML Integration
- GenKit framework for AI workflows
- Google AI (Gemini) API for document processing
- AI flows for extracting shipping data from documents

#### 4. Mobile-First Design
- Responsive design with Tailwind CSS
- Enhanced spacing for mobile devices
- Touch-optimized interactions

### Environment Setup

Required environment variables (`.env`):
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_GEMINI_API_KEY=  # For AI features
```

### Firebase Rules
- Firestore security rules in `firestore.rules`
- Firebase storage rules in `firebase-storage.rules`
- Indexes configuration in `firestore.indexes.json`

### Important File Patterns

#### API Routes
- Located in `src/app/api/`
- Handle Firebase operations and business logic
- Support both RESTful and webhook patterns

#### Components
- Base UI components in `src/components/ui/`
- Business components in specific feature folders
- Use shadcn/ui component library with Tailwind CSS

#### Data Models
- TypeScript interfaces for all data structures
- Firebase document types aligned with interfaces
- Zod schemas for form validation

### Testing Strategy
- Unit tests for utilities and services
- Integration tests for API routes
- Component testing for UI elements
- Jest with React Testing Library

### Performance Considerations
- Image optimization with Next.js Image component
- Bundle analysis available via `npm run build:analyze`
- Console logs removed in production builds
- Firebase persistence for offline support

### Security Features
- XSS protection via DOMPurify
- Input validation with Zod schemas
- Firebase security rules
- HTTPS enforcement with security headers

### Development Notes
- Use `@/` path alias for imports
- Components use TypeScript with strict typing
- Firebase operations use proper error handling
- Notifications support dynamic template variables
- Attendance system includes geofencing and photo capture