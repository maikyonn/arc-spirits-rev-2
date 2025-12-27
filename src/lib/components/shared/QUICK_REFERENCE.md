# Shared Components - Quick Reference

## Import Statement
```typescript
import {
  ConfirmDialog,
  ImageUploader,
  DataGrid,
  FilterBar,
  NumberControl
} from '$lib/components/shared';
```

---

## ConfirmDialog

```svelte
<script>
  let showDialog = $state(false);
</script>

<ConfirmDialog
  bind:open={showDialog}
  title="Delete Item"
  message="This cannot be undone."
  variant="danger"  // 'danger' | 'warning' | 'info'
  confirmLabel="Delete"
  cancelLabel="Cancel"
  onconfirm={() => console.log('Confirmed')}
  oncancel={() => console.log('Cancelled')}
/>
```

**Key Props**: `open` (bindable), `variant`, `onconfirm`, `oncancel`

---

## ImageUploader

```svelte
<script>
  let imagePath = $state<string | null>(null);
</script>

<ImageUploader
  bind:value={imagePath}
  bucket="game_assets"
  folder="uploads/items"
  accept="image/*"
  maxSizeMB={5}
  aspectRatio="16/9"
  onupload={(path) => console.log('Uploaded:', path)}
  onerror={(error) => alert(error)}
/>
```

**Key Props**: `value` (bindable), `bucket`, `folder`, `aspectRatio`, `maxSizeMB`

---

## DataGrid

```svelte
<script>
  const items = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' }
  ];
</script>

<DataGrid
  {items}
  columns={3}  // 1-6
  emptyMessage="No items found"
  emptyIcon="🔍"
>
  {#snippet item({ item, index })}
    <div class="card">
      <h3>{item.name}</h3>
      <p>Index: {index}</p>
    </div>
  {/snippet}
</DataGrid>
```

**Key Props**: `items`, `columns`, `emptyMessage`, Slot: `item({ item, index })`

---

## FilterBar

```svelte
<script>
  let search = $state('');

  const filters = [
    {
      key: 'rarity',
      label: 'Rarity',
      options: [
        { label: 'Common', value: 'common' },
        { label: 'Rare', value: 'rare' }
      ]
    }
  ];
</script>

<FilterBar
  bind:searchValue={search}
  searchPlaceholder="Search items..."
  {filters}
  onfilterchange={(key, value) => console.log(key, value)}
/>
```

**Key Props**: `searchValue` (bindable), `filters`, `onfilterchange`

---

## NumberControl

```svelte
<script>
  let quantity = $state(5);
</script>

<NumberControl
  bind:value={quantity}
  min={0}
  max={10}
  step={1}
  label="Quantity"
  disabled={false}
/>
```

**Key Props**: `value` (bindable), `min`, `max`, `step`, `label`

**Features**: Click buttons, hold for repeat, arrow keys, direct input

---

## Common Patterns

### Delete Confirmation
```svelte
<button onclick={() => showDelete = true}>Delete</button>
<ConfirmDialog
  bind:open={showDelete}
  title="Delete Item"
  variant="danger"
  onconfirm={handleDelete}
/>
```

### Search + Filter + Grid
```svelte
<FilterBar bind:searchValue={search} {filters} />
<DataGrid items={filteredItems}>
  {#snippet item({ item })}
    <!-- Card content -->
  {/snippet}
</DataGrid>
```

### Form with Image Upload
```svelte
<form>
  <input bind:value={name} />
  <ImageUploader bind:value={image} folder="items" />
  <NumberControl bind:value={quantity} min={1} />
  <button type="submit">Save</button>
</form>
```

---

## Svelte 5 Runes Used

- `$state` - Local reactive state
- `$derived` - Computed values
- `$props()` - Component props
- `$bindable()` - Two-way bindings
- `{#snippet}` - Slot content

---

## Color Palette

```css
Background:     rgba(15, 23, 42, 0.6)
Border:         rgba(148, 163, 184, 0.25)
Text:           #cbd5f5
Muted:          #94a3b8
Primary:        rgba(59, 130, 246, 0.35)
Danger:         rgba(248, 113, 113, 0.25)
Warning:        rgba(251, 191, 36, 0.25)
```

---

## File Sizes

| Component       | Lines | Size  |
|----------------|-------|-------|
| ConfirmDialog  | 177   | 3.3KB |
| ImageUploader  | 378   | 7.6KB |
| DataGrid       | 116   | 2.4KB |
| FilterBar      | 175   | 3.4KB |
| NumberControl  | 221   | 4.3KB |

---

## Dependencies

- **ConfirmDialog** → `../layout/Modal.svelte`
- **ImageUploader** → `$lib/utils/storage`
- **DataGrid** → None (standalone)
- **FilterBar** → None (standalone)
- **NumberControl** → None (standalone)

---

## Documentation Files

- **README.md** - Full documentation with all props and usage
- **EXAMPLES.md** - Complete working examples
- **ARCHITECTURE.md** - Technical architecture and data flow
- **SUMMARY.md** - Implementation summary
- **QUICK_REFERENCE.md** - This file

---

## TypeScript Interfaces

### FilterBar
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

### DataGrid
```typescript
// Accepts generic type T for items
<DataGrid<MyType> items={myItems}>
```

---

## Accessibility

- ✅ All interactive elements have ARIA labels
- ✅ Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- ✅ Focus management in modals
- ✅ Screen reader support
- ✅ Disabled state handling

---

## Browser Support

Requires Svelte 5 - compatible with all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

---

## Need Help?

1. Check **README.md** for detailed prop documentation
2. See **EXAMPLES.md** for complete working examples
3. Review **ARCHITECTURE.md** for technical details
4. Analyze existing patterns in `/src/routes/origins/+page.svelte`
