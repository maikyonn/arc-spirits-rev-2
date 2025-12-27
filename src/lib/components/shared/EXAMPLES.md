# Component Examples

Complete working examples for all shared components.

## Complete Page Example

```svelte
<script lang="ts">
  import {
    ConfirmDialog,
    ImageUploader,
    DataGrid,
    FilterBar,
    NumberControl
  } from '$lib/components/shared';

  // Item management
  interface Item {
    id: string;
    name: string;
    rarity: string;
    cost: number;
    image?: string | null;
  }

  let items = $state<Item[]>([
    { id: '1', name: 'Fire Spirit', rarity: 'rare', cost: 2, image: null },
    { id: '2', name: 'Water Spirit', rarity: 'common', cost: 1, image: null },
    { id: '3', name: 'Earth Spirit', rarity: 'epic', cost: 3, image: null }
  ]);

  // Search & filters
  let searchValue = $state('');
  let selectedRarity = $state<string | null>(null);

  const filters = [
    {
      key: 'rarity',
      label: 'Rarity',
      options: [
        { label: 'Common', value: 'common' },
        { label: 'Rare', value: 'rare' },
        { label: 'Epic', value: 'epic' }
      ],
      value: selectedRarity
    }
  ];

  function handleFilterChange(key: string, value: string | number | boolean | null) {
    if (key === 'rarity') {
      selectedRarity = value as string | null;
    }
  }

  // Filtered items
  const filteredItems = $derived(
    items.filter((item) => {
      const matchesSearch = !searchValue ||
        item.name.toLowerCase().includes(searchValue.toLowerCase());
      const matchesRarity = !selectedRarity || item.rarity === selectedRarity;
      return matchesSearch && matchesRarity;
    })
  );

  // Dialog state
  let showDeleteDialog = $state(false);
  let itemToDelete = $state<Item | null>(null);

  function confirmDelete(item: Item) {
    itemToDelete = item;
    showDeleteDialog = true;
  }

  function handleDelete() {
    if (itemToDelete) {
      items = items.filter((i) => i.id !== itemToDelete.id);
      itemToDelete = null;
    }
  }

  // Number control example
  let quantity = $state(1);
</script>

<section class="page">
  <header class="page-header">
    <h1>Item Manager</h1>
    <NumberControl bind:value={quantity} min={1} max={10} label="Items per page" />
  </header>

  <FilterBar
    bind:searchValue
    searchPlaceholder="Search items..."
    {filters}
    onfilterchange={handleFilterChange}
  />

  <DataGrid items={filteredItems} columns={3} emptyMessage="No items found" emptyIcon="🔍">
    {#snippet item({ item })}
      <article class="card">
        <header class="card-header">
          <h3>{item.name}</h3>
          <span class="tag">{item.rarity}</span>
        </header>

        <ImageUploader
          bind:value={item.image}
          folder={`items/${item.id}`}
          maxSizeMB={2}
          aspectRatio="4/3"
          onupload={(path) => console.log('Uploaded:', path)}
          onerror={(error) => alert(error)}
        />

        <div class="card-meta">
          <span>Cost: {item.cost}</span>
        </div>

        <footer class="card-actions">
          <button class="btn btn--danger" onclick={() => confirmDelete(item)}>
            Delete
          </button>
        </footer>
      </article>
    {/snippet}
  </DataGrid>

  <ConfirmDialog
    bind:open={showDeleteDialog}
    title="Delete Item"
    message={`Delete "${itemToDelete?.name}"? This cannot be undone.`}
    variant="danger"
    confirmLabel="Delete"
    onconfirm={handleDelete}
  />
</section>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 2rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 10px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #f8fafc;
  }

  .tag {
    padding: 0.25rem 0.5rem;
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 4px;
    font-size: 0.75rem;
    color: #93c5fd;
    text-transform: uppercase;
  }

  .card-meta {
    display: flex;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .card-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(30, 41, 59, 0.7);
    color: #cbd5f5;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s ease;
  }

  .btn--danger {
    background: rgba(248, 113, 113, 0.25);
    border-color: rgba(248, 113, 113, 0.45);
    color: #fecaca;
  }

  .btn--danger:hover {
    background: rgba(248, 113, 113, 0.35);
  }
</style>
```

## Individual Component Examples

### 1. ConfirmDialog - Multiple Variants

```svelte
<script lang="ts">
  import { ConfirmDialog } from '$lib/components/shared';

  let showInfo = $state(false);
  let showWarning = $state(false);
  let showDanger = $state(false);
</script>

<button onclick={() => showInfo = true}>Info Dialog</button>
<button onclick={() => showWarning = true}>Warning Dialog</button>
<button onclick={() => showDanger = true}>Danger Dialog</button>

<ConfirmDialog
  bind:open={showInfo}
  title="Information"
  message="This is an informational message."
  variant="info"
  confirmLabel="Got it"
/>

<ConfirmDialog
  bind:open={showWarning}
  title="Warning"
  message="This action may have consequences."
  variant="warning"
  confirmLabel="Proceed"
  onconfirm={() => console.log('Warned and confirmed')}
/>

<ConfirmDialog
  bind:open={showDanger}
  title="Delete Account"
  message="This will permanently delete your account and all data."
  variant="danger"
  confirmLabel="Delete Forever"
  onconfirm={() => console.log('Account deleted')}
/>
```

### 2. ImageUploader - Custom Aspect Ratios

