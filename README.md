# FlowNote

A notepad with built-in calculations, variables, and user-defined functions.

## Features

- **Freeform text with calculations** - Write notes naturally, and FlowNote evaluates mathematical expressions inline
- **Variables with dot notation** - Define variables like `hotel.perNight = 180` to organize related values
- **User-defined functions** - Create reusable functions: `tip(amount, pct) = amount * pct / 100`
- **Built-in math functions** - Access mathjs functions like `sqrt()`, `sin()`, `log()`, plus custom aggregations like `sum()` and `avg()`
- **Object aggregation** - Use `sum(hotel)` to sum all properties of an object
- **Persistent storage** - Notes are saved locally in your browser

## Example

```
Planning trip to Seattle

flights = 450
hotel.perNight = 180
hotel.nights = 4
hotel.total = hotel.perNight * hotel.nights

food.budget = 75 * hotel.nights
activities = 200

total = sum(flights, hotel.total, food.budget, activities)

// Define a tip calculator
tip(amount, pct) = amount * pct / 100

dinner = 85
tip(dinner, 20)
```

## Self-Hosting with Docker

### Using Docker Compose (recommended)

```bash
docker compose up -d
```

Then open http://localhost:4000 in your browser.

### Using Docker directly

```bash
docker build -t flownote .
docker run -d -p 4000:80 flownote
```

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm install
npm run dev
```

The development server runs at http://localhost:4000.

### Build

```bash
npm run build
```

Built files are output to the `dist/` directory.

## License

MIT
