# Shared Components Architecture

## Component Hierarchy

```
src/lib/components/shared/
├── ConfirmDialog.svelte     → Uses: Modal (from ../layout/)
├── ImageUploader.svelte     → Uses: storage utils ($lib/utils/storage)
├── DataGrid.svelte          → Standalone
├── FilterBar.svelte         → Standalone
└── NumberControl.svelte     → Standalone
```

## Dependency Graph

```
┌─────────────────────────────────────────────────────┐
│                   User Pages                        │
│    (origins, artifacts, hex-spirits, etc.)          │
└─────────────────────┬───────────────────────────────┘
                      │
                      │ imports
                      ↓
┌─────────────────────────────────────────────────────┐
│         $lib/components/shared (Barrel)             │
│  { ConfirmDialog, ImageUploader, DataGrid, ... }    │
└─────────┬──────────┬────────────┬────────┬──────────┘
          │          │            │        │
          │          │            │        │ standalone
          ↓          ↓            ↓        ↓
    ┌─────────┐ ┌────────┐  ┌─────────┐  ┌──────────┐
    │ Confirm │ │ Image  │  │DataGrid │  │FilterBar │
    │ Dialog  │ │Uploader│  │         │  │          │
    └────┬────┘ └───┬────┘  └─────────┘  └──────────┘
         │          │
         │          │
         ↓          ↓
    ┌────────┐  ┌─────────┐
    │ Modal  │  │ storage │
    │(layout)│  │  utils  │
    └────────┘  └─────────┘
```

## Data Flow

### ConfirmDialog
```
User Action → open = true → ConfirmDialog renders
                              ↓
User clicks Confirm → onconfirm() callback
                      open = false → Dialog closes
```

### ImageUploader
```
User drops file → validate() → uploadStorageFile()
                                  ↓
                            Update value binding
                                  ↓
                            Display preview
                                  ↓
                            onupload() callback
```

### DataGrid
```
items[] prop → Generate grid layout
                  ↓
For each item → Render {#snippet item({ item, index })}
                  ↓
Apply responsive columns
```

### FilterBar
```
User types → bind:searchValue updates
User selects → onfilterchange(key, value) fires
                  ↓
Parent component filters data
                  ↓
Pass filtered items to DataGrid
```

### NumberControl
```
User clicks + → increment() → value = clamp(value + step)
                                  ↓
                            Update binding
                                  ↓
User holds button → startHold() → Repeat increment/decrement
```

## State Management

### $state (Local Component State)
- **ImageUploader**: `uploading`, `removing`, `dragOver`
- **NumberControl**: `holdInterval`, `holdTimeout`
- **DataGrid**: None (stateless, data-driven)
- **FilterBar**: None (controlled by parent via bindings)
- **ConfirmDialog**: None (controlled by `open` binding)

### $bindable (Two-way Bindings)
- **ConfirmDialog**: `open`
- **ImageUploader**: `value`
- **FilterBar**: `searchValue`
- **NumberControl**: `value`

### $derived (Computed Values)
- **ImageUploader**: `previewUrl`, `hasImage`
- **DataGrid**: `isEmpty`, `gridTemplateColumns`
- **ConfirmDialog**: `variantStyles`

## Integration Patterns

### Pattern 1: Standalone Form Control
```svelte
<NumberControl bind:value={quantity} min={1} max={99} />
```

### Pattern 2: Confirmation Dialog
```svelte
<button onclick={() => showDialog = true}>Delete</button>
<ConfirmDialog bind:open={showDialog} onconfirm={handleDelete} />
```

### Pattern 3: Search + Filter + Grid
```svelte
<FilterBar bind:searchValue {filters} onfilterchange={handleFilter} />
<DataGrid items={filteredItems}>
  {#snippet item({ item })}
    <div class="card">{item.name}</div>
  {/snippet}
</DataGrid>
```

### Pattern 4: Image Upload in Form
```svelte
<form>
  <input bind:value={name} />
  <ImageUploader bind:value={imagePath} folder="items/{id}" />
  <button type="submit">Save</button>
</form>
```

## Styling Strategy

### CSS Custom Properties (Not Used)
Components use inline alpha-based colors for flexibility.

### Scoped Styles
All styles are component-scoped via Svelte's `<style>` tag.

### Theme Consistency
- Border radius: 6-10px
- Transitions: 0.15s ease
- Alpha transparency: 0.6-0.9
- Color palette: Blue (primary), Red (danger), Yellow (warning)

### Responsive Breakpoints
- Mobile: < 640px
- Desktop: ≥ 640px

## Error Handling

### ImageUploader
```
File validation → validateFile()
  ↓ (if invalid)
onerror() callback → Display error to user
  ↓ (if valid)
Upload → catch errors → onerror() callback
```

### NumberControl
```
Input validation → handleInput()
  ↓
Parse float → if NaN, ignore
  ↓
clamp(value) → Ensure within min/max
```

## Accessibility Features

### Keyboard Navigation
- **ConfirmDialog**: Escape to close
- **ImageUploader**: Enter/Space on dropzone
- **NumberControl**: Arrow up/down, direct input
- **FilterBar**: Tab navigation, standard inputs

### ARIA Labels
- All interactive elements have `aria-label`
- **NumberControl**: `aria-labelledby` for label association
- **ConfirmDialog**: `role="dialog"`, `aria-modal="true"`

### Focus Management
- **ConfirmDialog**: Auto-focus on open, restore on close
- **ImageUploader**: Focus dropzone on keyboard interaction

## Performance Considerations

### Reactive Optimization
- Use `$derived` for expensive computations
- Avoid unnecessary re-renders with `$state` isolation

### File Upload
- Validate before upload to prevent wasted API calls
- Show loading states immediately for UX feedback

### Grid Rendering
- Use CSS Grid for efficient layout
- Snippet-based rendering for optimal performance

## Testing Checklist

### ConfirmDialog
- ✅ Opens/closes correctly
- ✅ Variant styles apply
- ✅ Callbacks fire
- ✅ Escape key works

### ImageUploader
- ✅ File validation works
- ✅ Drag & drop functions
- ✅ Preview displays
- ✅ Remove works
- ✅ Upload success/error

### DataGrid
- ✅ Empty state displays
- ✅ Items render correctly
- ✅ Responsive columns work
- ✅ Snippet receives correct data

### FilterBar
- ✅ Search binding works
- ✅ Filter changes fire callback
- ✅ Responsive layout
- ✅ Multiple filters work

### NumberControl
- ✅ Increment/decrement work
- ✅ Hold-to-repeat functions
- ✅ Min/max clamping works
- ✅ Keyboard navigation
- ✅ Direct input validates
