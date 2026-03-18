/**
 * FileViewer — Smart file viewer component
 * Automatically detects file type and renders appropriate viewer:
 * - Images → Direct display with zoom
 * - PDFs → Google Drive embedded viewer (iframe)
 * - Documents → Google Drive viewer
 * - Design files (AI, PSD, etc.) → Download card with file info
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Image as ImageIcon, Download, ExternalLink,
    X, ZoomIn, ZoomOut, Maximize2, Eye, File as FileIcon,
    Palette, FileSpreadsheet, Loader2
} from 'lucide-react';
import { getFileCategory, formatFileSize, getDriveUrls, type FileCategory } from '../services/driveUploadService';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

interface FileViewerProps {
    /** The URL of the file (can be Drive direct URL, view URL, or download URL) */
    url: string;
    /** Original filename */
    fileName?: string;
    /** File size in bytes (optional, for display) */
    fileSize?: number;
    /** Google Drive file ID (if available, enables smart URL routing) */
    fileId?: string;
    /** Override file type detection */
    fileType?: FileCategory;
    /** Display mode */
    mode?: 'inline' | 'card' | 'thumbnail';
    /** Max width/height for inline mode */
    maxWidth?: number;
    maxHeight?: number;
    /** Custom class name */
    className?: string;
    /** Whether to show download button */
    showDownload?: boolean;
    /** Whether clicking opens fullscreen preview */
    clickToPreview?: boolean;
}

// ═══════════════════════════════════════════════════
// FILE ICON MAP
// ═══════════════════════════════════════════════════

function getFileIcon(category: FileCategory, _ext: string) {
    switch (category) {
        case 'image': return <ImageIcon size={24} className="text-blue-400" />;
        case 'pdf': return <FileText size={24} className="text-red-400" />;
        case 'design': return <Palette size={24} className="text-purple-400" />;
        case 'document': return <FileSpreadsheet size={24} className="text-green-400" />;
        default: return <FileIcon size={24} className="text-gray-400" />;
    }
}

function getExtLabel(ext: string): { label: string; color: string } {
    const map: Record<string, { label: string; color: string }> = {
        pdf: { label: 'PDF', color: 'bg-red-500/20 text-red-400' },
        ai: { label: 'AI', color: 'bg-orange-500/20 text-orange-400' },
        psd: { label: 'PSD', color: 'bg-blue-500/20 text-blue-400' },
        eps: { label: 'EPS', color: 'bg-purple-500/20 text-purple-400' },
        indd: { label: 'INDD', color: 'bg-pink-500/20 text-pink-400' },
        doc: { label: 'DOC', color: 'bg-blue-600/20 text-blue-400' },
        docx: { label: 'DOCX', color: 'bg-blue-600/20 text-blue-400' },
        xls: { label: 'XLS', color: 'bg-green-500/20 text-green-400' },
        xlsx: { label: 'XLSX', color: 'bg-green-500/20 text-green-400' },
        ppt: { label: 'PPT', color: 'bg-orange-600/20 text-orange-400' },
        pptx: { label: 'PPTX', color: 'bg-orange-600/20 text-orange-400' },
        jpg: { label: 'JPG', color: 'bg-cyan-500/20 text-cyan-400' },
        jpeg: { label: 'JPEG', color: 'bg-cyan-500/20 text-cyan-400' },
        png: { label: 'PNG', color: 'bg-indigo-500/20 text-indigo-400' },
        svg: { label: 'SVG', color: 'bg-yellow-500/20 text-yellow-400' },
        gif: { label: 'GIF', color: 'bg-pink-400/20 text-pink-400' },
    };
    return map[ext] || { label: ext.toUpperCase(), color: 'bg-gray-500/20 text-gray-400' };
}

// ═══════════════════════════════════════════════════
// EXTRACT FILE ID FROM DRIVE URL
// ═══════════════════════════════════════════════════

function extractFileId(url: string): string | null {
    // Format: https://lh3.googleusercontent.com/d/FILE_ID
    const lh3Match = url.match(/lh3\.googleusercontent\.com\/d\/([^/?]+)/);
    if (lh3Match) return lh3Match[1];

    // Format: https://drive.google.com/file/d/FILE_ID/...
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
    if (driveMatch) return driveMatch[1];

    // Format: https://drive.google.com/uc?id=FILE_ID
    const ucMatch = url.match(/drive\.google\.com\/uc\?id=([^&]+)/);
    if (ucMatch) return ucMatch[1];

    return null;
}

// ═══════════════════════════════════════════════════
// FULLSCREEN PREVIEW MODAL
// ═══════════════════════════════════════════════════

interface PreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    fileName: string;
    category: FileCategory;
    fileId: string | null;
    downloadUrl?: string;
}

