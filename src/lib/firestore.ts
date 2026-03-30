/**
 * 🔋 Firestore Proxy — Centralized Import with Auto-Tracking
 * 
 * Tất cả module trong app import Firestore functions từ file này
 * thay vì trực tiếp từ 'firebase/firestore'.
 * 
 * → Mọi read/write/delete được tracking tự động → Độ chính xác ~100%
 * → Không cần sửa logic trong từng file → chỉ đổi import path
 * → 0 Firestore cost cho tracking (localStorage only)
 * 
 * USAGE: Trong mọi file, thay:
 *   import { setDoc, onSnapshot } from 'firebase/firestore';
 * bằng:
 *   import { setDoc, onSnapshot } from '@/lib/firestore';
 */

// Re-export EVERYTHING from firebase/firestore as pass-through
export {
    // Core references
    collection, doc, getFirestore,
    // Query primitives
    query, where, orderBy, limit, limitToLast, startAt, startAfter, endAt, endBefore,
    // Field values
    arrayUnion, arrayRemove, increment, serverTimestamp, deleteField,
    Timestamp, FieldPath, GeoPoint,
    // Snapshots
    getCountFromServer, documentId,
    // Types
    type DocumentReference, type CollectionReference, type Query,
    type QuerySnapshot, type DocumentSnapshot, type QueryDocumentSnapshot,
    type Unsubscribe, type SetOptions, type WriteBatch,
    type FieldValue, type DocumentData,
    // Persistence
    enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence,
    enableNetwork, disableNetwork,
    // Aggregation
    getAggregateFromServer, sum, average, count,
} from 'firebase/firestore';

// ====== TRACKED OVERRIDES ======
// These wrap the original firebase functions with tracking calls

import {
    setDoc as _setDoc,
    updateDoc as _updateDoc,
    deleteDoc as _deleteDoc,
    addDoc as _addDoc,
    getDoc as _getDoc,
    getDocs as _getDocs,
    onSnapshot as _onSnapshot,
    writeBatch as _writeBatch,
} from 'firebase/firestore';
import { trackWrite, trackDelete, trackRead, trackSnapshot } from '../utils/firestoreTracker';

// --- Writes ---

export const setDoc: typeof _setDoc = (ref: any, data: any, options?: any) => {
    trackWrite();
    return options ? _setDoc(ref, data, options) : _setDoc(ref, data);
};

export const updateDoc: typeof _updateDoc = (ref: any, ...args: any[]) => {
    trackWrite();
    return (_updateDoc as any)(ref, ...args);
};

export const deleteDoc: typeof _deleteDoc = (ref: any) => {
    trackDelete();
    return _deleteDoc(ref);
};

export const addDoc: typeof _addDoc = (ref: any, data: any) => {
    trackWrite();
    return _addDoc(ref, data);
};

// --- Reads ---

export const getDoc: typeof _getDoc = (ref: any) => {
    trackRead();
    return _getDoc(ref);
};

import type { Query as FireQuery, DocumentData as FireDocData, QuerySnapshot } from 'firebase/firestore';

export function getDocs<AppModelType = FireDocData, DbModelType extends FireDocData = FireDocData>(
    q: FireQuery<AppModelType, DbModelType>
): Promise<QuerySnapshot<AppModelType, DbModelType>> {
    const promise = _getDocs(q);
    promise.then(snap => trackRead(snap.size)).catch(() => {});
    return promise;
}

// --- Listeners ---

export const onSnapshot: typeof _onSnapshot = (...args: any[]) => {
    // Wrap the success callback to track reads
    const wrapCallback = (cb: Function) => (snapshot: any) => {
        if (snapshot.docs) {
            trackSnapshot(snapshot.docs.length);
        } else if (snapshot.exists && snapshot.exists()) {
            trackRead(1);
        }
        return cb(snapshot);
    };

    // onSnapshot has many overloads. The callback is usually the 2nd or 3rd arg.
    if (args.length >= 2 && typeof args[1] === 'function') {
        // onSnapshot(query, callback, ?errorCallback)
        args[1] = wrapCallback(args[1]);
    } else if (args.length >= 3 && typeof args[2] === 'function') {
        // onSnapshot(query, options, callback, ?errorCallback)
        args[2] = wrapCallback(args[2]);
    } else if (args.length >= 2 && typeof args[1] === 'object' && args[1] !== null) {
        // onSnapshot(query, { next, error, complete }) — observer object
        if (typeof args[1].next === 'function') {
            args[1] = { ...args[1], next: wrapCallback(args[1].next) };
        }
    }

    return (_onSnapshot as any)(...args);
};

// --- Batch ---

export const writeBatch: typeof _writeBatch = (db: any) => {
    const batch = _writeBatch(db);
    let writeCount = 0;
    let deleteCount = 0;

    const originalCommit = batch.commit.bind(batch);
    const originalSet = batch.set.bind(batch);
    const originalUpdate = batch.update.bind(batch);
    const originalDelete = batch.delete.bind(batch);

    batch.set = (...args: any[]) => {
        writeCount++;
        return (originalSet as any)(...args);
    };

    batch.update = (...args: any[]) => {
        writeCount++;
        return (originalUpdate as any)(...args);
    };

    batch.delete = (...args: any[]) => {
        deleteCount++;
        return (originalDelete as any)(...args);
    };

    batch.commit = async () => {
        if (writeCount > 0) trackWrite(writeCount);
        if (deleteCount > 0) trackDelete(deleteCount);
        return originalCommit();
    };

    return batch;
};
