/**
 * BACKUP IMAGES FROM FIRESTORE → CLOUDFLARE R2
 * 
 * Uses Firebase REST API (no Admin SDK needed) to scan Firestore,
 * then downloads Google Drive images and uploads to R2.
 * 
 * Usage: node backup_images_to_r2.mjs
 */

import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

// ══════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════

const R2 = {
    accountId: 'eecb965137b1db283e6e9cff0efec8ae',
    accessKeyId: 'da6651d5e4c651c3fb143cffa071599b',
    secretAccessKey: 'ebf6683d41e894e2bc6dc057883cf5720926d2fd070132cdaa9f0dcc5b7062a1',
    bucketName: 'avgflow',
};

const FIREBASE = {
    projectId: 'avgflow-dd822',
    apiKey: 'AIzaSyDfEtxQTXzxq_4P42VLWgoeZViD1C9Xw-E',
};

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents`;

// ══════════════════════════════════════════
// INIT R2 CLIENT
// ══════════════════════════════════════════

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2.accessKeyId,
        secretAccessKey: R2.secretAccessKey,
    },
});

// ══════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════

/** Fetch JSON from URL */
async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
}

/** List all documents in a Firestore collection via REST */
async function listDocuments(collectionPath, pageSize = 300) {
    const allDocs = [];
    let pageToken = '';
    
    do {
        let url = `${FIRESTORE_BASE}/${collectionPath}?pageSize=${pageSize}&key=${FIREBASE.apiKey}`;
        if (pageToken) url += `&pageToken=${pageToken}`;
        
        try {
            const data = await fetchJson(url);
            if (data.documents) allDocs.push(...data.documents);
            pageToken = data.nextPageToken || '';
        } catch (e) {
            console.log(`   ⚠️  Error listing ${collectionPath}: ${e.message}`);
            break;
        }
    } while (pageToken);
    
    return allDocs;
}

/** List collection IDs under a document */
async function listCollectionIds(documentPath) {
    const url = `${FIRESTORE_BASE}/${documentPath}:listCollectionIds?key=${FIREBASE.apiKey}`;
    try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (!res.ok) return [];
        const data = await res.json();
        return data.collectionIds || [];
    } catch {
        return [];
    }
}

/** Extract flat field values from Firestore REST document */
function extractFieldValues(doc) {
    const result = {};
    if (!doc.fields) return result;
    
    for (const [key, valueObj] of Object.entries(doc.fields)) {
        if (valueObj.stringValue !== undefined) {
            result[key] = valueObj.stringValue;
        } else if (valueObj.integerValue !== undefined) {
            result[key] = parseInt(valueObj.integerValue);
        } else if (valueObj.booleanValue !== undefined) {
            result[key] = valueObj.booleanValue;
        }
    }
    return result;
}

/** Extract doc ID from full Firestore path */
function getDocId(docPath) {
    return docPath.split('/').pop();
}

/** Extract Google Drive file ID from URL */
function extractDriveFileId(url) {
    if (!url || typeof url !== 'string') return null;
    let m = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = url.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    return null;
}

/** Check if a URL is an image URL worth backing up */
function isImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return (
        url.includes('googleusercontent.com/d/') ||
        url.includes('drive.google.com/file/d/') ||
        url.includes('drive.google.com/uc?id=') ||
        url.includes('firebasestorage.googleapis.com')
    );
}

/** Download file with redirect following */
function downloadFile(url, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
        const client = url.startsWith('https') ? https : http;
        
        const req = client.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (BackupBot/1.0)' },
            timeout: 30000,
        }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                let redirect = res.headers.location;
                if (redirect.startsWith('/')) redirect = new URL(url).origin + redirect;
                return downloadFile(redirect, maxRedirects - 1).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({
                buffer: Buffer.concat(chunks),
                contentType: res.headers['content-type'] || 'application/octet-stream'
            }));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

/** Get extension from content type */
function extFromType(ct) {
    const map = {
        'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
        'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/bmp': '.bmp',
        'application/pdf': '.pdf',
    };
    for (const [k, v] of Object.entries(map)) {
        if (ct.includes(k)) return v;
    }
    return '.bin';
}

/** Upload to R2 */
async function uploadToR2(key, buffer, contentType) {
    await s3.send(new PutObjectCommand({
        Bucket: R2.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    }));
}

// ══════════════════════════════════════════
// SCAN COLLECTIONS
// ══════════════════════════════════════════

const stats = { found: 0, uploaded: 0, skipped: 0, failed: [] };
const allImages = [];

async function scanCollection(path, prefix) {
    console.log(`\n📂 Scanning: ${path}`);
    const docs = await listDocuments(path);
    console.log(`   📄 ${docs.length} documents`);
    
    let count = 0;
    for (const doc of docs) {
        const fields = extractFieldValues(doc);
        const docId = getDocId(doc.name);
        
        for (const [field, value] of Object.entries(fields)) {
            if (isImageUrl(value)) {
                allImages.push({ docId, field, url: value, prefix, collection: path });
                count++;
            }
        }
    }
    
    if (count > 0) console.log(`   🖼️  ${count} image URLs found`);
    return docs;
}

// ══════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('  🔄 BACKUP: Firestore Images → Cloudflare R2');
    console.log('═══════════════════════════════════════════');
    console.log(`  Project:    ${FIREBASE.projectId}`);
    console.log(`  R2 Bucket:  ${R2.bucketName}`);
    console.log(`  Time:       ${new Date().toLocaleString('vi-VN')}`);
    console.log('═══════════════════════════════════════════');
    
    // Test R2
    console.log('\n🔗 Testing R2 connection...');
    try {
        await s3.send(new HeadBucketCommand({ Bucket: R2.bucketName }));
        console.log('✅ R2 connection OK!');
    } catch (err) {
        console.error('❌ R2 connection FAILED:', err.message);
        process.exit(1);
    }
    
    // Step 1: Discover all root collections
    console.log('\n🔍 Discovering Firestore collections...');
    
    const collectionsToScan = [
        'internal_news',
        'users', 
        'birthday_wishes',
        'tasks',
        'documents',
        'conclusion_docs',
        'executive_directives',
        'confessions',
        'chat_messages',
        'conversations',
        'announcements',
    ];
    
    // Scan all top-level collections
    for (const col of collectionsToScan) {
        try {
            await scanCollection(col, col);
        } catch (e) {
            // Collection might not exist, skip
        }
    }
    
    // Scan chat sub-collections (conversations/*/messages)
    console.log('\n📂 Scanning chat sub-collections...');
    try {
        const convDocs = await listDocuments('conversations');
        console.log(`   Found ${convDocs.length} conversations`);
        
        for (const conv of convDocs) {
            const convId = getDocId(conv.name);
            try {
                const msgDocs = await listDocuments(`conversations/${convId}/messages`);
                for (const msg of msgDocs) {
                    const fields = extractFieldValues(msg);
                    const docId = getDocId(msg.name);
                    for (const [field, value] of Object.entries(fields)) {
                        if (isImageUrl(value)) {
                            allImages.push({
                                docId,
                                field,
                                url: value,
                                prefix: `chat/${convId}`,
                                collection: `conversations/${convId}/messages`,
                            });
                        }
                    }
                }
            } catch (e) { /* no messages sub-collection */ }
        }
    } catch (e) {
        console.log('   ℹ️  No conversations found');
    }
    
    // Deduplicate
    const seen = new Set();
    const unique = allImages.filter(img => {
        if (seen.has(img.url)) return false;
        seen.add(img.url);
        return true;
    });
    
    stats.found = unique.length;
    
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`📊 Total unique images to backup: ${unique.length}`);
    console.log(`═══════════════════════════════════════════\n`);
    
    if (unique.length === 0) {
        console.log('✅ No images found. Done!');
        return;
    }
    
    // Step 2: Download and upload each image
    const backups = [];
    
    for (let i = 0; i < unique.length; i++) {
        const img = unique[i];
        const idx = `[${i + 1}/${unique.length}]`;
        
        try {
            // Build download URL
            let downloadUrl = img.url;
            if (img.url.includes('drive.google.com/file/d/')) {
                const fid = extractDriveFileId(img.url);
                if (fid) downloadUrl = `https://lh3.googleusercontent.com/d/${fid}`;
            }
            
            console.log(`  ⬇️  ${idx} Downloading: ${img.prefix}/${img.docId}.${img.field}`);
            const { buffer, contentType } = await downloadFile(downloadUrl);
            
            if (buffer.length < 200) {
                console.log(`  ⏭️  ${idx} Skipped (too small: ${buffer.length}B, likely error page)`);
                stats.skipped++;
                continue;
            }
            
            const ext = extFromType(contentType);
            const r2Key = `backup/${img.prefix}/${img.docId}_${img.field}${ext}`;
            
            console.log(`  ⬆️  ${idx} Uploading: ${r2Key} (${(buffer.length / 1024).toFixed(1)}KB)`);
            await uploadToR2(r2Key, buffer, contentType);
            
            stats.uploaded++;
            backups.push({
                docId: img.docId,
                field: img.field,
                collection: img.collection,
                originalUrl: img.url,
                r2Key,
                size: buffer.length,
                contentType,
            });
            
        } catch (err) {
            console.log(`  ❌ ${idx} Failed: ${err.message}`);
            stats.failed.push({ ...img, error: err.message });
        }
        
        // Rate limit pause every 10 images
        if (i > 0 && i % 10 === 0) {
            await new Promise(r => setTimeout(r, 500));
        }
    }
    
    // Step 3: Save manifest
    const manifest = {
        timestamp: new Date().toISOString(),
        project: FIREBASE.projectId,
        bucket: R2.bucketName,
        stats,
        backups,
    };
    
    const manifestLocal = `/tmp/r2_backup_manifest_${Date.now()}.json`;
    fs.writeFileSync(manifestLocal, JSON.stringify(manifest, null, 2));
    
    try {
        await uploadToR2(
            `backup/_manifest_${new Date().toISOString().slice(0, 10)}.json`,
            Buffer.from(JSON.stringify(manifest, null, 2)),
            'application/json'
        );
        console.log(`\n📄 Manifest uploaded to R2: backup/_manifest_${new Date().toISOString().slice(0, 10)}.json`);
    } catch (e) {}
    
    // Summary
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  ✅ BACKUP HOÀN TẤT`);
    console.log(`═══════════════════════════════════════════`);
    console.log(`  🖼️  Tìm thấy:      ${stats.found} ảnh`);
    console.log(`  ⬆️  Đã upload R2:  ${stats.uploaded} ảnh`);
    console.log(`  ⏭️  Bỏ qua:        ${stats.skipped} ảnh`);
    console.log(`  ❌ Thất bại:       ${stats.failed.length} ảnh`);
    console.log(`  📄 Manifest:       ${manifestLocal}`);
    console.log(`═══════════════════════════════════════════\n`);
    
    if (stats.failed.length > 0) {
        console.log('❌ Danh sách thất bại:');
        stats.failed.forEach(f => console.log(`   - ${f.collection}/${f.docId}.${f.field}: ${f.error}`));
    }
}

main().catch(err => {
    console.error('\n💥 Lỗi nghiêm trọng:', err);
    process.exit(1);
});
