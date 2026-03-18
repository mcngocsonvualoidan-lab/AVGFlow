/**
 * BACKUP IMAGES: Firestore → Cloudflare R2
 * Uses Cloudflare API (REST) instead of S3 protocol
 * 
 * Usage: node backup_images_to_r2.cjs
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════

const CF_ACCOUNT_ID = 'eecb965137b1db283e6e9cff0efec8ae';
const CF_API_TOKEN  = 'liBh8-IYt3g7j9Ea32SE98TBxFDfriIinFygj5T2';
const R2_BUCKET     = 'avgflow';

const FB_PROJECT_ID = 'avgflow-dd822';
const FB_API_KEY    = 'AIzaSyDfEtxQTXzxq_4P42VLWgoeZViD1C9Xw-E';

const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT_ID}/databases/(default)/documents`;

// ═══════════════════════════ 
// HELPERS
// ═══════════════════════════

/** Download a file from URL using fetch (handles redirects automatically) */
async function downloadFile(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    try {
        const res = await fetch(url, { 
            signal: controller.signal,
            redirect: 'follow',
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = res.headers.get('content-type') || 'application/octet-stream';
        
        return { buffer, contentType };
    } finally {
        clearTimeout(timeout);
    }
}

/** Upload to R2 via Cloudflare API (PUT object) */
async function uploadToR2(objectKey, buffer, contentType) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(objectKey)}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': contentType,
        },
        body: buffer,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`R2 upload failed (${res.status}): ${text}`);
    }
    return true;
}

/** List Firestore documents via REST */
async function listDocuments(collectionPath, pageSize = 300) {
    const allDocs = [];
    let pageToken = '';
    do {
        let url = `${FIRESTORE_URL}/${collectionPath}?pageSize=${pageSize}&key=${FB_API_KEY}`;
        if (pageToken) url += `&pageToken=${pageToken}`;
        try {
            const res = await fetch(url);
            if (!res.ok) break;
            const data = await res.json();
            if (data.documents) allDocs.push(...data.documents);
            pageToken = data.nextPageToken || '';
        } catch { break; }
    } while (pageToken);
    return allDocs;
}

/** Extract flat string fields from Firestore doc */
function extractStrings(doc) {
    const result = {};
    if (!doc.fields) return result;
    for (const [k, v] of Object.entries(doc.fields)) {
        if (v.stringValue) result[k] = v.stringValue;
    }
    return result;
}

/** Get doc ID from full path */
function docId(docPath) { return docPath.split('/').pop(); }

/** Check if URL is a Google Drive / Firebase Storage image */
function isImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.includes('googleusercontent.com/d/') ||
           url.includes('drive.google.com/file/d/') ||
           url.includes('drive.google.com/uc?id=') ||
           url.includes('firebasestorage.googleapis.com');
}

/** Extract Drive file ID */
function driveFileId(url) {
    let m = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = url.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    return null;
}

/** Get file extension from content type */
function ext(ct) {
    if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
    if (ct.includes('png')) return '.png';
    if (ct.includes('gif')) return '.gif';
    if (ct.includes('webp')) return '.webp';
    if (ct.includes('svg')) return '.svg';
    if (ct.includes('pdf')) return '.pdf';
    return '.bin';
}

// ══════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════

const stats = { found: 0, uploaded: 0, skipped: 0, failed: [] };
const allImages = [];

