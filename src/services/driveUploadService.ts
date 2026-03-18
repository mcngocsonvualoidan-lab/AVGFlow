/**
 * Google Drive Upload Service v2
 * Central utility for uploading files to Google Drive via Apps Script.
 * Supports: small files (direct), large files (chunked), progress tracking.
 */

const DRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycby6E71pwYmKqC5lz3PhNT1HzndmK605ckzl_Ep07WsJQ-4NAiMaPxq0nCGGB-g4x-C7VQ/exec';

// ═══════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════
const MAX_DIRECT_SIZE = 25 * 1024 * 1024;  // 25MB — direct upload limit
const CHUNK_SIZE = 5 * 1024 * 1024;         // 5MB per chunk
const MAX_FILE_SIZE = 100 * 1024 * 1024;    // 100MB absolute max

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface DriveUploadResult {
    success: boolean;
    fileId?: string;
    url?: string;          // Direct viewable URL (for images)
    viewUrl?: string;      // Google Drive viewer URL (for PDFs/docs)
    downloadUrl?: string;  // Direct download URL
    fileName?: string;
    size?: number;
    error?: string;
}

export interface UploadProgress {
    phase: 'encoding' | 'uploading' | 'processing' | 'done' | 'error';
    percent: number;       // 0-100
    loaded?: number;       // bytes uploaded
    total?: number;        // total bytes
    chunkIndex?: number;   // current chunk (for chunked uploads)
    totalChunks?: number;  // total chunks
    message?: string;
}

// ═══════════════════════════════════════════════════
// FILE TYPE UTILITIES
// ═══════════════════════════════════════════════════

/** Determine file category for proper URL generation */
export type FileCategory = 'image' | 'pdf' | 'document' | 'design' | 'other';

export function getFileCategory(file: File | string): FileCategory {
    const name = typeof file === 'string' ? file : file.name;
    const type = typeof file === 'string' ? '' : file.type;
    const ext = name.split('.').pop()?.toLowerCase() || '';

    if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
    if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'].includes(ext)) return 'document';
    if (['ai', 'psd', 'eps', 'indd', 'sketch', 'fig', 'xd', 'cdr'].includes(ext)) return 'design';
    return 'other';
}

/** Get appropriate URLs based on file type */
export function getDriveUrls(fileId: string): {
    directUrl: string;     // For images (lh3.googleusercontent.com)
    viewUrl: string;       // Google Drive preview (iframe-friendly)
    downloadUrl: string;   // Direct download link
} {
    return {
        directUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
        viewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        downloadUrl: `https://drive.google.com/uc?id=${fileId}&export=download`
    };
}

/** Human-readable file size */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ═══════════════════════════════════════════════════
// BASE64 ENCODING
// ═══════════════════════════════════════════════════

/** Convert a File to base64 string (without data URL prefix) */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/** Convert a Blob/chunk to base64 string */
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// ═══════════════════════════════════════════════════
// UPLOAD FUNCTIONS
// ═══════════════════════════════════════════════════

/**
 * Upload a file to Google Drive via Apps Script.
 * Automatically chooses direct or chunked upload based on file size.
 *
 * @param file - The File object to upload
 * @param category - The Drive folder category (e.g., 'avatars', 'attachments')
 * @param customFileName - Optional custom filename
 * @param onProgress - Optional progress callback
 * @returns DriveUploadResult with URLs appropriate for the file type
 */
