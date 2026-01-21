# FlowNote Design Document

**Date:** 2026-01-21
**Status:** Approved
**Version:** 1.0

## Overview

FlowNote is a notepad where freeform text and calculations coexist. Lines that look like code get evaluated; everything else is just text. Each note is a mini JavaScript environment with mathjs superpowers.

### Target Use Cases

1. **Personal finance** - budgeting, splitting costs, loan calculations
2. **General scratch pad** - quick math mixed with notes, grocery lists with totals

### Core Principles

- Approachable surface, powerful engine
- Non-coders see simple math; power users can access full JS capabilities
- YAGNI - start minimal, extend based on real needs

## Example Note

```
Planning trip to Seattle

flights = 450
hotel.perNight = 180
hotel.nights = 4
hotel.total = hotel.perNight * hotel.nights

food.budget = 75 * hotel.nights
activities = 200

total = sum(flights, hotel.total, food.budget, activities)
```

Results appear inline with `→` indicators.

## Syntax & Evaluation

### Line Classification

Each line is detected as one of:
- **Expression** - has `=`, operators, or function calls → evaluate it
- **Comment** - starts with `#` or `//` → ignore
- **Text** - everything else → pass through as prose

### Variables

```
x = 10                      // simple assignment
tax.rate = 0.08             // dot notation creates implicit objects
tax.amount = subtotal * tax.rate
```

Dot notation automatically creates nested objects. `hotel.nights = 4` creates `{ hotel: { nights: 4 } }` if `hotel` doesn't exist.

### Built-in Functions

**Aggregation (custom):**
- `sum(a, b, c)` - add values
- `sum(hotel)` - sum all properties of an object
- `avg(groceries)` - average of object properties
- `min()`, `max()`

**Math (via mathjs):**
- `round()`, `floor()`, `ceil()`
- `sin()`, `cos()`, `tan()`, `sqrt()`, `log()`, `pow()`
- Unit conversions: `5 inches to cm`

### User-Defined Functions

```
tip(amount, pct) = amount * pct / 100
monthlyPayment(principal, rate, months) = principal * (rate / 12) / (1 - (1 + rate/12)^(-months))

dinner = 85
tip(dinner, 20)     // → 17
```

### Special Variables

- `ans` - last calculated result
- `_` - alias for ans (REPL-style)

## Architecture

### Execution Model

- **Client-side only** - JS runs in browser sandbox, notes never leave the device for execution
- **Hybrid persistence** - localStorage for v1, optional server sync in future (data only, no server-side eval)

### Evaluation Sandbox

- Use `Function` constructor with controlled scope (not raw `eval`)
- Inject mathjs functions and user variables into scope
- Catch errors and display basic messages
- No access to DOM, fetch, or other browser APIs from expressions

### Data Model

- Single notes - each note is a standalone document
- Stored as plain text with metadata (title, created, modified)

## Technology Stack

### Frontend
- **React** + TypeScript
- **Vite** for build tooling
- **CodeMirror 6** for the editor

### Evaluation Engine
- Custom parser for line classification
- `Function` constructor for safe(r) evaluation
- **mathjs** for math functions and unit support

### Storage
- localStorage (v1)
- Optional REST API for sync (future)

### Deployment
- Docker container serving static files
- Single `docker-compose.yml` for easy self-hosting

## UI/UX

### Layout (Inline Results)

```
┌─────────────────────────────────────────────┐
│  FlowNote                              [⚙️]  │
├─────────────────────────────────────────────┤
│  Planning trip to Seattle                   │
│                                             │
│  flights = 450                      → 450   │
│  hotel.nights = 4                   → 4     │
│  total = sum(flights, hotel.total)  → 1,670 │
│                                             │
│  This is just text, no arrow appears.       │
│                                             │
│  [Variables ▾]                              │
│  flights: 450 | hotel: {...} | total: 1670  │
└─────────────────────────────────────────────┘
```

### Key Elements

- **Editor pane** - CodeMirror with syntax highlighting
- **Inline results** - right-aligned with `→` indicator
- **Variable bar** - collapsible at bottom, shows defined vars
- **Errors** - inline indicator, basic message (no stack traces)

### Mobile

Single pane, same inline results pattern. Variable bar at bottom.

## MVP Scope (v1)

**Included:**
- Single note (no note switching)
- Inline results with `→`
- Variables with dot notation, implicit objects
- User-defined functions
- `sum()`, `avg()`, `min()`, `max()` over objects
- mathjs for math functions and units
- localStorage persistence
- Basic error display
- Docker container for self-hosting

**Excluded (future):**
- Multiple notes with switcher
- Server sync / user accounts
- Smart error messages with suggestions
- Variable inspector panel
- Import/export notes
- Themes / dark mode
- Shareable note links
- Plugin system for integrations

## Project Structure

```
flownote/
├── src/
│   ├── components/
│   │   ├── Editor.tsx        # CodeMirror wrapper
│   │   ├── ResultLine.tsx    # Single result display
│   │   └── App.tsx           # Main layout
│   ├── engine/
│   │   ├── evaluate.ts       # Line-by-line evaluation
│   │   ├── parser.ts         # Detect line types
│   │   ├── scope.ts          # Variable/function management
│   │   └── functions.ts      # Built-in functions (sum, avg, etc.)
│   ├── storage/
│   │   └── local.ts          # localStorage wrapper
│   ├── styles/
│   │   └── main.css          # Styling
│   └── main.tsx
├── public/
│   └── index.html
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Security Considerations

1. **No server-side eval** - all calculation happens in browser
2. **Sandboxed execution** - `Function` constructor with limited scope
3. **No network access** - expressions cannot make HTTP requests
4. **No DOM access** - expressions cannot manipulate the page
5. **Self-hostable** - users control their own data

## Success Criteria

1. User can type a note mixing text and calculations
2. Calculations evaluate and show results inline
3. Variables persist within a note session
4. User can define and call custom functions
5. Note persists across browser refresh (localStorage)
6. App runs in Docker container
