/**
 * R2 Upload Service — Upload files to Cloudflare R2 via Worker proxy
 * 
 * Flow: Browser → Cloudflare Worker → R2 Bucket (avgflow)
 * 
 * Worker phải được deploy trước (xem r2-upload-worker/worker.js)
 * Sau khi deploy, cập nhật R2_WORKER_URL bên dưới
 */

// ⚠️ CẬP NHẬT URL SAU KHI DEPLOY WORKER
const R2_WORKER_URL = 'https://avgflow-r2-upload.mcngocsonvualoidan.workers.dev';

export interface R2UploadResult {
    success: boolean;
    key: string;
    url: string;
    name: string;
    size: number;
    type: string;
}

/**
 * Upload a single file to R2 via Worker proxy
 */
export async function uploadFileToR2(
    file: File,
    folder: string = 'design_tickets'
): Promise<R2UploadResult> {
    const response = await fetch(`${R2_WORKER_URL}/upload`, {
        method: 'POST',
        headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-File-Name': file.name,
            'X-File-Type': file.type,
            'X-Folder': folder,
        },
        body: file,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error((err as any).error || `Upload failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Upload multiple files to R2 concurrently
 */
export async function uploadFilesToR2(
    files: File[],
    folder: string = 'design_tickets',
    onProgress?: (completed: number, total: number) => void
): Promise<R2UploadResult[]> {
    const results: R2UploadResult[] = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
        const result = await uploadFileToR2(files[i], folder);
        results.push(result);
        onProgress?.(i + 1, total);
    }

    return results;
}

/**
 * Delete a file from R2 via Worker proxy
 */
export async function deleteFileFromR2(key: string): Promise<boolean> {
    try {
        const response = await fetch(`${R2_WORKER_URL}/file/${encodeURIComponent(key)}`, {
            method: 'DELETE',
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get the public URL for an R2 file
 */
export function getR2FileUrl(key: string): string {
    return `${R2_WORKER_URL}/file/${key}`;
}
