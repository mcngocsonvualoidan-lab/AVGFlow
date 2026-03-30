/**
 * Backup Service — Export all app data to Google Drive
 * Backs up Firestore collections and Realtime Database data as JSON files.
 */

import { db, realtimeDb } from '../lib/firebase';
import { collection, getDocs } from '@/lib/firestore';
import { ref, get } from 'firebase/database';

// Same Apps Script URL for upload
const DRIVE_BACKUP_URL = 'https://script.google.com/macros/s/AKfycby6E71pwYmKqC5lz3PhNT1HzndmK605ckzl_Ep07WsJQ-4NAiMaPxq0nCGGB-g4x-C7VQ/exec';

// ═══════════════════════════════════════════════════
// FIRESTORE COLLECTIONS TO BACKUP
// ═══════════════════════════════════════════════════
const FIRESTORE_COLLECTIONS = [
    'users',
    'tasks',
    'order_metas',
    'print_orders',
    'conclusion_docs',
    'conclusion_votes',
    'internal_news',
    'notifications',
    'wishes',
    'events',
    'confessions',
    'payroll',
    'meetings',
    'logs',
    'mail',
    'ai_conversations',
    'ai_app_history',
    'chats',
    'chat_rooms',
];

// ═══════════════════════════════════════════════════
// REALTIME DATABASE PATHS TO BACKUP
// ═══════════════════════════════════════════════════
const REALTIME_PATHS = [
    'chatRooms',
    'chatMessages',
    'userChats',
    'minigame_rooms',
];

export interface BackupProgress {
    current: number;
    total: number;
    currentItem: string;
    phase: 'firestore' | 'realtime' | 'uploading' | 'done' | 'error';
}

export interface BackupResult {
    success: boolean;
    url?: string;
    fileName?: string;
    size?: number;
    error?: string;
    timestamp: string;
    collections: number;
    totalDocuments: number;
}

/**
 * Export a single Firestore collection to JSON
 */
async function exportFirestoreCollection(collectionName: string) {
    try {
        const snapshot = await getDocs(collection(db, collectionName));
        const data = snapshot.docs.map(doc => ({
            _id: doc.id,
            ...doc.data()
        }));
        return { name: collectionName, count: data.length, data };
    } catch (error) {
        console.warn(`⚠️ Skipping collection "${collectionName}":`, error);
        return { name: collectionName, count: 0, data: [] };
    }
}

/**
 * Export a Realtime Database path to JSON
 */
async function exportRealtimePath(path: string) {
    try {
        const snapshot = await get(ref(realtimeDb, path));
        return { name: path, data: snapshot.val() || {} };
    } catch (error) {
        console.warn(`⚠️ Skipping realtime path "${path}":`, error);
        return { name: path, data: {} };
    }
}

/**
 * Upload backup JSON to Google Drive via Apps Script
 */
async function uploadBackupToDrive(backupData: any, fileName: string): Promise<BackupResult> {
    try {
        const jsonString = JSON.stringify(backupData, null, 2);
        // Use TextEncoder for proper UTF-8 → base64 encoding
        const encoder = new TextEncoder();
        const uint8 = encoder.encode(jsonString);
        let binaryStr = '';
        for (let i = 0; i < uint8.length; i++) {
            binaryStr += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binaryStr);

        const response = await fetch(DRIVE_BACKUP_URL, {
            method: 'POST',
            redirect: 'follow',
            body: JSON.stringify({
                fileName,
                mimeType: 'application/json',
                base64,
                category: 'backups'
            })
        });

        const result = await response.json();

        if (result.success) {
            return {
                success: true,
                url: result.url,
                fileName: result.fileName,
                size: result.size,
                timestamp: new Date().toISOString(),
                collections: backupData.firestore ? Object.keys(backupData.firestore).length : 0,
                totalDocuments: backupData.metadata?.totalDocuments || 0
            };
        } else {
            throw new Error(result.error || 'Upload failed');
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Backup upload failed',
            timestamp: new Date().toISOString(),
            collections: 0,
            totalDocuments: 0
        };
    }
}

