#!/usr/bin/env node

/**
 * Upload TTS Menu Images to Supabase Storage
 *
 * This script uploads the exported guardian images to Supabase storage
 * in the format expected by the tts-menu page.
 *
 * Usage: node upload-tts-images.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync } from 'fs';

// Supabase configuration
const SUPABASE_URL = 'https://gvxfokbptelmvvlxbigh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2eGZva2JwdGVsbXZ2bHhiaWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NzY4NTAsImV4cCI6MjA2ODQ1Mjg1MH0.QLIyWCf8AGIUDmGlttbqRKrxxBSOBn_B5O-0yuCwlGE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: 'arc-spirits-rev2' }
});

const storage = supabase.storage.from('game_assets');

// Character names (lowercase) - must match export filenames
const CHARACTERS = ['pixia', 'lumina', 'myrtle', 'embers', 'bubblepop', 'prox'];
const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];

// Export folder paths (relative to this script's location in Google Drive)
const EXPORTS_BASE = '/Users/maikyon/Library/CloudStorage/GoogleDrive-michaelmqvu@gmail.com/My Drive/Arc Spirits/exports';

async function getGuardianIds() {
    console.log('Fetching guardian IDs from database...');

    const { data, error } = await supabase
        .from('guardians')
        .select('id, name')
        .order('name');

    if (error) {
        throw new Error(`Failed to fetch guardians: ${error.message}`);
    }

    // Create a map of lowercase name -> id
    const guardianMap = {};
    for (const guardian of data) {
        guardianMap[guardian.name.toLowerCase()] = guardian.id;
    }

    console.log('Found guardians:', Object.keys(guardianMap).join(', '));
    return guardianMap;
}

async function uploadFile(localPath, storagePath) {
    if (!existsSync(localPath)) {
        console.log(`  ⚠️  File not found: ${localPath}`);
        return false;
    }

    const fileBuffer = await readFile(localPath);
    const blob = new Blob([fileBuffer], { type: 'image/png' });

    const { error } = await storage.upload(storagePath, blob, {
        upsert: true,
        contentType: 'image/png'
    });

    if (error) {
        console.log(`  ❌ Failed to upload ${storagePath}: ${error.message}`);
        return false;
    }

    console.log(`  ✅ Uploaded: ${storagePath}`);
    return true;
}

async function uploadGuardianSlots(guardianMap) {
    console.log('\n📤 Uploading character select (slot) images...');

    let uploaded = 0;
    let failed = 0;

    for (const charName of CHARACTERS) {
        const guardianId = guardianMap[charName];
        if (!guardianId) {
            console.log(`  ⚠️  No guardian ID found for: ${charName}`);
            failed++;
            continue;
        }

        const localPath = join(EXPORTS_BASE, `${charName}-slot.png`);
        const storagePath = `tts_menu/guardians/${guardianId}/char_select.png`;

        const success = await uploadFile(localPath, storagePath);
        if (success) uploaded++;
        else failed++;
    }

    console.log(`\nSlot uploads: ${uploaded} success, ${failed} failed`);
}

async function uploadSelectedImages(guardianMap) {
    console.log('\n📤 Uploading color selected images...');

    let uploaded = 0;
    let failed = 0;

    for (const charName of CHARACTERS) {
        const guardianId = guardianMap[charName];
        if (!guardianId) {
            console.log(`  ⚠️  No guardian ID found for: ${charName}`);
            failed += COLORS.length;
            continue;
        }

        for (const color of COLORS) {
            const localPath = join(EXPORTS_BASE, 'selected', `${charName}-${color}-selected.png`);
            const storagePath = `tts_menu/guardians/${guardianId}/${color}_selected.png`;

            const success = await uploadFile(localPath, storagePath);
            if (success) uploaded++;
            else failed++;
        }
    }

    console.log(`\nSelected uploads: ${uploaded} success, ${failed} failed`);
}

async function main() {
    console.log('🚀 TTS Menu Image Uploader\n');
    console.log('Export folder:', EXPORTS_BASE);

    // Check if export folder exists
    if (!existsSync(EXPORTS_BASE)) {
        console.error(`❌ Export folder not found: ${EXPORTS_BASE}`);
        console.log('\nPlease run the Photoshop export scripts first:');
        console.log('  1. export-guardians.jsx (creates slot images)');
        console.log('  2. export-selected.jsx (creates color selected images)');
        process.exit(1);
    }

    try {
        // Get guardian IDs
        const guardianMap = await getGuardianIds();

        // Upload slot images (char_select)
        await uploadGuardianSlots(guardianMap);

        // Upload selected images (color_selected)
        await uploadSelectedImages(guardianMap);

        console.log('\n✨ Upload complete!');
        console.log('View at: http://localhost:5173/tts-menu');

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        process.exit(1);
    }
}

main();
