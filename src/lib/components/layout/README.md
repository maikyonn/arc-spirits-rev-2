# Layout Components

Generic, reusable layout components built with Svelte 5 using the runes syntax.

## Components

### Modal

Generic modal dialog with flexible sizing and optional header/footer slots.

**Props:**
- `open` (bindable): Boolean controlling modal visibility
- `title`: Modal title (optional)
- `size`: 'sm' | 'md' | 'lg' | 'xl' | 'full' (default: 'md')
- `closeOnBackdrop`: Allow closing by clicking backdrop (default: true)
- `closeOnEscape`: Allow closing with ESC key (default: true)

**Snippets:**
- `children`: Main modal content (body)
- `header`: Optional header content (appears below title)
- `footer`: Optional footer with action buttons

**Example:**
```svelte
<script>
  import { Modal } from '$lib/components/layout';

  let open = $state(false);
</script>

<Modal bind:open title="Edit Item" size="lg">
  {#snippet children()}
    <p>Modal body content goes here</p>
  {/snippet}

  {#snippet footer()}
    <button onclick={() => open = false}>Cancel</button>
    <button>Save</button>
  {/snippet}
</Modal>
```

---

### Gallery

Generic gallery component for displaying items in a grid layout.

**Props:**
- `open` (bindable): Boolean controlling gallery visibility
- `title`: Gallery title (default: 'Gallery')
- `items`: Array of items to display
- `columns`: 2 | 3 | 4 | 5 | 6 (default: 4)
- `emptyMessage`: Message when no items (default: 'No items to display')
- `emptyHint`: Additional hint text for empty state

**Snippets:**
- `children(item)`: Render each gallery item (receives item as parameter)

**Example:**
```svelte
<script>
  import { Gallery } from '$lib/components/layout';

  let galleryOpen = $state(false);
  let items = $state([
    { id: 1, name: 'Item 1', imageUrl: '/path/to/image.png' },
    { id: 2, name: 'Item 2', imageUrl: '/path/to/image2.png' }
  ]);
</script>

<Gallery
  bind:open={galleryOpen}
  title="Card Gallery"
  {items}
  columns={3}
  emptyMessage="No cards generated yet"
  emptyHint="Use 'Generate All Cards' to create cards"
>
  {#snippet children(item)}
    <div class="card-item">
      <img src={item.imageUrl} alt={item.name} />
      <div class="card-name">{item.name}</div>
    </div>
  {/snippet}
</Gallery>
```

---

### Drawer

Right-side sliding drawer panel.

**Props:**
- `open` (bindable): Boolean controlling drawer visibility
- `title`: Drawer title
- `width`: 'sm' | 'md' | 'lg' (default: 'md')
- `closeOnBackdrop`: Allow closing by clicking backdrop (default: true)
- `closeOnEscape`: Allow closing with ESC key (default: true)

**Snippets:**
- `children`: Drawer content

**Example:**
```svelte
<script>
  import { Drawer } from '$lib/components/layout';

  let drawerOpen = $state(false);
</script>

<Drawer bind:open={drawerOpen} title="Settings" width="lg">
  {#snippet children()}
    <div class="setting-group">
      <h3>General Settings</h3>
      <label>
        <input type="checkbox" />
        Enable notifications
      </label>
    </div>
  {/snippet}
</Drawer>
```

---

### FilterSidebar

Left sidebar for filters with collapsible functionality.

**Props:**
- `collapsed` (bindable): Boolean controlling collapsed state

**Snippets:**
- `header`: Sidebar header content
- `children`: Filter controls
- `footer`: Optional footer content

**Example:**
```svelte
<script>
  import { FilterSidebar } from '$lib/components/layout';

  let collapsed = $state(false);
  let selectedRarity = $state('all');
</script>

<FilterSidebar bind:collapsed>
  {#snippet header()}
    <h3>Filters</h3>
  {/snippet}

  {#snippet children()}
    <div class="filter-group">
      <label>Rarity</label>
      <select bind:value={selectedRarity}>
        <option value="all">All</option>
        <option value="common">Common</option>
        <option value="rare">Rare</option>
      </select>
    </div>
  {/snippet}

  {#snippet footer()}
    <button>Reset Filters</button>
  {/snippet}
</FilterSidebar>
```

---

## Features

### Consistent Dark Theme
All components use matching dark theme styling with:
- Background: `rgba(8, 14, 32, 0.95)`
- Borders: `rgba(94, 114, 228, 0.28)`
- Text: `#f8fafc`
- Hover states with blue tint

### Accessibility
- Proper ARIA labels and roles
- Keyboard navigation (ESC to close, focus management)
- Focus trapping in modals
- Semantic HTML

### Responsive Design
- Mobile-friendly with responsive breakpoints
- Touch-friendly controls
- Adaptive sizing and layouts

### Animations
- Smooth transitions using Svelte's built-in transitions
- Backdrop fade effects
- Slide and fly animations

## Migration from Existing Components

### From EditorModal → Modal
```svelte
<!-- Before -->
<EditorModal title="Edit" size="md" on:close={() => open = false}>
  <slot />
  <slot name="footer" slot="footer" />
</EditorModal>

<!-- After -->
<Modal bind:open title="Edit" size="md">
  {#snippet children()}
    <!-- content -->
  {/snippet}
  {#snippet footer()}
    <!-- footer buttons -->
  {/snippet}
</Modal>
```

### From ArtifactCardGallery/MonsterCardGallery → Gallery
```svelte
<!-- Before -->
<ArtifactCardGallery bind:isOpen {artifacts} />

<!-- After -->
<Gallery
  bind:open={isOpen}
  title="Artifact Cards"
  items={artifactsWithCards}
  columns={4}
>
  {#snippet children(artifact)}
    <div class="card-item">
      <img src={getCardUrl(artifact)} alt={artifact.name} />
      <div class="card-name">{artifact.name}</div>
    </div>
  {/snippet}
</Gallery>
```
