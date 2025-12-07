# Arc Spirits Planner (Rev 2)

A SvelteKit application for planning and analyzing Arc Spirits game data, including classes, origins, dice mechanics, and unit management.

## Features

- **Class Management**: Create and manage character classes with complex effect breakpoints
- **Class Analysis**: Monte Carlo simulation for damage calculations across different class configurations
- **Dice System**: Custom dice creation with attack and special reward types
- **Origins System**: Origin/faction management with associated units and artifacts
- **Hex Spirits**: Unit management linked to classes and origins
- **Data Visualization**: Chart.js integration for statistical analysis

## Tech Stack

- **Frontend**: SvelteKit, TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Charts**: Chart.js
- **Build Tool**: Vite

## Database Structure

### Tables

#### `custom_dice`
Represents custom dice used in the game mechanics.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Unique identifier |
| `name` | text | Dice name |
| `description` | text | Optional description |
| `icon` | text | Optional icon/emoji |
| `color` | text | Hex color code |
| `category` | text | Dice category |
| `dice_type` | enum | `attack` or `special` |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

#### `dice_sides`
Individual sides/faces of custom dice.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Unique identifier |
| `dice_id` | uuid (FK) | References `custom_dice.id` |
| `side_number` | int | Side position (1-6) |
| `reward_type` | enum | `attack` or `special` |
| `reward_value` | text | Value shown on the side |
| `reward_description` | text | Optional description |
| `icon` | text | Optional icon |
| `created_at` | timestamp | Creation timestamp |

#### `origins`
Factions or origin groups in the game.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Unique identifier |
| `name` | text | Origin name |
| `position` | int | Display order |
| `icon` | text | Optional icon/emoji |
| `color` | text | Hex color code |
| `description` | text | Origin description |
| `footer` | text | Additional flavor text |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

#### `classes`
Character classes with effect breakpoints and damage calculations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Unique identifier |
| `name` | text | Class name |
| `position` | int | Display order |
| `icon` | text | Optional icon/emoji |
| `color` | text | Hex color code |
| `description` | text | Class description |
| `effect_schema` | jsonb | Effect breakpoints structure (see below) |
| `prismatic` | jsonb | Prismatic form data |
| `tags` | text[] | Classification tags |
| `footer` | text | Additional flavor text |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

**Effect Schema Structure**:
```typescript
{
  count: number | string,        // Breakpoint threshold
  color?: 'bronze' | 'silver' | 'gold' | 'prismatic',
  description?: string,
  effects: Effect[]              // Array of effect objects
}

// Effect types:
// - dice: { type: 'dice', dice_id?: string, dice_name?: string, quantity: number }
// - flat_stat: { type: 'flat_stat', stat: 'attack' | 'defense', value: number, condition?: string }
// - multiplier: { type: 'multiplier', stat: 'attack' | 'defense', value: number }
// - benefit: { type: 'benefit', description: string, value?: number, benefit_type?: string }
// - backup_trim: { type: 'backup_trim', value: number }
```

#### `hex_spirits`
Units/spirits that can be placed on the hex grid.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Unique identifier |
| `name` | text | Spirit name |
| `cost` | int | Deployment cost |
| `class_id` | uuid (FK) | References `classes.id` |
| `origin_id` | uuid (FK) | References `origins.id` |
| `image_path` | text | Optional image path |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

#### `runes`
Collectible runes associated with origins.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Unique identifier |
| `name` | text | Rune name |
| `benefit` | text | Rune effect description |
| `origin_id` | uuid (FK, nullable) | References `origins.id`; null when linked to a guardian or lost |
| `guardian_id` | uuid (FK, nullable) | References `guardians.id`; null unless guardian-linked |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

Artifacts with neither `origin_id` nor `guardian_id` are treated as **Lost**, and their `recipe_box` must remain empty (they cannot be crafted).

#### `artifacts`
Craftable artifacts created from runes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Unique identifier |
| `name` | text | Artifact name |
| `benefit` | text | Artifact effect description |
| `recipe_box` | jsonb | Recipe ingredients `[{rune_id, quantity}]` |
| `origin_id` | uuid (FK) | References `origins.id` |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

#### `guardians`
Guardians linked to origins.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Unique identifier |
| `name` | text | Guardian name |
| `origin_id` | uuid (FK) | References `origins.id` |
| `image_mat_path` | text | Optional path to image mat |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm/pnpm/yarn
- Supabase account with configured database

### Installation

```sh
# Clone the repository
git clone https://github.com/maikyonn/arc-spirits-rev-2.git
cd arc-spirits-rev-2

# Install dependencies
npm install
```

### Environment Setup

Create a `.env` file in the root directory:

```env
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development

Start the development server:

```sh
npm run dev

# or start and open in browser
npm run dev -- --open
```

### Building

Create a production build:

```sh
npm run build
```

Preview the production build:

```sh
npm run preview
```

## Project Structure

```
src/
├── lib/
│   ├── api/              # Supabase client configuration
│   ├── features/         # Feature-specific logic
│   │   ├── classes/      # Class management and simulation
│   │   ├── dice/         # Dice creation and management
│   │   ├── hex-spirits/  # Unit management
│   │   └── origins/      # Origin management
│   ├── types/            # TypeScript type definitions
│   └── components/       # Reusable Svelte components
├── routes/               # SvelteKit routes
│   ├── class-analysis/   # Class damage simulation
│   ├── classes/          # Class CRUD operations
│   ├── dice/             # Dice management
│   └── origins/          # Origin management
└── app.html              # HTML template
```

## Features Overview

### Class Analysis
Monte Carlo simulation system for analyzing class damage output across different breakpoint configurations. Supports:
- 1000-trial simulations per breakpoint
- Multiple effect types (dice, flat stats, multipliers)
- Statistical analysis (mean, variance, standard deviation)
- Visual representation via Chart.js

### Effect System
Flexible effect system supporting:
- **Dice Effects**: Roll custom dice and add results to attack/defense
- **Flat Stat Modifiers**: Add fixed values to stats (conditional or unconditional)
- **Multipliers**: Scale attack/defense values
- **Benefits**: Non-numeric special effects
- **Backup Trim**: Remove dice from backup pool

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Deployment

To deploy this app, install a [SvelteKit adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
