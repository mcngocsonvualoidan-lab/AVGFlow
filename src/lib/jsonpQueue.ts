/**
 * ============================================================
 *  AVGFlow — JSONP Queue (Shared Infrastructure)
 *  Serializes JSONP requests to avoid race conditions on the
 *  shared google.visualization.Query.setResponse callback.
 * ============================================================
 */

type JSONPTask<T> = {
    sheetId: string;
    gid: string;
    parser: (data: any) => T;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
};

let isProcessing = false;
const queue: JSONPTask<any>[] = [];

function processQueue() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    const task = queue.shift()!;
    const scriptId = `__gviz_script_${Date.now()}`;

    // Save original callback
    const orig = (window as any).google?.visualization?.Query?.setResponse;

    // Ensure namespace exists
    if (!(window as any).google) (window as any).google = {};
    if (!(window as any).google.visualization) (window as any).google.visualization = {};
    if (!(window as any).google.visualization.Query) (window as any).google.visualization.Query = {};

    (window as any).google.visualization.Query.setResponse = (response: any) => {
        cleanup();
        try {
            const result = task.parser(response);
            task.resolve(result);
        } catch (e: any) {
            task.reject(e);
        }
        isProcessing = false;
        processQueue(); // Process next in queue
    };

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://docs.google.com/spreadsheets/d/${task.sheetId}/gviz/tq?tqx=out:json&gid=${task.gid}`;
    script.onerror = () => {
        cleanup();
        task.reject(new Error('JSONP script load failed'));
        isProcessing = false;
        processQueue();
    };

    const timer = setTimeout(() => {
        cleanup();
        task.reject(new Error('JSONP timeout (15s)'));
        isProcessing = false;
        processQueue();
    }, 15000);

    function cleanup() {
        clearTimeout(timer);
        if (orig) {
            (window as any).google.visualization.Query.setResponse = orig;
        }
        document.getElementById(scriptId)?.remove();
    }

    document.head.appendChild(script);
}

/**
 * Enqueue a JSONP request. Requests are serialized so only one
 * is active at a time, preventing callback collisions.
 */
export function fetchViaJSONP<T>(
    sheetId: string,
    gid: string,
    parser: (data: any) => T
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        queue.push({ sheetId, gid, parser, resolve, reject });
        processQueue();
    });
}

/**
 * Standard GViz object → string[][] parser
 */
export function parseGVizToRows(data: any): string[][] {
    if (!data?.table?.rows) return [];
    const headers = (data.table.cols || []).map((col: any) => col.label || '');
    const rows: string[][] = [headers];
    for (const row of data.table.rows) {
        rows.push((row.c || []).map((cell: any) => {
            if (!cell) return '';
            if (cell.f) return cell.f;
            if (cell.v === null || cell.v === undefined) return '';
            if (typeof cell.v === 'boolean') return cell.v ? 'TRUE' : 'FALSE';
            return String(cell.v);
        }));
    }
    return rows;
}
