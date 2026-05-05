# Product Requirements Document: Frontend Redesign & Architecture

## 1. Executive Summary
The objective is to elevate the WorkforceGuard frontend from a functional prototype into a truly premium, enterprise-grade **Workforce Intelligence and Compliance Command Centre**. While the current MVP proves out the API and data models, the frontend architecture (a massive monolithic `Overview.jsx` and 1,200 lines of custom vanilla CSS) is not scalable. Furthermore, the visual execution lacks the polish, depth, and interactivity expected of a modern AI-centric product. 

This PRD outlines the technical strategy, design principles, and phased execution plan to rebuild the frontend to a state-of-the-art standard.

---

## 2. Target UX & Design Principles (The "Wow" Factor)

WorkforceGuard must look and feel like a high-end intelligence tool, not a standard internal dashboard.

*   **Cohesive Dark Mode & Glassmorphism**: Deep navy backgrounds (`#0a192f`) accented by vibrant teal (`#7ff4ea`) and soft gradient halos. Use of `backdrop-blur` for elevated surfaces (like the Evidence Drawer and Analyst Console) to create depth.
*   **Micro-Interactions & Fluidity**: Elements should react to the user. Hover states on cards, smooth opening of the evidence drawer, and staggered entrance animations for intelligence signals.
*   **Modern Typography**: Replace system fonts with a clean, geometric sans-serif (e.g., *Inter*, *Outfit*, or *Geist*) to improve readability and give a technical but elegant vibe.
*   **Information Hierarchy**: Avoid cognitive overload. Use clear visual indicators (like the current "Tone Chips") but refine their execution with subtle glow effects or crisp borders.
*   **Data Visualization**: Charts must shed their "out-of-the-box" look. They need custom tooltips, sleek ultra-thin grid lines, and gradient fills that match the dark aesthetic.

---

## 3. Rapid Prototyping with Stitch MCP

To accelerate the design and alignment phase before writing code, we leverage the **Stitch MCP** integration:
*   **Generative UI Design**: We use Stitch to dynamically generate completely new, interactive dashboard screens based on our exact design principles (dark mode, glassmorphism, navy/teal palette).
*   **Iterative Visual Feedback**: Rather than guessing what the user wants, Stitch allows us to present 2-3 high-fidelity interactive mockups directly in the chat interface. We can tweak layouts, colors, and components on the fly.
*   **Design-to-Code Blueprint**: Once a Stitch-generated UI concept is approved by stakeholders, it serves as the exact visual blueprint for the Tailwind & Shadcn UI implementation, eliminating design ambiguity.

---

## 4. Recommended Technology Stack

If I were building this from scratch today, I would use the following modern React stack to guarantee both performance and developer velocity:

*   **Framework**: **React + Vite** (Keep this, as it's fast and doesn't require rewriting the backend to Node/Next.js).
*   **Styling**: **Tailwind CSS**. Rip out the custom `App.css`. Tailwind allows for rapid, consistent styling and easy implementation of complex dark-mode aesthetics.
*   **Component Library**: **Shadcn UI** (built on Radix UI). This provides unstyled, accessible components (Select dropdowns, Dialogs, Drawers) that we can theme perfectly to our premium dark mode without writing them from scratch.
*   **Animations**: **Framer Motion**. Essential for staggered list animations, slide-in drawers, and smooth layout transitions.
*   **State Management & Data Fetching**: 
    *   **React Query (TanStack Query)**: For caching the API responses (like the huge `overview` payload), handling loading states gracefully, and avoiding redundant network requests.
    *   **Zustand**: For lightweight global state (e.g., cleanly managing the active `filters` across multiple deep components without prop-drilling).
*   **Charting**: **Recharts** (already installed, but needs aggressive restyling) or **Visx** (by Airbnb, for highly custom, premium D3-based React charts).

---

## 5. Architectural Transformation

The current `src/components/Overview.jsx` (1,250+ lines) is an anti-pattern. We will implement a **Feature-Sliced Design** or modular component structure.

**Proposed Directory Structure:**
```text
src/
├── assets/             # Images, fonts, raw icons
├── components/
│   ├── ui/             # Reusable primitives (Shadcn components like Button, Badge, Card, Select)
│   ├── layout/         # AppShell, TopBar, MainContent framing
├── features/           # The business logic breakdown!
│   ├── BriefingBoard/  # The top command cards and scope summary
│   ├── Dashboard/      # The core metrics and signals mapping
│   ├── AnalystConsole/ # The AI chatbot interface
│   ├── EvidenceDrawer/ # The slide-out contextual menu
│   └── Filters/        # Global controls and exports
├── hooks/              # Custom hooks (e.g., useOverviewData, useMetrics)
├── store/              # Zustand global state (filtersState.js)
├── lib/                # Utilities (cn for tailwind class merging, formatters)
└── App.jsx
```

---

## 6. Phased Execution Plan

How we get there without breaking the existing MVP functionality:

### Phase 1: Foundation & Tooling (1-2 Days)
*   Fully configure and integrate **Tailwind CSS**.
*   Install **Shadcn UI** and configure the base theme variables in `tailwind.config.js` to match the exact "WorkforceGuard Navy/Teal" palette.
*   Setup utility functions (e.g., `cn` for Tailwind class merging) and install `framer-motion`.

### Phase 2: Primitive Components & Layouts (2-3 Days)
*   Rebuild the lowest-level UI elements as isolated components (`<ToneChip>`, `<ProvenanceBadge>`, `<ScopeBadge>`).
*   Build out the `<Card>` and `<Drawer>` components using Shadcn so they have perfect accessibility and keyboard navigation.
*   Create the main `AppShell` layout grid.

### Phase 3: The Great De-coupling (3-5 Days)
*   **State**: Move the `filters` state into a Zustand store. Move the `axios` fetching logic into a custom hook (preferably using React Query).
*   **Briefing Board**: Extract the 4 top cards into their own feature component.
*   **Intelligence Grid**: Extract the Signals, Recommendations, and Watchlist into their own mapped components.
*   **Analyst Console**: Pull the chatbot out and give it its own dedicated state for chat histories and loading indicators.

### Phase 4: Polish, Animation & "The Wow" (2-3 Days)
*   Add Framer Motion `<motion.div>` tags to the `IntelligenceGrid` to make the cards stagger-fade in when data loads.
*   Restyle the loading state to use sleek skeleton loaders rather than a plain "Loading..." text.
*   Introduce the backdrop-filter blurs and radial gradient halos (as background noise) to make the UI pop.

---

## 7. Testing & Quality Assurance
- **Component & Integration Testing**: Use `Vitest` and `React Testing Library` to thoroughly test individual intelligence modules, ensuring the parsed signals maps correctly to the visual tone chips.
- **End-to-End (E2E) Testing**: As the UI involves interactive AI and complex state filters, we will implement `Playwright` to test essential user flows in a production-like environment.
- **Accessibility (a11y)**: As a compliance tool, the UI must be fully accessible. We will leverage Shadcn UI's built-in Radix primitives for keyboard navigation and screen-reader support, validating with `axe-core`.

---

## 8. Success Criteria
*   `Overview.jsx` is eliminated; no single component file exceeds 300 lines of code.
*   Custom CSS (`App.css`) is reduced to less than 100 lines, with 95% of styling handled via Tailwind utility classes.
*   The application feels instantly modern, responding to user clicks with smooth drawer slides and rich visual feedback.
*   The data pipeline and business logic remain 100% intact and untouched, proving the frontend UI is strictly a presentation layer over the backend.
