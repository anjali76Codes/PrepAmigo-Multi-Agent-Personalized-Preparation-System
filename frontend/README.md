# PrepAmigo Frontend

PrepAmigo is a multi-agent personalized interview preparation system.
Note: The app runs on mock data and isn't connected to a backend.
- **React 19**
- **TypeScript**
- **Vite**
- **Tailwind CSS** (v4 alpha via `@tailwindcss/vite`)
- **Framer Motion** (for subtle, accessible animations)
- **React Router**
- **Ionicons** (Web components)
- **clsx / tailwind-merge** (for utility class merging)
- **Poppins** font

## Design System
The visual language uses a **muted and calm aesthetic** across all presets:
- Theme: Off-white page background (`#F7F5F0`), surface whites, navy and forest elements.
- Components ONLY: Pages use `ui/` components exclusively. No ad-hoc styling.
- Style Presets: `default`, `soft`, `outlined`, and `crisp`. User preferences are persisted via `data-style`.
- Motion: Subtle blurs, fades, staggers, and interactive hover effects that respect `prefers-reduced-motion` (via Framer Motion).

## Frontend Structure
- `src/components/ui/` - Reusable primitives (`Button`, `Card`, `Icon`, `PageBackground`, etc.)
- `src/components/layout/` - Shell structures (`AppLayout`, `PublicLayout`, `AuthLayout`)
- `src/components/chat/` - PrepAmigo conversation UI (`ChatInput`, `Messages`, `AgentActivity`)
- `src/components/preps/` - Prep plan context and listings (`PrepCard`, `SkillGapMap`, etc.)
- `src/pages/` - Routable page components (Home, Chat, Preps, Practice, Progress, Calendar)
- `src/data/mockData.ts` - Local simulated data (Prep profiles, roadmaps, resources)

## Implemented Routes
- `/` - Landing page
- `/style-guide` - Component library testing page
- `/login`, `/signup` - Auth placeholder forms
- `/app` - Workspace home screen
- `/app/chat` - PrepAmigo conversational interface
- `/app/preps` - Prep plans listing page
- `/app/preps/:prepId` - Detailed prep workspace (roadmap, skill gaps)
- `/app/practice` - Overview of mock interviews, quizzes, and tasks
- `/app/progress` - Skill tracking and XP breakdown
- `/app/calendar` - Calendar view for prep milestones
- `/app/notifications` - Notifications and alerts from PrepAmigo
- `/app/settings` - User preferences and application settings

## Completed
- Layer 1: Routing, layout, and shared core components.
- Layer 2: Preps listing and tabbed PrepDetails workspace (Overview, Skill Gaps, Roadmap, Calendar, Resources, Assessments).
- Layer 3: Practice, Progress, Calendar, Notifications, Settings implementation.
- Layer 4: PrepAmigo chat interface, agent pipeline animation, and mock scenario matching.
- Layer 5: Home (landing), AppHome (dashboard), and Auth pages.
- Layer 6: final cleanup, shared state, and leftover removal.
- Layer 7: UI design system, tokens, global preset toggles, and mass component standardization.

## Features
- Conversational PrepAmigo workspace with suggested prompts and mock scenario matching
- Dynamic Agent Activity pipeline showing the 6 AI agents working
- 5 Core Planner Outputs: Roadmap, Calendar, Resource Pack, Assessments, Progress Dashboard
- Shared state context across the application