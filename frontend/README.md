# TravelAmigo Frontend

TravelAmigo is a multi-agent journey coordination system where users tell **kaju** what changed, and the system figures out what needs to happen next.

## Current Stack
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
The visual language uses a **dark polished green/black marble aesthetic**:
- Theme: Black, deep forest green, emerald, muted sage.
- Rounded UI: `rounded-full` for inputs and primary buttons, `rounded-2xl/3xl` for cards and panels.
- Marble Background: SVG-based organic flowing veins (using `feTurbulence` and `mix-blend-mode`).
- Motion: Subtle blurs, fades, staggers, and glows that respect `prefers-reduced-motion` (via Framer Motion).

## Frontend Structure
- `src/components/ui/` - Reusable primitives (`Button`, `Card`, `Icon`, `MarbleBackground`, etc.)
- `src/components/layout/` - Shell structures (`AppLayout`, `PublicLayout`, `AuthLayout`)
- `src/components/chat/` - kaju conversation UI (`ChatInput`, `Messages`, `AgentActivity`)
- `src/components/trips/` - Trip context and listings (`TripCard`, `DependencyGraph`)
- `src/pages/` - Routable page components (Home, Chat, Trips, Bookings, Budget)
- `src/data/mockData.ts` - Local simulated data

## Implemented Routes
- `/` - Landing page
- `/style-guide` - Component library testing page
- `/login`, `/signup` - Auth placeholder forms
- `/app` - Workspace home screen
- `/app/chat` - kaju conversational interface
- `/app/trips` - Trips listing page
- `/app/trips/:tripId` - Detailed trip workspace (itinerary, dependencies)
- `/app/bookings` - Overview of confirmed and pending reservations
- `/app/budget` - Trip budget tracking and spending breakdown
- `/app/notifications` - Notifications and alerts from kaju
- `/app/settings` - User preferences and application settings

## Completed Stuff
1. **Foundation & Design System**: Setup Tailwind, routing, and core UI components.
2. **Landing Page**: Built Bolt-inspired public landing page.
3. **App Shell & kaju Chat**: Implemented the main conversational interface and trip context workspace.
4. **Visual Refinement**: Shifted to a deep emerald marble aesthetic using SVG turbulence.
5. **Trips, Bookings & Budget**: Added the trips dashboard, detailed workspace, and supporting reservation/finance pages.
6. **Notifications, Settings & Animations**: Implemented remaining UI pages and completed a global Framer Motion pass for fluid page transitions and staggered reveals across the entire application.

## Features
The frontend now includes:
- Conversational kaju workspace
- Trip listing and details
- Chronological itinerary and dependency timeline
- Bookings list with status tracking
- Budget tracking and category breakdown
- Notifications and user settings
- Reusable Trip Context
- Responsive design
- Dark green/black marble visual system
- Reduced-motion-aware animations and smooth page transitions

## Architecture
Currently, the frontend uses **local mock data** (`src/data/mockData.ts`) and is **NOT connected to a backend or agent infrastructure**. The UI is constructed with clean, reusable components so real API integration can be slotted in smoothly later.