/**
 * 🔄 Full Backup — Export ALL data to Google Drive
 *
 * @param onProgress - Callback for progress updates
 * @returns BackupResult
 */
export async function fullBackupToDrive(
    onProgress?: (progress: BackupProgress) => void
): Promise<BackupResult> {
    const totalItems = FIRESTORE_COLLECTIONS.length + REALTIME_PATHS.length + 1; // +1 for upload step
    let currentItem = 0;
    let totalDocuments = 0;

    const backupData: any = {
        metadata: {
            backupDate: new Date().toISOString(),
            appName: 'AVGFlow',
            version: '1.0',
            firestoreCollections: FIRESTORE_COLLECTIONS.length,
            realtimePaths: REALTIME_PATHS.length,
            totalDocuments: 0
        },
        firestore: {} as Record<string, any>,
        realtimeDatabase: {} as Record<string, any>
    };

    // Phase 1: Export Firestore collections
    for (const colName of FIRESTORE_COLLECTIONS) {
        currentItem++;
        onProgress?.({
            current: currentItem,
            total: totalItems,
            currentItem: `Firestore: ${colName}`,
            phase: 'firestore'
        });

        const result = await exportFirestoreCollection(colName);
        backupData.firestore[colName] = {
            count: result.count,
            documents: result.data
        };
        totalDocuments += result.count;
    }

    // Phase 2: Export Realtime Database paths
    for (const path of REALTIME_PATHS) {
        currentItem++;
        onProgress?.({
            current: currentItem,
            total: totalItems,
            currentItem: `Realtime DB: ${path}`,
            phase: 'realtime'
        });

        const result = await exportRealtimePath(path);
        backupData.realtimeDatabase[path] = result.data;
    }

    // Update metadata
    backupData.metadata.totalDocuments = totalDocuments;

    // Phase 3: Upload to Drive
    currentItem++;
    onProgress?.({
        current: currentItem,
        total: totalItems,
        currentItem: 'Đang tải lên Google Drive...',
        phase: 'uploading'
    });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    const fileName = `AVGFlow_Backup_${dateStr}_${timeStr}.json`;

    const uploadResult = await uploadBackupToDrive(backupData, fileName);

    onProgress?.({
        current: totalItems,
        total: totalItems,
        currentItem: uploadResult.success ? 'Hoàn tất!' : 'Lỗi!',
        phase: uploadResult.success ? 'done' : 'error'
    });

    return uploadResult;
}

// ═══════════════════════════════════════════════════
// RESTORE FROM BACKUP
// ═══════════════════════════════════════════════════

export interface RestoreProgress {
    current: number;
    total: number;
    currentItem: string;
    phase: 'validating' | 'firestore' | 'realtime' | 'done' | 'error';
}

export interface RestoreResult {
    success: boolean;
    error?: string;
    collectionsRestored: number;
    documentsRestored: number;
    realtimePathsRestored: number;
}

/**
 * Parse and validate a backup JSON file
 */
export function parseBackupFile(jsonString: string): {
    valid: boolean;
    data?: any;
    error?: string;
    summary?: { date: string; collections: number; documents: number; realtimePaths: number }
} {
    try {
        const data = JSON.parse(jsonString);

        // Validate structure
        if (!data.metadata || !data.firestore) {
            return { valid: false, error: 'File không đúng định dạng backup AVGFlow.' };
        }

        if (data.metadata.appName !== 'AVGFlow') {
            return { valid: false, error: 'File này không phải backup của AVGFlow.' };
        }

        const collectionCount = Object.keys(data.firestore).length;
        const documentCount = Object.values(data.firestore as Record<string, any>).reduce(
            (sum: number, col: any) => sum + (col.count || col.documents?.length || 0), 0
        );
        const realtimePathCount = data.realtimeDatabase ? Object.keys(data.realtimeDatabase).length : 0;

        return {
            valid: true,
            data,
            summary: {
                date: data.metadata.backupDate,
                collections: collectionCount,
                documents: documentCount,
                realtimePaths: realtimePathCount
            }
        };
    } catch (error) {
        return { valid: false, error: 'Không thể đọc file JSON: ' + (error instanceof Error ? error.message : 'Unknown') };
    }
}

