# FlowNote Implementation Plan

**Date:** 2026-01-21
**Design Doc:** [2026-01-21-flownote-design.md](./2026-01-21-flownote-design.md)

## Phase Overview

| Phase | Description | Dependencies | Parallelizable |
|-------|-------------|--------------|----------------|
| 1 | Project Setup | None | No |
| 2 | Evaluation Engine | Phase 1 | Yes (with Phase 3) |
| 3 | UI Shell | Phase 1 | Yes (with Phase 2) |
| 4 | Editor Integration | Phase 2, 3 | No |
| 5 | Storage & Polish | Phase 4 | No |
| 6 | Docker & Deployment | Phase 5 | No |

## Phase 1: Project Setup

**Goal:** Scaffold the project with all tooling configured.

**Tasks:**
1. Initialize Vite + React + TypeScript project
2. Configure tsconfig.json for strict mode
3. Install dependencies: mathjs, codemirror packages
4. Set up project directory structure
5. Create placeholder files for each module
6. Verify dev server runs

**Output:** Running dev server with "Hello FlowNote" placeholder.

---

## Phase 2: Evaluation Engine

**Goal:** Build the core calculation engine independent of UI.

**Tasks:**

### 2.1 Parser (`src/engine/parser.ts`)
- Implement line type detection (expression, comment, text)
- Detect assignments: `x = ...` or `x.y = ...`
- Detect function definitions: `name(args) = ...`
- Detect function calls and expressions
- Unit tests for parser

### 2.2 Scope Manager (`src/engine/scope.ts`)
- Implement variable storage with dot notation support
- Handle implicit object creation (`a.b.c = 1` creates nested structure)
- Store user-defined functions
- Provide scope object for evaluation
- Unit tests for scope

### 2.3 Built-in Functions (`src/engine/functions.ts`)
- Implement `sum()` - for values and objects
- Implement `avg()` - for values and objects
- Implement `min()`, `max()` - for values and objects
- Helper to iterate object values
- Unit tests for functions

### 2.4 Evaluator (`src/engine/evaluate.ts`)
- Create sandboxed evaluation using `Function` constructor
- Inject mathjs functions into scope
- Inject custom functions (sum, avg, etc.)
- Inject user variables and functions
- Handle `ans` and `_` special variables
- Process entire document line-by-line
- Return results array with line numbers
- Basic error catching (no smart messages)
- Unit tests for evaluator

**Output:** Standalone engine that can be tested via console/tests.

---

## Phase 3: UI Shell

**Goal:** Build the React app structure without editor integration.

**Tasks:**

### 3.1 App Layout (`src/components/App.tsx`)
- Main container with header
- Content area for editor (placeholder)
- Variable bar at bottom (collapsible)
- Basic responsive layout

### 3.2 Styling (`src/styles/main.css`)
- Clean, minimal aesthetic
- Monospace font for editor area
- Result alignment styles
- Variable bar styling
- Mobile-friendly breakpoints

### 3.3 Result Display Component (`src/components/ResultLine.tsx`)
- Display result with `→` indicator
- Error state styling
- Empty state (for text lines)

**Output:** Static UI shell with placeholder content.

---

## Phase 4: Editor Integration

**Goal:** Connect CodeMirror editor to evaluation engine with live results.

**Tasks:**

### 4.1 CodeMirror Setup (`src/components/Editor.tsx`)
- Initialize CodeMirror 6 with basic extensions
- Configure for plain text / light syntax highlighting
- Handle document changes
- Line-by-line result gutter or inline widgets

### 4.2 Live Evaluation
- On document change, run evaluation engine
- Debounce evaluation (e.g., 150ms)
- Map results to editor lines
- Display results inline (right-aligned)

### 4.3 Variable Bar
- Extract variables from scope after evaluation
- Display in collapsible bar
- Update on each evaluation

### 4.4 Error Display
- Show inline error indicator
- Basic error message on hover or inline

**Output:** Fully functional editor with live calculation results.

---

## Phase 5: Storage & Polish

**Goal:** Persist notes and polish the experience.

**Tasks:**

### 5.1 localStorage Wrapper (`src/storage/local.ts`)
- Save note content on change (debounced)
- Load note on app start
- Handle storage errors gracefully

### 5.2 Polish
- Loading state on app start
- Empty state for new users (example content?)
- Keyboard shortcuts (if any)
- Focus management

### 5.3 Testing
- Manual testing of all features
- Edge cases: empty note, syntax errors, large numbers
- Mobile testing

**Output:** Polished, persistent single-note experience.

---

## Phase 6: Docker & Deployment

**Goal:** Package for self-hosting.

**Tasks:**

### 6.1 Production Build
- Verify `npm run build` produces working static files
- Optimize bundle size

### 6.2 Dockerfile
- Multi-stage build (node for build, nginx for serve)
- Serve static files from nginx
- Minimal image size

### 6.3 docker-compose.yml
- Single service configuration
- Port mapping (default 4000)
- Volume for potential future data persistence

### 6.4 Documentation
- Update README with usage instructions
- Docker run commands
- Development setup instructions

**Output:** Working Docker container, documented and ready for use.

---

## Parallel Execution Strategy

```
Phase 1 (Setup)
     │
     ├──────────────┬──────────────┐
     │              │              │
     ▼              ▼              │
Phase 2.1-2.2   Phase 3.1-3.3     │
(Parser/Scope)  (UI Shell)        │
     │              │              │
     ▼              │              │
Phase 2.3-2.4      │              │
(Functions/Eval)   │              │
     │              │              │
     └──────────────┴──────────────┘
                    │
                    ▼
              Phase 4 (Integration)
                    │
                    ▼
              Phase 5 (Storage/Polish)
                    │
                    ▼
              Phase 6 (Docker)
```

**Parallelizable work:**
- Phase 2 (engine) and Phase 3 (UI shell) can be built simultaneously after setup
- Within Phase 2, parser and scope can be built together, then functions and evaluator

---

## Estimated Complexity

| Phase | Complexity | Notes |
|-------|------------|-------|
| 1 | Low | Standard scaffolding |
| 2 | High | Core logic, most critical |
| 3 | Low | Standard React components |
| 4 | Medium | CodeMirror integration tricky |
| 5 | Low | Straightforward persistence |
| 6 | Low | Standard Docker setup |

## Definition of Done

- [ ] User can type mixed text and calculations
- [ ] Calculations evaluate with inline results
- [ ] Dot notation variables work
- [ ] User-defined functions work
- [ ] sum/avg/min/max work on objects
- [ ] Note persists in localStorage
- [ ] App runs in Docker container
- [ ] README has setup instructions
