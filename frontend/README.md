# TravelAmigo Frontend

TravelAmigo is a multi-agent journey coordination system where users tell **kaju** what changed, and the system figures out what needs to happen next.

## Current Stack
- **React 19**
- **TypeScript**
- **Vite**
- **Tailwind CSS** (v4 alpha via `@tailwindcss/vite`)
- **React Router**
- **Ionicons** (Web components)
- **clsx / tailwind-merge** (for utility class merging)
- **Poppins** font

## Design System
The visual language uses a **dark polished green/black marble aesthetic**:
- Theme: Black, deep forest green, emerald, muted sage.
- Rounded UI: `rounded-full` for inputs and primary buttons, `rounded-2xl/3xl` for cards and panels.
- Marble Background: SVG-based organic flowing veins (using `feTurbulence` and `mix-blend-mode`).
- Motion: Subtle blurs, fades, and glows that respect `prefers-reduced-motion`.

## Frontend Structure
- `src/components/ui/` - Reusable primitives (`Button`, `Card`, `Icon`, `MarbleBackground`, etc.)
- `src/components/layout/` - Shell structures (`AppLayout`, `PublicLayout`, `AuthLayout`)
- `src/components/chat/` - kaju conversation UI (`ChatInput`, `Messages`, `AgentActivity`)
- `src/components/trips/` - Trip context and listings (`TripCard`, `DependencyGraph`)
- `src/pages/` - Routable page components
- `src/data/mockData.ts` - Local simulated data

## Implemented Routes
- `/` - Landing page
- `/style-guide` - Component library testing page
- `/login`, `/signup` - Auth placeholder forms
- `/app` - Workspace home screen
- `/app/chat` - kaju conversational interface
- `/app/trips` - Trips listing page
- `/app/trips/:tripId` - Detailed trip workspace (itinerary, dependencies)

## Completed Missions
1. **Foundation & Design System**: Setup Tailwind, routing, and core UI components.
2. **Landing Page**: Built Bolt-inspired public landing page.
3. **App Shell & kaju Chat**: Implemented the main conversational interface and trip context workspace.
4. **Visual Refinement**: Shifted to a deep emerald marble aesthetic using SVG turbulence.
5. **Trips List**: Added the `/app/trips` dashboard and reusable `TripCard` component.
6. **Trip Details**: Added the detailed workspace showing itinerary, dependency graphs, affected items, and activity timelines.

## Features
The frontend now includes:
- Conversational kaju workspace
- Trip listing
- Trip details
- Chronological itinerary
- Dependency timeline
- Affected trip items
- Activity/change timeline
- Reusable Trip Context
- Responsive design
- Dark green/black marble visual system

## Architecture
Currently, the frontend uses **local mock data** (`src/data/mockData.ts`) and is **NOT connected to a backend or agent infrastructure**. The UI is constructed with clean, reusable components so real API integration can be slotted in smoothly later.

## Next Planned Work
- Bookings
- Budget
- Notifications
- Settings
- Backend/agent integration
