/**
 * 🔋 Tracked Firestore Operations
 * 
 * Global interceptors for ALL Firestore reads/writes/deletes.
 * Import these instead of firebase/firestore originals to auto-track usage.
 * 
 * Usage: Replace imports in any file:
 *   BEFORE: import { setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
 *   AFTER:  import { trackedSetDoc, trackedDeleteDoc, trackedOnSnapshot } from '../../lib/trackedFirestore';
 * 
 * OR (simpler): Use the installGlobalTracker() to monkey-patch at app startup.
 */

import {
    setDoc, updateDoc, deleteDoc, addDoc,
    onSnapshot, getDoc, getDocs, writeBatch,
    type DocumentReference, type SetOptions,
    type Query, type CollectionReference, type WriteBatch,
    type Unsubscribe
} from 'firebase/firestore';
import { trackWrite, trackDelete, trackSnapshot, trackRead } from '../utils/firestoreTracker';

// ====== TRACKED WRITE WRAPPERS ======

export const trackedSetDoc = async (
    ref: DocumentReference<any>,
    data: any,
    options?: SetOptions
): Promise<void> => {
    trackWrite();
    if (options) return setDoc(ref, data, options);
    return setDoc(ref, data);
};

export const trackedUpdateDoc = async (
    ref: DocumentReference<any>,
    data: any
): Promise<void> => {
    trackWrite();
    return updateDoc(ref, data);
};

export const trackedDeleteDoc = async (
    ref: DocumentReference<any>
): Promise<void> => {
    trackDelete();
    return deleteDoc(ref);
};

export const trackedAddDoc = async (
    ref: CollectionReference<any>,
    data: any
) => {
    trackWrite();
    return addDoc(ref, data);
};

// ====== TRACKED READ WRAPPERS ======

export const trackedGetDoc = async (ref: DocumentReference<any>) => {
    trackRead();
    return getDoc(ref);
};

export const trackedGetDocs = async (q: Query<any>) => {
    const result = await getDocs(q);
    trackRead(result.size);
    return result;
};

export const trackedOnSnapshot = (
    queryOrRef: any,
    callbackOrOptions: any,
    ...rest: any[]
): Unsubscribe => {
    // Wrap the callback to track reads
    const wrapCallback = (cb: Function) => (snapshot: any) => {
        // snapshot.docs for queries, snapshot.data() for single docs
        if (snapshot.docs) {
            trackSnapshot(snapshot.docs.length);
        } else if (snapshot.exists && snapshot.exists()) {
            trackRead(1);
        }
        return cb(snapshot);
    };

    if (typeof callbackOrOptions === 'function') {
        return onSnapshot(queryOrRef, wrapCallback(callbackOrOptions), ...rest);
    }

    // callbackOrOptions is SnapshotListenOptions, real callback is in rest
    if (rest.length > 0 && typeof rest[0] === 'function') {
        const [callback, ...remaining] = rest;
        return onSnapshot(queryOrRef, callbackOrOptions, wrapCallback(callback), ...remaining);
    }

    // Fallback — call original
    return onSnapshot(queryOrRef, callbackOrOptions, ...rest);
};

// ====== TRACKED BATCH ======

export const trackedWriteBatch = (db: any): WriteBatch => {
    const batch = writeBatch(db);
    const originalCommit = batch.commit.bind(batch);
    let opCount = 0;

    const originalSet = batch.set.bind(batch);
    const originalUpdate = batch.update.bind(batch);
    const originalDelete = batch.delete.bind(batch);

    batch.set = (...args: any[]) => {
        opCount++;
        return (originalSet as any)(...args);
    };

    batch.update = (...args: any[]) => {
        opCount++;
        return (originalUpdate as any)(...args);
    };

    batch.delete = (...args: any[]) => {
        opCount++;
        return (originalDelete as any)(...args);
    };

    batch.commit = async () => {
        trackWrite(opCount);
        return originalCommit();
    };

    return batch;
};