export const uploadToDrive = async (
    file: File,
    category: string,
    customFileName?: string,
    onProgress?: (progress: UploadProgress) => void
): Promise<DriveUploadResult> => {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            success: false,
            error: `File quá lớn (${formatFileSize(file.size)}). Giới hạn: ${formatFileSize(MAX_FILE_SIZE)}. Vui lòng upload trực tiếp lên Google Drive.`
        };
    }

    const fileName = customFileName || `${Date.now()}_${file.name}`;
    const fileCategory = getFileCategory(file);

    try {
        let result: DriveUploadResult;

        if (file.size <= MAX_DIRECT_SIZE) {
            // Direct upload for small files
            result = await directUpload(file, category, fileName, onProgress);
        } else {
            // Chunked upload for large files
            result = await chunkedUpload(file, category, fileName, onProgress);
        }

        // Enrich result with proper URLs based on file type
        if (result.success && result.fileId) {
            const urls = getDriveUrls(result.fileId);

            switch (fileCategory) {
                case 'image':
                    result.url = urls.directUrl;
                    result.viewUrl = urls.viewUrl;
                    break;
                case 'pdf':
                    result.url = urls.viewUrl;      // PDF → use viewer URL as primary
                    result.viewUrl = urls.viewUrl;
                    break;
                case 'document':
                    result.url = urls.viewUrl;
                    result.viewUrl = urls.viewUrl;
                    break;
                default:
                    result.url = urls.downloadUrl;   // Design/other → download link
                    result.viewUrl = urls.viewUrl;
                    break;
            }
            result.downloadUrl = urls.downloadUrl;
        }

        return result;
    } catch (error) {
        onProgress?.({ phase: 'error', percent: 0, message: 'Upload thất bại' });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed'
        };
    }
};

// ═══════════════════════════════════════════════════
// DIRECT UPLOAD (< 25MB)
// ═══════════════════════════════════════════════════

async function directUpload(
    file: File,
    category: string,
    fileName: string,
    onProgress?: (progress: UploadProgress) => void
): Promise<DriveUploadResult> {
    onProgress?.({ phase: 'encoding', percent: 10, message: 'Đang mã hóa file...' });

    const base64 = await fileToBase64(file);

    onProgress?.({ phase: 'uploading', percent: 40, message: 'Đang tải lên Drive...', loaded: 0, total: file.size });

    const response = await fetch(DRIVE_UPLOAD_URL, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
            fileName,
            mimeType: file.type || 'application/octet-stream',
            base64,
            category
        })
    });

    onProgress?.({ phase: 'processing', percent: 90, message: 'Đang xử lý...' });

    const data: DriveUploadResult = await response.json();

    if (data.success) {
        onProgress?.({ phase: 'done', percent: 100, message: 'Hoàn tất!' });
    }

    return data;
}

// ═══════════════════════════════════════════════════
// CHUNKED UPLOAD (25MB - 100MB)
// ═══════════════════════════════════════════════════

async function chunkedUpload(
    file: File,
    category: string,
    fileName: string,
    onProgress?: (progress: UploadProgress) => void
): Promise<DriveUploadResult> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    onProgress?.({
        phase: 'encoding',
        percent: 5,
        message: `Chuẩn bị upload ${totalChunks} phần...`,
        totalChunks
    });

    // Upload each chunk
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const chunkBase64 = await blobToBase64(chunk);

        const percentDone = Math.round(((i + 1) / totalChunks) * 85) + 10; // 10-95%

        onProgress?.({
            phase: 'uploading',
            percent: percentDone,
            message: `Đang tải phần ${i + 1}/${totalChunks}...`,
            chunkIndex: i + 1,
            totalChunks,
            loaded: end,
            total: file.size
        });

        const response = await fetch(DRIVE_UPLOAD_URL, {
            method: 'POST',
            redirect: 'follow',
            body: JSON.stringify({
                action: 'chunk',
                sessionId,
                chunkIndex: i,
                totalChunks,
                base64: chunkBase64,
                fileName,
                mimeType: file.type || 'application/octet-stream',
                category,
                isLastChunk: i === totalChunks - 1
            })
        });

        const result = await response.json();

        // Last chunk returns the final result
        if (i === totalChunks - 1) {
            if (result.success) {
                onProgress?.({ phase: 'done', percent: 100, message: 'Hoàn tất!' });
            }
            return result;
        }

        // Check intermediate chunk success
        if (!result.success && result.error) {
            throw new Error(`Chunk ${i + 1} failed: ${result.error}`);
        }
    }

    return { success: false, error: 'Unexpected end of chunked upload' };
}