```svelte
<script lang="ts">
  import { ImageUploader } from '$lib/components/shared';

  let squareImage = $state<string | null>(null);
  let wideImage = $state<string | null>(null);
  let tallImage = $state<string | null>(null);
</script>

<div class="upload-grid">
  <div>
    <h3>Square (1:1)</h3>
    <ImageUploader
      bind:value={squareImage}
      aspectRatio="1/1"
      folder="square"
    />
  </div>

  <div>
    <h3>Wide (16:9)</h3>
    <ImageUploader
      bind:value={wideImage}
      aspectRatio="16/9"
      folder="wide"
    />
  </div>

  <div>
    <h3>Portrait (9:16)</h3>
    <ImageUploader
      bind:value={tallImage}
      aspectRatio="9/16"
      folder="tall"
    />
  </div>
</div>
```

### 3. DataGrid - Responsive Columns

```svelte
<script lang="ts">
  import { DataGrid } from '$lib/components/shared';

  const items = Array.from({ length: 12 }, (_, i) => ({
    id: String(i + 1),
    title: `Item ${i + 1}`
  }));
</script>

<h3>2 Columns</h3>
<DataGrid items={items} columns={2}>
  {#snippet item({ item })}
    <div class="card">{item.title}</div>
  {/snippet}
</DataGrid>

<h3>4 Columns</h3>
<DataGrid items={items} columns={4}>
  {#snippet item({ item })}
    <div class="card">{item.title}</div>
  {/snippet}
</DataGrid>

<h3>6 Columns (Dense)</h3>
<DataGrid items={items} columns={6}>
  {#snippet item({ item })}
    <div class="card">{item.title}</div>
  {/snippet}
</DataGrid>
```

### 4. FilterBar - Complex Filters

```svelte
<script lang="ts">
  import { FilterBar } from '$lib/components/shared';

  let search = $state('');
  let selectedType = $state<string | null>(null);
  let selectedLevel = $state<number | null>(null);
  let selectedActive = $state<boolean | null>(null);

  const filters = [
    {
      key: 'type',
      label: 'Type',
      options: [
        { label: 'Fire', value: 'fire' },
        { label: 'Water', value: 'water' },
        { label: 'Earth', value: 'earth' },
        { label: 'Air', value: 'air' }
      ],
      value: selectedType
    },
    {
      key: 'level',
      label: 'Level',
      options: [
        { label: '1', value: 1 },
        { label: '2', value: 2 },
        { label: '3', value: 3 },
        { label: '4', value: 4 },
        { label: '5', value: 5 }
      ],
      value: selectedLevel
    },
    {
      key: 'active',
      label: 'Status',
      options: [
        { label: 'Active', value: true },
        { label: 'Inactive', value: false }
      ],
      value: selectedActive
    }
  ];

  function handleFilterChange(key: string, value: string | number | boolean | null) {
    switch (key) {
      case 'type':
        selectedType = value as string | null;
        break;
      case 'level':
        selectedLevel = value as number | null;
        break;
      case 'active':
        selectedActive = value as boolean | null;
        break;
    }
  }
</script>

<FilterBar
  bind:searchValue={search}
  {filters}
  onfilterchange={handleFilterChange}
/>

<pre>
Search: {search}
Type: {selectedType ?? 'All'}
Level: {selectedLevel ?? 'All'}
Active: {selectedActive ?? 'All'}
</pre>
```

### 5. NumberControl - Different Use Cases

```svelte
<script lang="ts">
  import { NumberControl } from '$lib/components/shared';

  let quantity = $state(1);
  let price = $state(9.99);
  let percentage = $state(50);
  let inventory = $state(100);
</script>

<div class="controls">
  <NumberControl
    bind:value={quantity}
    min={1}
    max={99}
    step={1}
    label="Quantity"
  />

  <NumberControl
    bind:value={price}
    min={0}
    step={0.01}
    label="Price ($)"
  />

  <NumberControl
    bind:value={percentage}
    min={0}
    max={100}
    step={5}
    label="Discount (%)"
  />

  <NumberControl
    bind:value={inventory}
    min={0}
    step={10}
    label="Stock Level"
  />
</div>
```

## Integration Patterns

### With Form Validation

```svelte
<script lang="ts">
  import { NumberControl, ConfirmDialog } from '$lib/components/shared';

  let age = $state(18);
  let showError = $state(false);

  function handleSubmit() {
    if (age < 18) {
      showError = true;
    } else {
      console.log('Form submitted:', age);
    }
  }
</script>

<form onsubmit|preventDefault={handleSubmit}>
  <NumberControl
    bind:value={age}
    min={0}
    max={120}
    label="Age"
  />
  <button type="submit">Submit</button>
</form>

<ConfirmDialog
  bind:open={showError}
  title="Invalid Age"
  message="You must be at least 18 years old."
  variant="warning"
  confirmLabel="OK"
/>
```

### With Loading States

```svelte
<script lang="ts">
  import { DataGrid, ImageUploader } from '$lib/components/shared';

  let loading = $state(true);
  let items = $state<any[]>([]);

  onMount(async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    items = await fetchItems();
    loading = false;
  });
</script>

{#if loading}
  <div class="loading">Loading items...</div>
{:else}
  <DataGrid {items}>
    {#snippet item({ item })}
      <div class="card">
        <ImageUploader bind:value={item.image} />
      </div>
    {/snippet}
  </DataGrid>
{/if}
```