/**
 * 🔁 Restore data from a backup JSON file
 *
 * @param backupData - The parsed backup data object
 * @param options - Restore options
 * @param onProgress - Callback for progress updates
 * @returns RestoreResult
 */
export async function restoreFromBackup(
    backupData: any,
    options: {
        restoreFirestore?: boolean;
        restoreRealtime?: boolean;
        selectedCollections?: string[]; // If empty, restore all
    } = {},
    onProgress?: (progress: RestoreProgress) => void
): Promise<RestoreResult> {
    const {
        restoreFirestore = true,
        restoreRealtime = true,
        selectedCollections
    } = options;

    let collectionsRestored = 0;
    let documentsRestored = 0;
    let realtimePathsRestored = 0;

    // Calculate total items for progress
    const firestoreCollections = restoreFirestore
        ? Object.keys(backupData.firestore || {}).filter(
            c => !selectedCollections || selectedCollections.length === 0 || selectedCollections.includes(c)
        )
        : [];
    const realtimePaths = restoreRealtime
        ? Object.keys(backupData.realtimeDatabase || {})
        : [];

    const totalItems = firestoreCollections.length + realtimePaths.length;
    let currentItem = 0;

    try {
        // Phase 1: Restore Firestore collections
        for (const colName of firestoreCollections) {
            currentItem++;
            onProgress?.({
                current: currentItem,
                total: totalItems,
                currentItem: `Firestore: ${colName}`,
                phase: 'firestore'
            });

            const colData = backupData.firestore[colName];
            const documents = colData.documents || colData.data || [];

            if (!documents || documents.length === 0) continue;

            // Use batched writes (max 500 per batch)
            const { writeBatch, doc: firestoreDoc } = await import('@/lib/firestore');
            let batch = writeBatch(db);
            let batchCount = 0;

            for (const docData of documents) {
                const docId = docData._id || docData.id;
                if (!docId) continue;

                // Remove internal fields
                const cleanData = { ...docData };
                delete cleanData._id;

                batch.set(firestoreDoc(db, colName, docId), cleanData, { merge: true });
                batchCount++;
                documentsRestored++;

                if (batchCount >= 450) { // Leave margin below 500
                    await batch.commit();
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            }

            // Commit remaining
            if (batchCount > 0) {
                await batch.commit();
            }

            collectionsRestored++;
        }

        // Phase 2: Restore Realtime Database paths
        for (const path of realtimePaths) {
            currentItem++;
            onProgress?.({
                current: currentItem,
                total: totalItems,
                currentItem: `Realtime DB: ${path}`,
                phase: 'realtime'
            });

            const pathData = backupData.realtimeDatabase[path];
            if (!pathData || Object.keys(pathData).length === 0) continue;

            const { set: rtSet } = await import('firebase/database');
            await rtSet(ref(realtimeDb, path), pathData);
            realtimePathsRestored++;
        }

        onProgress?.({
            current: totalItems,
            total: totalItems,
            currentItem: 'Hoàn tất khôi phục!',
            phase: 'done'
        });

        return {
            success: true,
            collectionsRestored,
            documentsRestored,
            realtimePathsRestored
        };

    } catch (error) {
        onProgress?.({
            current: currentItem,
            total: totalItems,
            currentItem: 'Lỗi khôi phục!',
            phase: 'error'
        });

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Restore failed',
            collectionsRestored,
            documentsRestored,
            realtimePathsRestored
        };
    }
}
