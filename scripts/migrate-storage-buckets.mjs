#!/usr/bin/env node
/**
 * Migration script to consolidate all storage buckets into game_assets
 * 
 * This script:
 * 1. Copies all files from old buckets to game_assets with proper folder structure
 * 2. Updates database paths
 * 3. Deletes old buckets
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envFile = join(__dirname, '..', '.env.local');
let envVars = {};
try {
  const envContent = readFileSync(envFile, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
} catch (err) {
  console.warn('Could not read .env.local, using process.env');
}

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || envVars.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || envVars.VITE_SUPABASE_URL || 'https://gvxfokbptelmvvlxbigh.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY as an environment variable:');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.error('Or add it to .env.local:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.error('\nYou can find your service role key in:');
  console.error('  Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const MIGRATIONS = [
  {
    oldBucket: 'class_icons',
    newFolder: 'class_icons',
    table: 'classes',
    pathColumn: 'icon'
  },
  {
    oldBucket: 'origin_icons',
    newFolder: 'origin_icons',
    table: 'origins',
    pathColumn: 'icon'
  },
  {
    oldBucket: 'hex_spirit_images',
    newFolder: 'hex_spirits',
    table: 'hex_spirits',
    pathColumn: 'image_path'
  },
  {
    oldBucket: 'rune_backgrounds',
    newFolder: 'rune_backgrounds',
    table: null, // No database table for this
    pathColumn: null
  }
];

async function listAllFiles(bucket, folder = '', allFiles = []) {
  const { data: items, error } = await supabase.storage
    .from(bucket)
    .list(folder, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  
  if (error) {
    console.error(`   ⚠️  Error listing ${folder || 'root'}:`, error.message);
    return allFiles;
  }
  
  if (!items || items.length === 0) {
    return allFiles;
  }
  
  for (const item of items) {
    const fullPath = folder ? `${folder}/${item.name}` : item.name;
    
    // Files have properties like 'id', 'size', 'mimeType', or 'metadata'
    // Folders only have 'name' and are typically null or undefined for file properties
    const isFile = item.id !== null && item.id !== undefined || 
                   item.size !== null && item.size !== undefined ||
                   item.mimeType !== null && item.mimeType !== undefined ||
                   (item.metadata !== null && item.metadata !== undefined && Object.keys(item.metadata).length > 0);
    
    if (isFile) {
      // It's a file
      allFiles.push({ path: fullPath, metadata: item.metadata || {}, size: item.size, mimeType: item.mimeType });
    } else {
      // It's a folder, recurse into it
      await listAllFiles(bucket, fullPath, allFiles);
    }
  }
  
  return allFiles;
}

async function migrateBucket(migration) {
  console.log(`\n📦 Migrating ${migration.oldBucket}...`);
  
  // List all files recursively
  const files = await listAllFiles(migration.oldBucket);
  
  if (files.length === 0) {
    console.log(`   ℹ️  No files found in ${migration.oldBucket}`);
    return;
  }
  
  console.log(`   Found ${files.length} file(s)`);
  
  // Copy each file
  for (const file of files) {
    const oldPath = file.path;
    const newPath = `${migration.newFolder}/${oldPath}`;
    
    try {
      // Download file from old bucket
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(migration.oldBucket)
        .download(oldPath);
      
      if (downloadError) {
        console.error(`   ❌ Failed to download ${oldPath}:`, downloadError.message || JSON.stringify(downloadError));
        continue;
      }
      
      if (!fileData) {
        console.error(`   ❌ No data returned for ${oldPath}`);
        continue;
      }
      
      // Upload to new bucket
      const contentType = file.mimeType || file.metadata?.mimetype || file.metadata?.contentType || 'image/png';
      const { error: uploadError } = await supabase.storage
        .from('game_assets')
        .upload(newPath, fileData, {
          contentType: contentType,
          upsert: true
        });
      
      if (uploadError) {
        console.error(`   ❌ Failed to upload ${newPath}:`, uploadError.message);
        continue;
      }
      
      console.log(`   ✅ Migrated: ${oldPath} → ${newPath}`);
      
      // Update database if applicable
      if (migration.table && migration.pathColumn) {
        // Update paths in database
        // Need to handle paths that might already have the folder prefix or not
        const oldPathForDb = oldPath;
        const newPathForDb = newPath;
        
        // Update rows where path matches exactly
        const { error: updateError1 } = await supabase
          .from(migration.table)
          .update({ [migration.pathColumn]: newPathForDb })
          .eq(migration.pathColumn, oldPathForDb);
        
        // Also update rows where path already has folder prefix (backward compatibility)
        const { error: updateError2 } = await supabase
          .from(migration.table)
          .update({ [migration.pathColumn]: newPathForDb })
          .eq(migration.pathColumn, newPathForDb); // This is a no-op but ensures consistency
        
        if (updateError1 && updateError1.code !== 'PGRST116' && updateError2 && updateError2.code !== 'PGRST116') {
          console.warn(`   ⚠️  Could not update DB for ${oldPath}`);
        } else {
          console.log(`   ✅ Updated database paths in ${migration.table}`);
        }
      }
      
      // Delete from old bucket
      const { error: deleteError } = await supabase.storage
        .from(migration.oldBucket)
        .remove([oldPath]);
      
      if (deleteError) {
        console.warn(`   ⚠️  Could not delete ${oldPath} from old bucket:`, deleteError.message);
      }
      
    } catch (err) {
      console.error(`   ❌ Error processing ${oldPath}:`, err.message);
    }
  }
  
  console.log(`   ✨ Completed migration of ${migration.oldBucket}`);
}

async function deleteOldBuckets() {
  console.log(`\n🗑️  Deleting old buckets...`);
  
  for (const migration of MIGRATIONS) {
    // Check if bucket is empty
    const { data: remainingFiles } = await supabase.storage
      .from(migration.oldBucket)
      .list('', { limit: 1 });
    
    if (remainingFiles && remainingFiles.length > 0) {
      console.log(`   ⚠️  Skipping ${migration.oldBucket} - still has files`);
      continue;
    }
    
    // Delete bucket (requires service role)
    const { error } = await supabase.storage.deleteBucket(migration.oldBucket);
    
    if (error) {
      console.error(`   ❌ Failed to delete ${migration.oldBucket}:`, error.message);
    } else {
      console.log(`   ✅ Deleted bucket: ${migration.oldBucket}`);
    }
  }
}

async function main() {
  console.log('🚀 Starting storage bucket migration...\n');
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  
  try {
    // Migrate each bucket
    for (const migration of MIGRATIONS) {
      await migrateBucket(migration);
    }
    
    // Delete old buckets
    await deleteOldBuckets();
    
    console.log('\n✨ Migration complete!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();

