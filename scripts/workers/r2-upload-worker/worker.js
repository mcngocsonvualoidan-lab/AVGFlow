/**
 * Cloudflare Worker — R2 Upload Proxy for AVG Flow Design Tickets
 * 
 * HƯỚNG DẪN DEPLOY:
 * 1. Đăng nhập Cloudflare Dashboard → Workers & Pages → Create Worker
 * 2. Đặt tên: avgflow-r2-upload
 * 3. Dán toàn bộ code này vào
 * 4. Vào Settings → Variables → R2 Bucket Bindings:
 *    - Variable name: R2_BUCKET
 *    - R2 Bucket: avgflow
 * 5. Deploy
 * 6. Copy Worker URL (VD: https://avgflow-r2-upload.xxx.workers.dev)
 * 7. Cập nhật R2_WORKER_URL trong src/services/r2UploadService.ts
 * 
 * Endpoints:
 *   POST /upload   — Upload file, trả về { url, key }
 *   GET  /file/:key — Download file từ R2
 *   DELETE /file/:key — Xóa file khỏi R2
 */

const ALLOWED_ORIGINS = [
  'https://avgflow-dd822.web.app',
  'https://avgflow-dd822.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:4173',
  'https://flow.auvietglobal.com',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-File-Name, X-File-Type, X-Folder',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // ═══════════════════════════════════════
      // POST /upload — Upload file to R2
      // ═══════════════════════════════════════
      if (request.method === 'POST' && pathname === '/upload') {
        const fileName = request.headers.get('X-File-Name') || `file_${Date.now()}`;
        const fileType = request.headers.get('X-File-Type') || 'application/octet-stream';
        const folder = request.headers.get('X-Folder') || 'design_tickets';

        const body = await request.arrayBuffer();

        if (body.byteLength > MAX_FILE_SIZE) {
          return new Response(JSON.stringify({ error: 'File quá lớn (tối đa 25MB)' }), {
            status: 413,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }

        // Generate unique key
        const timestamp = Date.now();
        const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `${folder}/${timestamp}_${sanitizedName}`;

        // Upload to R2
        await env.R2_BUCKET.put(key, body, {
          httpMetadata: {
            contentType: fileType,
          },
          customMetadata: {
            originalName: fileName,
            uploadedAt: new Date().toISOString(),
          },
        });

        // Build public URL
        const publicUrl = `${url.origin}/file/${key}`;

        return new Response(JSON.stringify({
          success: true,
          key,
          url: publicUrl,
          name: fileName,
          size: body.byteLength,
          type: fileType,
        }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // ═══════════════════════════════════════
      // GET /file/:key — Serve file from R2
      // ═══════════════════════════════════════
      if (request.method === 'GET' && pathname.startsWith('/file/')) {
        const key = decodeURIComponent(pathname.slice(6)); // Remove "/file/"
        const object = await env.R2_BUCKET.get(key);

        if (!object) {
          return new Response(JSON.stringify({ error: 'File not found' }), {
            status: 404,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }

        const headers = new Headers(cors);
        headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('ETag', object.httpEtag);

        return new Response(object.body, { headers });
      }

      // ═══════════════════════════════════════
      // DELETE /file/:key — Delete file from R2
      // ═══════════════════════════════════════
      if (request.method === 'DELETE' && pathname.startsWith('/file/')) {
        const key = decodeURIComponent(pathname.slice(6));
        await env.R2_BUCKET.delete(key);

        return new Response(JSON.stringify({ success: true, key }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // Health check
      if (pathname === '/' || pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'AVG Flow R2 Upload Worker',
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
