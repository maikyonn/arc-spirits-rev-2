# Shared Components

Reusable Svelte 5 components with consistent dark theme styling.

## Components

### ConfirmDialog

Confirmation modal for user actions.

**Props:**
- `open` (bindable): boolean - Dialog visibility state
- `title`: string - Dialog title (default: "Confirm Action")
- `message`: string - Confirmation message (default: "Are you sure you want to proceed?")
- `confirmLabel`: string - Confirm button text (default: "Confirm")
- `cancelLabel`: string - Cancel button text (default: "Cancel")
- `variant`: 'danger' | 'warning' | 'info' - Visual style (default: 'info')
- `onconfirm`: () => void - Callback when confirmed
- `oncancel`: () => void - Callback when cancelled

**Usage:**
```svelte
<script lang="ts">
  import { ConfirmDialog } from '$lib/components/shared';

  let showDialog = $state(false);

  function handleDelete() {
    console.log('Deleted!');
  }
</script>

<button onclick={() => showDialog = true}>Delete</button>

<ConfirmDialog
  bind:open={showDialog}
  title="Delete Item"
  message="This action cannot be undone."
  variant="danger"
  onconfirm={handleDelete}
/>
```

---

### ImageUploader

Image upload with preview, drag & drop, and storage integration.

**Props:**
- `value` (bindable): string | null - Current image path
- `bucket`: string - Supabase storage bucket (default: 'game_assets')
- `folder`: string - Upload folder path (default: 'uploads')
- `accept`: string - File type filter (default: 'image/*')
- `maxSizeMB`: number - Max file size in MB (default: 5)
- `aspectRatio`: string - CSS aspect ratio (optional)
- `onupload`: (path: string) => void - Callback after successful upload
- `onerror`: (error: string) => void - Error handler

**Usage:**
```svelte
<script lang="ts">
  import { ImageUploader } from '$lib/components/shared';

  let imagePath = $state<string | null>(null);

  function handleUpload(path: string) {
    console.log('Uploaded:', path);
  }

  function handleError(error: string) {
    alert(error);
  }
</script>

<ImageUploader
  bind:value={imagePath}
  bucket="game_assets"
  folder="origin_icons"
  maxSizeMB={2}
  aspectRatio="1/1"
  onupload={handleUpload}
  onerror={handleError}
/>
```

---

### DataGrid

Responsive card grid with empty state.

**Props:**
- `items`: T[] - Array of items to display (default: [])
- `columns`: 1 | 2 | 3 | 4 | 5 | 6 - Number of columns (default: 3)
- `emptyMessage`: string - Message when empty (default: "No items to display")
- `emptyIcon`: string - Icon when empty (default: "📭")

**Slots:**
- `item`: Snippet<[{ item: T; index: number }]> - Render each item

**Usage:**
```svelte
<script lang="ts">
  import { DataGrid } from '$lib/components/shared';

  interface Item {
    id: string;
    name: string;
  }

  let items = $state<Item[]>([
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' }
  ]);
</script>

<DataGrid {items} columns={4} emptyMessage="No items found" emptyIcon="🔍">
  {#snippet item({ item, index })}
    <div class="card">
      <h3>{item.name}</h3>
      <p>Index: {index}</p>
    </div>
  {/snippet}
</DataGrid>
```

---

### FilterBar

Search input with dropdown filters.

**Props:**
- `searchValue` (bindable): string - Search input value
- `searchPlaceholder`: string - Search placeholder (default: "Search...")
- `filters`: Filter[] - Array of filter configurations
- `onfilterchange`: (key: string, value: string | number | boolean | null) => void - Filter change callback

**Filter Interface:**
```typescript
interface FilterOption {
  label: string;
  value: string | number | boolean;
}

interface Filter {
  key: string;
  label: string;
  options: FilterOption[];
  value?: string | number | boolean | null;
}
```

**Usage:**
```svelte
<script lang="ts">
  import { FilterBar } from '$lib/components/shared';

  let search = $state('');

  const filters = [
    {
      key: 'rarity',
      label: 'Rarity',
      options: [
        { label: 'Common', value: 'common' },
        { label: 'Rare', value: 'rare' },
        { label: 'Epic', value: 'epic' }
      ]
    },
    {
      key: 'cost',
      label: 'Cost',
      options: [
        { label: '1', value: 1 },
        { label: '2', value: 2 },
        { label: '3', value: 3 }
      ]
    }
  ];

  function handleFilterChange(key: string, value: string | number | boolean | null) {
    console.log(`Filter ${key} changed to:`, value);
  }
</script>

<FilterBar
  bind:searchValue={search}
  searchPlaceholder="Search items..."
  {filters}
  onfilterchange={handleFilterChange}
/>
```

---

### NumberControl

Number input with increment/decrement buttons and hold-to-repeat.

**Props:**
- `value` (bindable): number - Current value
- `min`: number - Minimum value (default: -Infinity)
- `max`: number - Maximum value (default: Infinity)
- `step`: number - Increment/decrement step (default: 1)
- `label`: string - Input label (optional)
- `disabled`: boolean - Disabled state (default: false)

**Usage:**
```svelte
<script lang="ts">
  import { NumberControl } from '$lib/components/shared';

  let count = $state(5);
</script>

<NumberControl
  bind:value={count}
  min={0}
  max={10}
  step={1}
  label="Quantity"
/>

<p>Current value: {count}</p>
```

**Features:**
- Click buttons to increment/decrement
- Hold buttons for continuous increment/decrement
- Arrow keys (↑↓) for keyboard navigation
- Direct input with validation
- Visual feedback on focus/hover

---

## Styling

All components use the existing dark theme color palette:

- Background: `rgba(15, 23, 42, 0.6)`
- Borders: `rgba(148, 163, 184, 0.25)`
- Text: `#cbd5f5`
- Muted text: `#94a3b8`
- Primary: `rgba(59, 130, 246, 0.35)`
- Danger: `rgba(248, 113, 113, 0.25)`
- Warning: `rgba(251, 191, 36, 0.25)`

## Best Practices

1. **Svelte 5 Runes**: All components use `$state`, `$derived`, `$props`, and `$bindable` for reactive state
2. **TypeScript**: Full type safety with proper interfaces
3. **Accessibility**: Proper ARIA labels, keyboard navigation, and focus management
4. **Responsive**: Mobile-friendly with responsive breakpoints
5. **Dark Theme**: Consistent styling across all components