const PreviewModal: React.FC<PreviewModalProps> = ({
    isOpen, onClose, url, fileName, category, fileId, downloadUrl
}) => {
    const [zoom, setZoom] = useState(1);
    const [iframeLoading, setIframeLoading] = useState(true);

    if (!isOpen) return null;

    const urls = fileId ? getDriveUrls(fileId) : null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col"
                onClick={onClose}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-3 bg-black/60"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center gap-3 text-white min-w-0">
                        {getFileIcon(category, fileName.split('.').pop() || '')}
                        <span className="truncate text-sm font-medium">{fileName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {category === 'image' && (
                            <>
                                <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors" title="Thu nhỏ">
                                    <ZoomOut size={18} />
                                </button>
                                <span className="text-white/60 text-xs min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
                                <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors" title="Phóng to">
                                    <ZoomIn size={18} />
                                </button>
                            </>
                        )}
                        {(urls?.viewUrl || downloadUrl) && (
                            <a
                                href={urls?.viewUrl || downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
                                title="Mở trong tab mới"
                                onClick={e => e.stopPropagation()}
                            >
                                <ExternalLink size={18} />
                            </a>
                        )}
                        {(urls?.downloadUrl || downloadUrl) && (
                            <a
                                href={urls?.downloadUrl || downloadUrl}
                                download={fileName}
                                className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
                                title="Tải về"
                                onClick={e => e.stopPropagation()}
                            >
                                <Download size={18} />
                            </a>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div
                    className="flex-1 flex items-center justify-center overflow-auto p-4"
                    onClick={e => e.stopPropagation()}
                >
                    {category === 'image' ? (
                        <img
                            src={url}
                            alt={fileName}
                            className="max-h-full object-contain transition-transform duration-200 rounded-lg"
                            style={{ transform: `scale(${zoom})` }}
                            draggable={false}
                        />
                    ) : category === 'pdf' || category === 'document' ? (
                        <div className="relative w-full max-w-5xl h-full">
                            {iframeLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-bg-card/50 rounded-xl">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 size={32} className="animate-spin text-brand-primary" />
                                        <span className="text-text-muted text-sm">Đang tải tài liệu...</span>
                                    </div>
                                </div>
                            )}
                            <iframe
                                src={urls?.viewUrl || url}
                                className="w-full h-full rounded-xl border border-white/10"
                                title={fileName}
                                allowFullScreen
                                onLoad={() => setIframeLoading(false)}
                            />
                        </div>
                    ) : (
                        <div className="text-center text-white">
                            <FileIcon size={64} className="mx-auto mb-4 text-white/40" />
                            <p className="text-lg font-medium mb-2">{fileName}</p>
                            <p className="text-white/60 mb-6">File này không hỗ trợ xem trước trên trình duyệt.</p>
                            {(urls?.downloadUrl || downloadUrl) && (
                                <a
                                    href={urls?.downloadUrl || downloadUrl}
                                    download={fileName}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary rounded-xl text-white font-bold hover:bg-brand-primaryDark transition-colors"
                                >
                                    <Download size={18} />
                                    Tải về
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

const FileViewer: React.FC<FileViewerProps> = ({
    url,
    fileName = 'file',
    fileSize,
    fileId: propFileId,
    fileType,
    mode = 'card',
    maxWidth = 400,
    maxHeight = 300,
    className = '',
    showDownload = true,
    clickToPreview = true
}) => {
    const [showPreview, setShowPreview] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);

    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const category = fileType || getFileCategory(fileName);
    const fileId = propFileId || extractFileId(url);
    const urls = fileId ? getDriveUrls(fileId) : null;
    const extInfo = getExtLabel(ext);

    const handleClick = useCallback(() => {
        if (clickToPreview) setShowPreview(true);
    }, [clickToPreview]);

    // ─── THUMBNAIL MODE ───
    if (mode === 'thumbnail') {
        return (
            <>
                <div
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border border-border-main hover:border-brand-primary/50 transition-all ${className}`}
                    style={{ width: 80, height: 80 }}
                    onClick={handleClick}
                    title={fileName}
                >
                    {category === 'image' && !imgError ? (
                        <>
                            {!imgLoaded && (
                                <div className="absolute inset-0 bg-bg-card animate-pulse" />
                            )}
                            <img
                                src={urls?.directUrl || url}
                                alt={fileName}
                                className="w-full h-full object-cover"
                                onLoad={() => setImgLoaded(true)}
                                onError={() => setImgError(true)}
                            />
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-bg-card gap-1">
                            {getFileIcon(category, ext)}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${extInfo.color}`}>
                                {extInfo.label}
                            </span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Eye size={20} className="text-white" />
                    </div>
                </div>
                <PreviewModal
                    isOpen={showPreview}
                    onClose={() => setShowPreview(false)}
                    url={urls?.directUrl || url}
                    fileName={fileName}
                    category={category}
                    fileId={fileId}
                    downloadUrl={urls?.downloadUrl}
                />
            </>
        );
    }

    // ─── INLINE MODE (for images/PDFs directly embedded) ───
    if (mode === 'inline') {
        return (
            <>
                <div className={`relative ${className}`} style={{ maxWidth, maxHeight }}>
                    {category === 'image' && !imgError ? (
                        <div className="relative group cursor-pointer" onClick={handleClick}>
                            {!imgLoaded && (
                                <div className="w-full h-48 bg-bg-card animate-pulse rounded-xl" />
                            )}
                            <img
                                src={urls?.directUrl || url}
                                alt={fileName}
                                className={`max-w-full rounded-xl transition-opacity ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                                style={{ maxHeight }}
                                onLoad={() => setImgLoaded(true)}
                                onError={() => setImgError(true)}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <Maximize2 size={24} className="text-white drop-shadow-lg" />
                            </div>
                        </div>
                    ) : category === 'pdf' ? (
                        <div className="rounded-xl overflow-hidden border border-border-main" style={{ height: maxHeight }}>
                            <iframe
                                src={urls?.viewUrl || url}
                                className="w-full h-full"
                                title={fileName}
                            />
                        </div>
                    ) : (
                        /* Fall back to card mode for non-viewable types */
                        <FileCardView
                            fileName={fileName}
                            fileSize={fileSize}
                            category={category}
                            ext={ext}
                            extInfo={extInfo}
                            urls={urls}
                            downloadUrl={urls?.downloadUrl}
                            showDownload={showDownload}
                            onClick={handleClick}
                        />
                    )}
                </div>
                <PreviewModal
                    isOpen={showPreview}
                    onClose={() => setShowPreview(false)}
                    url={urls?.directUrl || url}
                    fileName={fileName}
                    category={category}
                    fileId={fileId}
                    downloadUrl={urls?.downloadUrl}
                />
            </>
        );
    }

    // ─── CARD MODE (default) ───
    return (
        <>
            <FileCardView
                fileName={fileName}
                fileSize={fileSize}
                category={category}
                ext={ext}
                extInfo={extInfo}
                urls={urls}
                downloadUrl={urls?.downloadUrl}
                showDownload={showDownload}
                onClick={handleClick}
                className={className}
                imageUrl={category === 'image' && !imgError ? (urls?.directUrl || url) : undefined}
                onImgLoad={() => setImgLoaded(true)}
                onImgError={() => setImgError(true)}
                imgLoaded={imgLoaded}
            />
            <PreviewModal
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                url={urls?.directUrl || url}
                fileName={fileName}
                category={category}
                fileId={fileId}
                downloadUrl={urls?.downloadUrl}
            />
        </>
    );
};

// ═══════════════════════════════════════════════════
// FILE CARD SUB-COMPONENT
// ═══════════════════════════════════════════════════

interface FileCardViewProps {
    fileName: string;
    fileSize?: number;
    category: FileCategory;
    ext: string;
    extInfo: { label: string; color: string };
    urls: ReturnType<typeof getDriveUrls> | null;
    downloadUrl?: string;
    showDownload: boolean;
    onClick: () => void;
    className?: string;
    imageUrl?: string;
    onImgLoad?: () => void;
    onImgError?: () => void;
    imgLoaded?: boolean;
}

const FileCardView: React.FC<FileCardViewProps> = ({
    fileName, fileSize, category, ext, extInfo, urls, downloadUrl,
    showDownload, onClick, className = '', imageUrl, onImgLoad, onImgError, imgLoaded
}) => {
    return (
        <div
            className={`group flex items-center gap-3 p-3 rounded-xl border border-border-main bg-bg-card/50 hover:bg-bg-card hover:border-brand-primary/30 transition-all cursor-pointer ${className}`}
            onClick={onClick}
        >
            {/* File icon / thumbnail */}
            <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center bg-bg-main">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={fileName}
                        className={`w-full h-full object-cover transition-opacity ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={onImgLoad}
                        onError={onImgError}
                    />
                ) : (
                    getFileIcon(category, ext)
                )}
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-main truncate" title={fileName}>
                    {fileName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${extInfo.color}`}>
                        {extInfo.label}
                    </span>
                    {fileSize != null && (
                        <span className="text-[11px] text-text-muted">{formatFileSize(fileSize)}</span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                {(category === 'pdf' || category === 'document') && urls?.viewUrl && (
                    <a
                        href={urls.viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-bg-main rounded-lg text-text-muted hover:text-brand-primary transition-colors"
                        title="Xem trước"
                    >
                        <Eye size={16} />
                    </a>
                )}
                {showDownload && (urls?.downloadUrl || downloadUrl) && (
                    <a
                        href={urls?.downloadUrl || downloadUrl}
                        download={fileName}
                        className="p-2 hover:bg-bg-main rounded-lg text-text-muted hover:text-brand-primary transition-colors"
                        title="Tải về"
                    >
                        <Download size={16} />
                    </a>
                )}
            </div>
        </div>
    );
};

export default FileViewer;
