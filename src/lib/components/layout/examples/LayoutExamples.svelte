<script lang="ts">
	import { Modal, Gallery, Drawer, FilterSidebar } from '$lib/components/layout';

	// Example data
	type ExampleItem = {
		id: number;
		name: string;
		imageUrl: string;
	};

	let modalOpen = $state(false);
	let galleryOpen = $state(false);
	let drawerOpen = $state(false);
	let sidebarCollapsed = $state(false);

	let items = $state<ExampleItem[]>([
		{ id: 1, name: 'Item 1', imageUrl: 'https://via.placeholder.com/200' },
		{ id: 2, name: 'Item 2', imageUrl: 'https://via.placeholder.com/200' },
		{ id: 3, name: 'Item 3', imageUrl: 'https://via.placeholder.com/200' }
	]);

	let selectedFilter = $state('all');

	function handleSave() {
		console.log('Save clicked');
		modalOpen = false;
	}
</script>

<div class="examples">
	<h1>Layout Components Examples</h1>

	<section class="example-section">
		<h2>Buttons to Open Components</h2>
		<div class="button-group">
			<button onclick={() => (modalOpen = true)}>Open Modal</button>
			<button onclick={() => (galleryOpen = true)}>Open Gallery</button>
			<button onclick={() => (drawerOpen = true)}>Open Drawer</button>
			<button onclick={() => (sidebarCollapsed = !sidebarCollapsed)}>
				{sidebarCollapsed ? 'Expand' : 'Collapse'} Sidebar
			</button>
		</div>
	</section>

	<section class="example-section">
		<h2>Filter Sidebar</h2>
		<div style="display: flex; gap: 2rem;">
			<FilterSidebar bind:collapsed={sidebarCollapsed}>
				{#snippet header()}
					<h3>Filters</h3>
				{/snippet}

				{#snippet children()}
					<div class="filter-group">
						<label for="filter-select">Filter Type</label>
						<select id="filter-select" bind:value={selectedFilter}>
							<option value="all">All</option>
							<option value="common">Common</option>
							<option value="rare">Rare</option>
							<option value="epic">Epic</option>
						</select>
					</div>

					<div class="filter-group">
						<label>
							<input type="checkbox" />
							Show only favorites
						</label>
					</div>
				{/snippet}

				{#snippet footer()}
					<button class="btn-reset">Reset Filters</button>
				{/snippet}
			</FilterSidebar>

			<div class="content-area">
				<p>Main content area - Current filter: {selectedFilter}</p>
			</div>
		</div>
	</section>
</div>

<!-- Modal Example -->
<Modal bind:open={modalOpen} title="Edit Item" size="md">
	{#snippet children()}
		<div class="form-group">
			<label for="item-name">Item Name</label>
			<input id="item-name" type="text" value="Example Item" />
		</div>

		<div class="form-group">
			<label for="item-description">Description</label>
			<textarea id="item-description" rows="4">Enter description here...</textarea>
		</div>
	{/snippet}

	{#snippet footer()}
		<button onclick={() => (modalOpen = false)}>Cancel</button>
		<button class="btn-primary" onclick={handleSave}>Save</button>
	{/snippet}
</Modal>

<!-- Gallery Example -->
<Gallery
	bind:open={galleryOpen}
	title="Item Gallery"
	{items}
	columns={3}
	emptyMessage="No items to display"
	emptyHint="Add items to see them here"
>
	{#snippet children(item)}
		<div class="gallery-card">
			<div class="gallery-image">
				<img src={item.imageUrl} alt={item.name} />
			</div>
			<div class="gallery-name">{item.name}</div>
		</div>
	{/snippet}
</Gallery>

<!-- Drawer Example -->
<Drawer bind:open={drawerOpen} title="Settings" width="md">
	{#snippet children()}
		<div class="settings-group">
			<h3>General Settings</h3>
			<label>
				<input type="checkbox" checked />
				Enable notifications
			</label>
			<label>
				<input type="checkbox" />
				Dark mode
			</label>
		</div>

		<div class="settings-group">
			<h3>Privacy</h3>
			<label>
				<input type="checkbox" checked />
				Share analytics
			</label>
		</div>
	{/snippet}
</Drawer>

<style>
	.examples {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.example-section {
		margin: 2rem 0;
		padding: 1.5rem;
		background: rgba(8, 14, 32, 0.5);
		border: 1px solid rgba(94, 114, 228, 0.2);
		border-radius: 8px;
	}

	.button-group {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	button {
		padding: 0.5rem 1rem;
		background: rgba(59, 130, 246, 0.2);
		border: 1px solid rgba(59, 130, 246, 0.4);
		color: #f8fafc;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
	}

	button:hover {
		background: rgba(59, 130, 246, 0.3);
		border-color: rgba(59, 130, 246, 0.6);
	}

	.btn-primary {
		background: rgba(59, 130, 246, 0.4);
		border-color: rgba(59, 130, 246, 0.6);
	}

	.btn-primary:hover {
		background: rgba(59, 130, 246, 0.5);
	}

	.btn-reset {
		width: 100%;
		padding: 0.5rem;
		font-size: 0.9rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-size: 0.9rem;
		color: #bfc6f9;
	}

	.form-group input,
	.form-group textarea {
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(94, 114, 228, 0.3);
		border-radius: 4px;
		color: #f8fafc;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filter-group label {
		color: #bfc6f9;
		font-size: 0.9rem;
	}

	.filter-group select {
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(94, 114, 228, 0.3);
		border-radius: 4px;
		color: #f8fafc;
	}

	.content-area {
		flex: 1;
		padding: 2rem;
		background: rgba(8, 14, 32, 0.3);
		border: 1px solid rgba(94, 114, 228, 0.2);
		border-radius: 8px;
	}

	.gallery-card {
		display: flex;
		flex-direction: column;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 8px;
		overflow: hidden;
		transition: transform 0.2s;
	}

	.gallery-card:hover {
		transform: translateY(-4px);
		border-color: rgba(148, 163, 184, 0.3);
	}

	.gallery-image {
		aspect-ratio: 1;
		overflow: hidden;
		background: #1e293b;
	}

	.gallery-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.gallery-name {
		padding: 0.75rem;
		text-align: center;
		font-size: 0.9rem;
		color: #f8fafc;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
	}

	.settings-group {
		margin-bottom: 1.5rem;
	}

	.settings-group h3 {
		margin-bottom: 0.75rem;
		font-size: 1rem;
		color: #f8fafc;
	}

	.settings-group label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		color: #bfc6f9;
		cursor: pointer;
	}
</style>
