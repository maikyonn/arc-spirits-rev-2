# Composables

Reusable stateful logic using Svelte 5 runes for the Arc Spirits Planner.

## Overview

This directory contains composable functions that encapsulate common patterns used across the application. All composables use Svelte 5 runes (`$state`, `$derived`) for reactive state management.

## Available Composables

### `useFormModal`

Form modal state management for create/edit operations.

**Features:**
- Auto-detects edit mode based on item ID
- Manages form data lifecycle
- Provides open/close methods with state reset

**Usage:**
```typescript
import { useFormModal } from '$lib/composables';

const modal = useFormModal({ name: '', position: 1 });

// Open for creating
modal.open();

// Open for editing
modal.open({ id: '123', name: 'Existing', position: 5 });

// Check mode
if (modal.isEditing) {
  console.log('Editing:', modal.editingId);
}

// Close and reset
modal.close();
```

### `useFilteredData`

Filtering and search logic with multiple filter support.

**Features:**
- Multi-field search
- Custom filters with reactive values
- Derived filtered results
- Count tracking

**Usage:**
```typescript
import { useFilteredData } from '$lib/composables';

const filtered = useFilteredData(
  () => items,
  {
    searchFields: ['name', 'description'],
    filters: [
      { key: 'origin_id', value: () => selectedOrigin },
      { key: 'class_id', value: () => selectedClass }
    ]
  }
);

// Update search
filtered.searchQuery = 'fire';

// Access results
console.log(filtered.count); // Filtered count
console.log(filtered.total); // Total count
console.log(filtered.filtered); // Filtered array
```

### `useLookup`

ID to value mapping with O(1) lookup performance.

**Features:**
- Efficient Map-based lookups
- Label extraction
- Existence checking
- Auto-updates when source data changes

**Usage:**
```typescript
import { useLookup } from '$lib/composables';

const originLookup = useLookup(() => origins, 'name');

// Get full item
const origin = originLookup.get('origin-id-123');

// Get label only
const name = originLookup.getLabel('origin-id-123', 'Unknown');

// Check existence
if (originLookup.exists('origin-id-123')) {
  console.log('Origin exists');
}
```

### `useFileUpload`

File upload state management with progress tracking.

**Features:**
- Upload/delete operations
- Progress tracking
- Error handling
- Public URL generation with cache busting
- Integrates with Supabase storage utilities

**Usage:**
```typescript
import { useFileUpload } from '$lib/composables';

const upload = useFileUpload('game_assets', 'origin_icons');

// Upload file
async function handleUpload(file: File) {
  const path = await upload.upload(file, 'custom-name.png');

  if (upload.error) {
    console.error(upload.error);
    return;
  }

  // Get public URL with cache bust
  const url = upload.getUrl(path, true);
}

// Check upload state
if (upload.isUploading) {
  console.log(`Progress: ${upload.progress}%`);
}

// Remove file
await upload.remove('origin_icons/icon.png');
```

## Pattern Examples

### Form Modal with Filtered Data

```typescript
// Component state
const modal = useFormModal(emptyOriginForm());
const filtered = useFilteredData(
  () => origins,
  {
    searchFields: ['name', 'description'],
    filters: [{ key: 'position', value: () => positionFilter }]
  }
);

// Create new
function handleCreate() {
  modal.open();
}

// Edit existing
function handleEdit(origin: Origin) {
  modal.open(origin);
}

// Save
async function handleSave() {
  const data = modal.formData;
  await saveOrigin(data, modal.editingId);
  modal.close();
}
```

### Lookup with Filtered Display

```typescript
const origins = $state<Origin[]>([]);
const originLookup = useLookup(() => origins, 'name');

const filtered = useFilteredData(
  () => spirits,
  { searchFields: ['name'] }
);

// Display with lookup
{#each filtered.filtered as spirit}
  <div>
    <h3>{spirit.name}</h3>
    <p>Origin: {originLookup.getLabel(spirit.origin_id)}</p>
  </div>
{/each}
```

### File Upload with Form

```typescript
const modal = useFormModal({ name: '', icon: null });
const upload = useFileUpload('game_assets', 'icons');

async function handleIconUpload(file: File) {
  const path = await upload.upload(file);
  if (path) {
    modal.formData = { ...modal.formData, icon: path };
  }
}

// In template
{#if upload.isUploading}
  <progress value={upload.progress} max="100" />
{/if}

{#if upload.error}
  <div class="error">{upload.error}</div>
{/if}
```

## Design Patterns

### Reactive State

All composables use Svelte 5 runes for reactive state:
- `$state` for reactive variables
- `$derived` for computed values
- Getters/setters for controlled access

### Type Safety

All composables are fully typed with TypeScript:
- Generic types for flexible reuse
- Proper null handling
- Type inference support

### Performance

Optimized for performance:
- `useLookup` uses Map for O(1) lookups
- `useFilteredData` uses `$derived.by` for efficient recalculation
- File operations handle errors gracefully

## Migration from Existing Code

### Before (origins/+page.svelte pattern)
```typescript
let showOriginForm = false;
let editingOrigin: Origin | null = null;
let formData = emptyOriginForm();

function openOriginForm(origin?: Origin) {
  if (origin) {
    editingOrigin = origin;
    formData = originRowToForm(origin);
  } else {
    editingOrigin = null;
    formData = emptyOriginForm();
  }
  showOriginForm = true;
}

function closeOriginForm() {
  showOriginForm = false;
}
```

### After (with composables)
```typescript
import { useFormModal } from '$lib/composables';

const modal = useFormModal(emptyOriginForm());

// Use modal.open() and modal.close()
// Access modal.isOpen, modal.formData, modal.isEditing
```

## File Naming Convention

All composable files use the `.svelte.ts` extension because they contain Svelte runes that require the Svelte compiler. Regular `.ts` files would fail type checking.

## Testing

To verify composables work correctly:

```bash
# Type check
npm run check

# Build
npm run build

# Preview
npm run preview
```

## Future Composables

Potential additions:
- `useDebounce` - Debounced search/filter
- `usePagination` - Pagination state
- `useSort` - Sortable data
- `useLocalStorage` - Persistent state
- `useAsync` - Async operation state
