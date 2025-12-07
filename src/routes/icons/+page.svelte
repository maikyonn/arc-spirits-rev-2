<script lang="ts">
  import { supabase } from '$lib/api/supabaseClient';
  import { onMount } from 'svelte';

  type IconAsset = {
    id: string;
    name: string;
    file_path: string;
    file_type: string | null;
    file_size: number | null;
    created_at: string | null;
  };

  const storage = supabase.storage.from('game_assets');

  let icons: IconAsset[] = [];
  let uploading = false;
  let error: string | null = null;
  let filesToUpload: File[] = [];
  let dragActive = false;

  const sanitize = (name: string) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);

  const publicUrl = (path: string) => storage.getPublicUrl(path).data.publicUrl;

  async function loadImageBitmap(file: File): Promise<ImageBitmap> {
    const arrayBuffer = await file.arrayBuffer();
    return await createImageBitmap(new Blob([arrayBuffer]));
  }

  async function cropAndResizeToSquare(file: File): Promise<{ blob: Blob; ext: string; contentType: string }> {
    const image = await loadImageBitmap(file);
    const size = 800;
    const side = Math.min(image.width, image.height);
    const sx = (image.width - side) / 2;
    const sy = (image.height - side) / 2;

    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);

    const blob = await canvas.convertToBlob({ type: 'image/png', quality: 0.92 });
    return { blob, ext: 'png', contentType: 'image/png' };
  }

  onMount(async () => {
    await loadIcons();
  });

  async function loadIcons() {
    const { data, error: err } = await supabase
      .from('misc_assets')
      .select('id, name, file_path, file_type, file_size, created_at')
      .eq('category', 'icon')
      .order('created_at', { ascending: false });
    if (err) {
      error = err.message;
      return;
    }
    icons = data ?? [];
  }

  function onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    filesToUpload = Array.from(input.files ?? []);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragActive = false;
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    filesToUpload = dropped;
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    dragActive = true;
  }

  function onDragLeave(event: DragEvent) {
    event.preventDefault();
    dragActive = false;
  }

  async function uploadBatch() {
    if (!filesToUpload.length) return;
    uploading = true;
    error = null;
    try {
      for (const file of filesToUpload) {
        const clean = sanitize(file.name.split('.')[0]) || 'icon';

        const { blob, ext, contentType } = await cropAndResizeToSquare(file);
        const path = `icons/${crypto.randomUUID()}/${clean}.${ext}`;

        const { error: upErr } = await storage.upload(path, blob, {
          cacheControl: '3600',
          upsert: true,
          contentType
        });
        if (upErr) throw upErr;

        const { error: dbErr } = await supabase.from('misc_assets').insert({
          name: clean,
          file_path: path,
          file_type: contentType,
          file_size: blob.size,
          category: 'icon'
        });
        if (dbErr) throw dbErr;
      }
      filesToUpload = [];
      await loadIcons();
    } catch (e) {
      console.error(e);
      error = e instanceof Error ? e.message : String(e);
    } finally {
      uploading = false;
    }
  }

  async function deleteIcon(icon: IconAsset) {
    if (!confirm(`Delete icon "${icon.name}"?`)) return;
    try {
      await storage.remove([icon.file_path]);
      await supabase.from('misc_assets').delete().eq('id', icon.id);
      await loadIcons();
    } catch (e) {
      alert('Failed to delete icon');
    }
  }
</script>

<section class="page">
  <header class="page__header">
    <div>
      <h1>Icon Uploader</h1>
      <p>Batch drop icons, tag them, and store under game_assets/icons/.</p>
    </div>
  </header>

  {#if error}
    <div class="card error">{error}</div>
  {/if}

  <div class="card upload-card" role="region" aria-label="Icon upload dropzone" on:drop={onDrop} on:dragover={onDragOver} on:dragleave={onDragLeave}
    class:drag-active={dragActive}>
    <div class="dropzone">
      <p>Drag & drop icons here or choose files</p>
      <input type="file" multiple accept="image/*" on:change={onFileChange} />
      {#if filesToUpload.length}
        <p>{filesToUpload.length} file(s) selected</p>
      {/if}
    </div>
    <button class="btn" on:click={uploadBatch} disabled={uploading}>
      {uploading ? 'Uploading…' : 'Upload'}
    </button>
  </div>

  <section class="card-grid">
    {#each icons as icon (icon.id)}
      <article class="card icon-card">
        <header>
          <h3>{icon.name}</h3>
          <button class="btn-ghost" on:click={() => deleteIcon(icon)}>🗑️</button>
        </header>
        <div class="preview">
          <img src={publicUrl(icon.file_path)} alt={icon.name} />
        </div>
        <small>{icon.file_type} · {(icon.file_size ?? 0) / 1024 | 0} KB</small>
      </article>
    {/each}
  </section>
</section>

<style>
  .upload-card {
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }
  .dropzone {
    border: 2px dashed rgba(148,163,184,0.4);
    padding: 1rem;
    text-align: center;
    border-radius: 10px;
  }
  .drag-active {
    background: rgba(79, 70, 229, 0.08);
    border-color: rgba(129, 140, 248, 0.8);
  }
  .card-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
  .icon-card header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .preview img {
    width: 100%;
    border-radius: 10px;
    border: 1px solid rgba(148,163,184,0.2);
    background: #0f172a;
  }
  .btn-ghost {
    background: none;
    border: 1px solid rgba(148,163,184,0.25);
    border-radius: 6px;
    padding: 0.25rem 0.5rem;
    color: #e2e8f0;
    cursor: pointer;
  }
</style>