async function scanCollection(colPath, prefix) {
    process.stdout.write(`📂 ${colPath}... `);
    const docs = await listDocuments(colPath);
    let count = 0;
    for (const doc of docs) {
        const fields = extractStrings(doc);
        const id = docId(doc.name);
        for (const [field, value] of Object.entries(fields)) {
            if (isImageUrl(value)) {
                allImages.push({ docId: id, field, url: value, prefix, collection: colPath });
                count++;
            }
        }
    }
    console.log(`${docs.length} docs, ${count} images`);
}

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('  🔄 BACKUP: Firestore → Cloudflare R2');
    console.log('═══════════════════════════════════════════');
    console.log(`  Project:   ${FB_PROJECT_ID}`);
    console.log(`  Bucket:    ${R2_BUCKET}`);
    console.log(`  Time:      ${new Date().toLocaleString('vi-VN')}`);
    console.log('═══════════════════════════════════════════\n');

    // Test R2
    process.stdout.write('🔗 Testing R2... ');
    try {
        const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}`, {
            headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` }
        });
        const d = await r.json();
        if (d.success) console.log('✅ OK');
        else throw new Error(JSON.stringify(d.errors));
    } catch (e) {
        console.log('❌ FAILED:', e.message);
        process.exit(1);
    }

    // Test Firestore
    process.stdout.write('🔗 Testing Firestore... ');
    try {
        const r = await fetch(`${FIRESTORE_URL}/users?pageSize=1&key=${FB_API_KEY}`);
        if (r.ok) console.log('✅ OK');
        else throw new Error(`HTTP ${r.status}`);
    } catch (e) {
        console.log('❌ FAILED:', e.message);
        process.exit(1);
    }

    console.log('\n🔍 Scanning Firestore collections...\n');

    // Scan all top-level collections
    const collections = [
        'internal_news', 'users', 'birthday_wishes', 'tasks',
        'documents', 'conclusion_docs', 'executive_directives',
        'confessions', 'chat_messages', 'announcements',
    ];

    for (const col of collections) {
        try { await scanCollection(col, col); } catch {}
    }

    // Scan chat sub-collections
    console.log('\n📂 Scanning chat messages...');
    try {
        const convDocs = await listDocuments('conversations');
        console.log(`   ${convDocs.length} conversations found`);
        for (const conv of convDocs) {
            const cid = docId(conv.name);
            try {
                const msgs = await listDocuments(`conversations/${cid}/messages`);
                for (const msg of msgs) {
                    const fields = extractStrings(msg);
                    const mid = docId(msg.name);
                    for (const [field, value] of Object.entries(fields)) {
                        if (isImageUrl(value)) {
                            allImages.push({ docId: mid, field, url: value, prefix: `chat/${cid}`, collection: `conversations/${cid}/messages` });
                        }
                    }
                }
            } catch {}
        }
    } catch (e) {
        console.log('   ℹ️ No conversations');
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
    console.log(`📊 Total unique images: ${unique.length}`);
    console.log(`═══════════════════════════════════════════\n`);

    if (unique.length === 0) {
        console.log('✅ No images to backup!');
        return;
    }

    // Download and upload
    const backups = [];
    for (let i = 0; i < unique.length; i++) {
        const img = unique[i];
        const tag = `[${i + 1}/${unique.length}]`;

        try {
            let dlUrl = img.url;
            if (img.url.includes('drive.google.com')) {
                const fid = driveFileId(img.url);
                if (fid) dlUrl = `https://lh3.googleusercontent.com/d/${fid}`;
            }

            process.stdout.write(`  ⬇️  ${tag} ${img.prefix}/${img.docId}.${img.field}... `);
            const { buffer, contentType } = await downloadFile(dlUrl);

            if (buffer.length < 200) {
                console.log(`⏭️ skip (${buffer.length}B)`);
                stats.skipped++;
                continue;
            }

            const e = ext(contentType);
            const r2Key = `backup/${img.prefix}/${img.docId}_${img.field}${e}`;

            process.stdout.write(`⬆️ R2 (${(buffer.length / 1024).toFixed(1)}KB)... `);
            await uploadToR2(r2Key, buffer, contentType);
            console.log('✅');

            stats.uploaded++;
            backups.push({
                docId: img.docId, field: img.field, collection: img.collection,
                originalUrl: img.url, r2Key, size: buffer.length, contentType,
            });
        } catch (err) {
            console.log(`❌ ${err.message}`);
            stats.failed.push({ ...img, error: err.message });
        }

        // Pause every 5 to avoid rate limits
        if (i > 0 && i % 5 === 0) await new Promise(r => setTimeout(r, 300));
    }

    // Save manifest
    const manifest = {
        timestamp: new Date().toISOString(),
        project: FB_PROJECT_ID,
        bucket: R2_BUCKET,
        stats, backups,
    };
    const manifestPath = path.resolve(`./r2_backup_manifest.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Upload manifest to R2
    try {
        await uploadToR2(`backup/_manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2)), 'application/json');
    } catch {}

    // Summary
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  ✅ BACKUP HOÀN TẤT`);
    console.log(`═══════════════════════════════════════════`);
    console.log(`  🖼️  Tìm thấy:     ${stats.found} ảnh`);
    console.log(`  ⬆️  Upload R2:    ${stats.uploaded} ảnh`);
    console.log(`  ⏭️  Bỏ qua:       ${stats.skipped}`);
    console.log(`  ❌ Thất bại:      ${stats.failed.length}`);
    console.log(`  📄 Manifest:      ${manifestPath}`);
    console.log(`═══════════════════════════════════════════\n`);

    if (stats.failed.length > 0) {
        console.log('❌ Chi tiết lỗi:');
        stats.failed.forEach(f => console.log(`   - ${f.collection}/${f.docId}: ${f.error}`));
    }
}

main().catch(err => {
    console.error('\n💥 Fatal:', err);
    process.exit(1);
});
