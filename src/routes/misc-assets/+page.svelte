<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/api/supabaseClient';
  import { EditorModal } from '$lib';
  import CardActionMenu from '$lib/components/CardActionMenu.svelte';

  type MiscAsset = {
    id: string;
    name: string;
    description: string | null;
    file_path: string;
    file_type: string | null;
    file_size: number | null;
    category: string | null;
    created_at: string | null;
    updated_at: string | null;
    file_url: string | null;
  };

  const storage = supabase.storage.from('game_assets');

  let assets: MiscAsset[] = [];
  let loading = true;
  let error: string | null = null;
  let showForm = false;
  let editing: MiscAsset | null = null;
  let formData: Partial<MiscAsset> = {
    name: '',
    description: '',
    category: '',
    file_path: '',
    file_type: null,
    file_size: null
  };
  let uploading = false;
  let removing = false;

  onMount(loadAssets);

  function publicUrl(path: string | null): string | null {
    if (!path) return null;
    const normalized = path.startsWith('misc_assets/') ? path : `misc_assets/${path}`;
    const { data } = storage.getPublicUrl(normalized);
    return data?.publicUrl ?? null;
  }

  async function loadAssets() {
    loading = true;
    error = null;
    try {
      const { data, error: fetchError } = await supabase
        .from('misc_assets')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      assets = (data ?? []).map((a) => ({ ...a, file_url: publicUrl(a.file_path) }));
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function openForm(asset?: MiscAsset) {
    editing = asset ?? null;
    formData = asset
      ? { ...asset }
      : { name: '', description: '', category: '', file_path: '', file_type: null, file_size: null };
    showForm = true;
  }

  function closeForm() {
    showForm = false;
    editing = null;
    formData = { name: '', description: '', category: '', file_path: '', file_type: null, file_size: null };
  }

  async function handleUpload(file: File) {
    uploading = true;
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'dat';
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
      const basePath = editing?.id ?? crypto.randomUUID();
      const path = `misc_assets/${basePath}/${safeName}`;
      const { error: uploadError } = await storage.upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      });
      if (uploadError) throw uploadError;
      formData.file_path = path;
      formData.file_type = file.type;
      formData.file_size = file.size;
    } catch (err) {
      console.error(err);
      alert('Failed to upload file');
    } finally {
      uploading = false;
    }
  }

  async function removeFile() {
    if (!formData.file_path) return;
    removing = true;
    try {
      const path = formData.file_path.startsWith('misc_assets/')
        ? formData.file_path
        : `misc_assets/${formData.file_path}`;
      await storage.remove([path]);
      formData.file_path = '';
      formData.file_url = null as any;
      formData.file_type = null;
      formData.file_size = null;
    } catch (err) {
      console.error(err);
      alert('Failed to remove file');
    } finally {
      removing = false;
    }
  }

  async function saveAsset() {
    if (!formData.name?.trim()) {
      alert('Name is required');
      return;
    }
    if (!formData.file_path) {
      alert('Upload a file first');
      return;
    }
    const payload = {
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      category: formData.category?.trim() || null,
      file_path: formData.file_path,
      file_type: formData.file_type,
      file_size: formData.file_size,
      updated_at: new Date().toISOString()
    };
    try {
      if (editing) {
        const { error: updateError } = await supabase.from('misc_assets').update(payload).eq('id', editing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('misc_assets').insert(payload);
        if (insertError) throw insertError;
      }
      closeForm();
      await loadAssets();
    } catch (err) {
      console.error(err);
      alert(`Failed to save asset: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function deleteAsset(asset: MiscAsset) {
    if (!confirm(`Delete "${asset.name}"?`)) return;
    try {
      if (asset.file_path) {
        const path = asset.file_path.startsWith('misc_assets/') ? asset.file_path : `misc_assets/${asset.file_path}`;
        await storage.remove([path]);
      }
      const { error: delError } = await supabase.from('misc_assets').delete().eq('id', asset.id);
      if (delError) throw delError;
      await loadAssets();
    } catch (err) {
      console.error(err);
      alert(`Failed to delete asset: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
</script>

<section class="page">
  <header class="page__header">
    <div>
      <h1>Misc Assets</h1>
      <p>Upload and manage generic game assets</p>
    </div>
    <button class="btn" type="button" on:click={() => openForm()}>Create Asset</button>
  </header>

  {#if loading}
    <div class="card">Loading assets…</div>
  {:else if error}
    <div class="card error">Error: {error}</div>
  {:else}
    <div class="components-grid">
      {#each assets as asset}
        <div class="component-card">
          <div class="component-card__header">
            <div class="component-card__content">
              <h3>{asset.name}</h3>
              {#if asset.description}<p>{asset.description}</p>{/if}
              {#if asset.category}<span class="badge">{asset.category}</span>{/if}
            </div>
            <CardActionMenu onEdit={() => openForm(asset)} onDelete={() => deleteAsset(asset)} onGenerate={null} />
          </div>
          {#if asset.file_url && asset.file_type?.startsWith('image/')}
            <img class="component-card__image" src={asset.file_url} alt={asset.name} />
          {:else}
            <div class="component-card__placeholder">
              <div>
                <div>{asset.file_type ?? 'file'}</div>
                {#if asset.file_size}
                  <small>{(asset.file_size / 1024).toFixed(1)} KB</small>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="card empty">No assets yet. Upload your first one.</div>
      {/each}
    </div>
  {/if}

  {#if showForm}
    <EditorModal
      title={editing ? 'Edit Asset' : 'Create Asset'}
      description="Store any supporting files for the project."
      size="md"
      on:close={closeForm}
    >
      <form
        class="component-form"
        on:submit={(e) => {
          e.preventDefault();
          void saveAsset();
        }}
      >
        <label>
          Name *
          <input type="text" bind:value={formData.name} required />
        </label>

        <label>
          Description
          <textarea rows="3" bind:value={formData.description}></textarea>
        </label>

        <label>
          Category
          <input type="text" bind:value={formData.category} placeholder="e.g. tokens, rules, art" />
        </label>

        <label>
          File
          <div class="image-upload-section">
			{#if formData.file_path}
				{#if publicUrl(formData.file_path)}
					<div class="image-preview">
						<a href={publicUrl(formData.file_path)} target="_blank" rel="noreferrer">View file</a>
					</div>
				{/if}
				<button class="btn btn--small btn--danger" type="button" on:click={removeFile} disabled={removing}>
					{removing ? 'Removing…' : 'Remove File'}
				</button>
			{/if}
            <label class="btn btn--small">
              {uploading ? 'Uploading…' : 'Upload File'}
              <input
                type="file"
                on:change={(e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) void handleUpload(file);
                }}
                disabled={uploading}
                style="display: none;"
              />
            </label>
          </div>
        </label>
      </form>

      <div slot="footer" class="modal-footer-actions">
        <button class="btn btn--primary" type="button" on:click={saveAsset}>Save</button>
        <button class="btn" type="button" on:click={closeForm}>Cancel</button>
      </div>
    </EditorModal>
  {/if}
</section>

<style>
  .page { display: flex; flex-direction: column; gap: 1rem; }
  .page__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .components-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
  .component-card { position: relative; background: rgba(15,23,42,0.65); border: 1px solid rgba(148,163,184,0.18); border-radius: 12px; overflow: hidden; transition: transform 0.15s ease, box-shadow 0.15s ease; display: flex; flex-direction: column; }
  .component-card__header { display: flex; justify-content: space-between; gap: 0.5rem; padding: 1rem; }
  .component-card__content h3 { margin: 0 0 0.35rem; color: #f8fafc; }
  .component-card__content p { margin: 0; color: #cbd5f5; }
  .component-card__image { width: 100%; height: 200px; object-fit: cover; }
  .component-card__placeholder { width: 100%; height: 200px; display: grid; place-items: center; background: rgba(30,41,59,0.5); color: #94a3b8; }
  .badge { display: inline-flex; padding: 0.2rem 0.55rem; border-radius: 999px; background: rgba(148,163,184,0.25); color: #e2e8f0; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
  .component-form { display: flex; flex-direction: column; gap: 1rem; }
  .component-form input, .component-form textarea { padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(148,163,184,0.25); background: rgba(15,23,42,0.6); color: #f8fafc; }
  .image-upload-section { display: flex; flex-direction: column; gap: 0.75rem; }
  .btn--small { padding: 0.4rem 0.75rem; font-size: 0.85rem; }
  .btn--danger { background: rgba(248,113,113,0.2); border-color: rgba(248,113,113,0.4); }
</style>
