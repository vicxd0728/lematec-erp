export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/api/board.json' || url.pathname === '/erp-board-summary')) {
      return erpBoardSummary(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/inventory/versions') {
      return cachedInventoryVersions(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/inventory/list') {
      return versionedInventoryResponse(request, cors, () => erpInventoryList(request, env, cors));
    }
    if (request.method === 'POST' && url.pathname === '/api/inventory/sync') {
      return erpInventorySync(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/inventory/adjust') {
      return erpInventoryAdjust(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/inventory/adjust-batch') {
      return erpInventoryBatchAdjust(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/inventory/material/archive') {
      return erpInventoryMaterialArchive(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/inventory/bom/list') {
      return versionedInventoryResponse(request, cors, () => erpInventoryBomList(request, env, cors));
    }
    if (request.method === 'POST' && url.pathname === '/api/inventory/bom/migrate') {
      return erpInventoryBomMigrate(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/inventory/bom/upsert') {
      return erpInventoryBomUpsert(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/picking/migrate') {
      return erpPickingMigrate(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/picking/summary') {
      return erpPickingSummary(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/picking/list') {
      return erpPickingList(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/picking/create') {
      return erpPickingCreate(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/picking/status') {
      return erpPickingStatus(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/picking/link-notion') {
      return erpPickingLinkNotion(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/inbound/migrate') {
      return erpInboundMigrate(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/inbound/summary') {
      return erpInboundSummary(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/inbound/list') {
      return erpInboundList(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/inbound/create') {
      return erpInboundCreate(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/inbound/action') {
      return erpInboundAction(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/inbound/link-notion') {
      return erpInboundLinkNotion(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/stock-log/sync') {
      return erpStockLogSync(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/stock-log/list') {
      return erpStockLogList(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/stock-log/mark-notion') {
      return erpStockLogMarkNotion(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/notes/shadow/sync') {
      return erpNotesShadowSync(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/notes/shadow/list') {
      return erpNotesShadowList(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/notes/shadow/summary') {
      return erpNotesShadowSummary(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/notes/shadow/delete') {
      return erpNotesShadowDelete(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/notes/write') {
      return erpNotesPrimaryWrite(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/health/public') {
      return erpPublicHealth(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/health/supabase-usage') {
      return erpSupabaseUsage(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/reliability/mirror/enqueue') {
      return erpMirrorJobEnqueue(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/reliability/mirror/list') {
      return erpMirrorJobList(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/reliability/mirror/complete') {
      return erpMirrorJobComplete(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/reliability/mirror/fail') {
      return erpMirrorJobFail(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/reliability/summary') {
      return erpReliabilitySummary(request, env, cors);
    }
    if (request.method === 'GET' && url.pathname === '/api/corder/number-state') {
      return erpCorderNumberState(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/corder/number-reserve') {
      return erpCorderNumberReserve(request, env, cors);
    }
    if (request.method === 'POST' && url.pathname === '/api/corder/number-set') {
      return erpCorderNumberSet(request, env, cors);
    }

    const ct = request.headers.get('Content-Type') || '';

    // ── Excel 解密 / Notion 圖片上傳路由 ──
    if (ct.includes('multipart/form-data')) {
      try {
        const fd = await request.formData();
        const action = fd.get('action') || '';

        // ── 品檢照片上傳到 Notion ──
        if (action === 'notionFileUpload') {
          const token = fd.get('token');
          const file = fd.get('file');

          if (!token) return resp400(cors, 'Missing token');
          if (!file) return resp400(cors, 'No file provided');
          if (typeof file.size !== 'number' || file.size <= 0) {
            return resp400(cors, 'Empty file is not allowed');
          }
          if (file.size > NOTION_DIRECT_UPLOAD_MAX_BYTES) {
            return new Response(JSON.stringify({
              error: 'File exceeds the 20MB direct-upload limit',
              code: 'FILE_TOO_LARGE',
              max_bytes: NOTION_DIRECT_UPLOAD_MAX_BYTES,
            }), { status: 413, headers: jh(cors) });
          }

          const notionHeaders = {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': '2026-03-11',
          };

          const createRes = await fetchWithRetry(() =>
            fetch('https://api.notion.com/v1/file_uploads', {
              method: 'POST',
              headers: {
                ...notionHeaders,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({}),
            })
          );

          const upload = await responseJson(createRes);
          if (!createRes.ok || upload.object === 'error') {
            return new Response(JSON.stringify({
              error: upload.message || 'Create file upload failed',
              detail: upload,
            }), {
              status: createRes.status,
              headers: jh(cors),
            });
          }

          const sendUrl = upload.upload_url || `https://api.notion.com/v1/file_uploads/${upload.id}/send`;
          const sendRes = await fetchWithRetry(() => {
            const sendData = new FormData();
            sendData.append('file', file, file.name || 'attachment');
            return fetch(sendUrl, {
              method: 'POST',
              headers: notionHeaders,
              body: sendData,
            });
          }
          );

          const sent = await responseJson(sendRes);
          if (!sendRes.ok || sent.object === 'error') {
            return new Response(JSON.stringify({
              error: sent.message || 'Send file upload failed',
              detail: sent,
            }), {
              status: sendRes.status,
              headers: jh(cors),
            });
          }

          return respOK(cors, {
            id: sent.id || upload.id,
            status: sent.status,
            filename: sent.filename || file.name || 'qc-photo.jpg',
            content_type: sent.content_type || file.type || 'image/jpeg',
            file: {
              type: 'file_upload',
              name: sent.filename || file.name || 'qc-photo.jpg',
              file_upload: { id: sent.id || upload.id },
            },
          });
        }

        // ── Excel 解密路由：原本功能保留 ──
        const file = fd.get('file');
        const pw = fd.get('password') || '576313';
        if (!file) return resp400(cors, 'No file provided');

        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);

        if (bytes[0] !== 0xD0 || bytes[1] !== 0xCF || bytes[2] !== 0x11 || bytes[3] !== 0xE0) {
          return respOK(cors, { base64: u8b64(bytes), encrypted: false });
        }

        const dec = await decryptECMA376Standard(bytes, pw);
        if (!dec) return resp400(cors, '解密失敗，密碼可能有誤');

        return respOK(cors, { base64: u8b64(new Uint8Array(dec)), encrypted: true });
      } catch (e) {
        return resp500(cors, e.message);
      }
    }

    // ── Notion API 代理 ──
    try {
      const { token, method, endpoint, body, downloadUrl, notionVersion, cacheEpoch } = await request.json();
      const notionVersionHeader = notionVersion || '2022-06-28';

      if (downloadUrl) {
        const r = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': notionVersionHeader,
          },
        });

        return new Response(await r.arrayBuffer(), {
          headers: {
            ...cors,
            'Content-Type': r.headers.get('Content-Type') || 'application/octet-stream',
          },
        });
      }

      const normalizedMethod = String(method || 'GET').toUpperCase();
      const cacheable = normalizedMethod === 'GET' || (normalizedMethod === 'POST' && /\/query(?:\?|$)/.test(endpoint || ''));
      const cacheKey = cacheable
        ? await notionReadCacheKey(request.url, token, normalizedMethod, endpoint, body, notionVersionHeader, cacheEpoch)
        : null;
      if (cacheKey) {
        const cached = await caches.default.match(cacheKey);
        if (cached) return withProxyHeaders(cached, cors, 'HIT');
      }

      const opts = {
        method: normalizedMethod,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': notionVersionHeader,
          'Content-Type': 'application/json',
        },
      };

      if (body && method !== 'GET') opts.body = JSON.stringify(body);

      const res = await fetch(`https://api.notion.com/v1/${endpoint}`, opts);
      const responseText = await res.text();
      const response = new Response(responseText, {
        status: res.status,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-ERP-Cache': cacheKey ? 'MISS' : 'BYPASS',
        },
      });
      if (cacheKey && res.ok) {
        const cacheResponse = new Response(responseText, {
          status: res.status,
          headers: {'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30'},
        });
        await caches.default.put(cacheKey, cacheResponse);
      }
      return response;
    } catch (e) {
      return resp500(cors, e.message);
    }
  }
};const jh = (c) => ({ ...c, 'Content-Type': 'application/json' });
const respOK  = (c,d) => new Response(JSON.stringify(d), { headers: jh(c) });
const resp400 = (c,e) => new Response(JSON.stringify({error:e}), { status:400, headers:jh(c) });
const resp500 = (c,e) => new Response(JSON.stringify({error:e}), { status:500, headers:jh(c) });
const NOTION_DIRECT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const RETRYABLE_UPSTREAM_STATUSES = new Set([429, 500, 502, 503, 504]);

const erpDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function responseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function fetchWithRetry(makeRequest, maxAttempts = 4) {
  let lastError = null;
  let lastResponse = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await makeRequest(attempt);
      lastResponse = response;
      if (!RETRYABLE_UPSTREAM_STATUSES.has(response.status) || attempt === maxAttempts - 1) {
        return response;
      }
      const retryAfter = Number(response.headers.get('Retry-After') || 0);
      const waitMs = retryAfter > 0
        ? Math.min(retryAfter * 1000, 8000)
        : Math.min(400 * (2 ** attempt), 4000);
      await erpDelay(waitMs);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts - 1) throw error;
      await erpDelay(Math.min(400 * (2 ** attempt), 4000));
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError || new Error('Upstream request failed');
}

async function notionReadCacheKey(workerUrl, token, method, endpoint, body, notionVersion, cacheEpoch) {
  const tokenBytes = new TextEncoder().encode(String(token || ''));
  const tokenHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', tokenBytes))]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const payload = JSON.stringify({ tokenHash, method, endpoint, body: body || null, notionVersion, cacheEpoch: Number(cacheEpoch) || 0 });
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const url = new URL(workerUrl);
  url.pathname = '/__notion_read_cache__/' + digest;
  url.search = '';
  return new Request(url.toString(), { method: 'GET' });
}

function withProxyHeaders(response, cors, cacheState) {
  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
  headers.set('Cache-Control', 'no-store');
  headers.set('X-ERP-Cache', cacheState);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const BOARD_DB = {
  materials: '43d801b4-a787-4101-bd12-d8b8199385c7',
  orders: '50b7ce68-437e-431f-9a4f-a0d0d65a7b25',
  inbound: 'cff100a4-ddcd-4bda-b8d7-57d44c4b3ce4',
  corders: '64d6326e-c82a-4f5f-bccc-b34833f823c3',
  leave: '897e8784-4c2d-452c-a045-c568e175e6d5',
};

async function erpBoardSummary(request, env, cors) {
  try {
    const url = new URL(request.url);
    const auth = request.headers.get('Authorization') || '';
    const token =
      env.NOTION_TOKEN ||
      env.ERP_NOTION_TOKEN ||
      url.searchParams.get('token') ||
      auth.replace(/^Bearer\s+/i, '');

    if (!token) {
      return new Response(JSON.stringify({
        error: 'Missing Notion token. Set Worker secret NOTION_TOKEN for this read-only summary endpoint.',
      }), { status: 401, headers: jh(cors) });
    }

    const [matPages, orderPages, inboundPages, corderPages, leavePages] = await Promise.all([
      notionQueryAll(token, BOARD_DB.materials),
      notionQueryAll(token, BOARD_DB.orders),
      notionQueryAll(token, BOARD_DB.inbound),
      notionQueryAll(token, BOARD_DB.corders),
      notionQueryAll(token, BOARD_DB.leave),
    ]);

    const mats = matPages.map((p) => ({
      stock: propNumber(p.properties, '目前庫存'),
      safe: propNumber(p.properties, '安全庫存'),
    }));
    const orders = orderPages.map((p) => ({
      status: propSelect(p.properties, '狀態'),
      deadline: propDate(p.properties, '交期'),
      shipDate: propDate(p.properties, '實際出貨日') || propDate(p.properties, '出貨日'),
    }));
    const inbounds = inboundPages.map((p) => ({
      qcStatus: propSelect(p.properties, '品管狀態') || '待品檢',
    }));
    const corders = corderPages.map((p) => ({
      status: propSelect(p.properties, '狀態') || '出貨中',
    }));
    const leaves = leavePages.map((p) => ({
      status: propSelect(p.properties, '審核狀態') || '待審核',
    }));

    const today = taipeiDateString();
    const todayShip = orders.filter((o) => o.shipDate === today).length;
    const waitingShip = orders.filter((o) => o.status === '待出貨').length;
    const waitingPick = orders.filter((o) => o.status === '待排程').length;
    const inProduction = orders.filter((o) => o.status === '生產中').length;
    const orderQcPending = orders.filter((o) => o.status === '待檢驗' || o.status === '品檢異常').length;
    const inboundQcPending = inbounds.filter((i) => i.qcStatus === '待品檢').length;
    const stockWarning = mats.filter((m) => m.stock <= m.safe).length;
    const overdue = orders.filter((o) => o.deadline && o.deadline < today && o.status !== '已完成' && o.status !== '取消').length;
    const corderShipping = corders.filter((o) => o.status === '出貨中').length;
    const leavePending = leaves.filter((l) => l.status === '待審核').length;
    const qcPending = orderQcPending + inboundQcPending;
    const totalPending = waitingShip + waitingPick + qcPending + stockWarning + overdue + corderShipping + leavePending;

    return respOK(cors, {
      updatedAt: taipeiISOString(),
      todayShip,
      waitingShip,
      waitingPick,
      inProduction,
      qcPending,
      stockWarning,
      overdue,
      corderShipping,
      leavePending,
      totalPending,
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function notionQueryAll(token, databaseId) {
  let cursor = null;
  const results = [];
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.object === 'error') {
      throw new Error(data.message || `Notion query failed: ${databaseId}`);
    }
    results.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return results;
}

function propNumber(props, key) {
  return props?.[key]?.number ?? 0;
}

function propSelect(props, key) {
  const prop = props?.[key];
  return prop?.select?.name || prop?.status?.name || '';
}

function propDate(props, key) {
  return props?.[key]?.date?.start || '';
}

function taipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function taipeiISOString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
}

function chunkRows(rows, size = 100) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

async function supabaseAll(env, path, pageSize = 1000) {
  const rows = [];
  const separator = path.includes('?') ? '&' : '?';
  for (let offset = 0; ; offset += pageSize) {
    const batch = await supabaseFetch(env, `${path}${separator}limit=${pageSize}&offset=${offset}`);
    const list = Array.isArray(batch) ? batch : [];
    rows.push(...list);
    if (list.length < pageSize) return rows;
  }
}

async function sha256Short(value) {
  return [...new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(value || ''))
  ))].slice(0, 12).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function supabaseTableVersion(env, table, organizationId) {
  const base = String(env.SUPABASE_URL || env.SUPABASE_REST_URL || '').replace(/\/+$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || '';
  if (!base || !serviceKey) throw new Error('Supabase version env missing');
  const query = new URLSearchParams({
    organization_id: `eq.${organizationId}`,
    select: 'updated_at',
    order: 'updated_at.desc',
    limit: '1',
  });
  const res = await fetch(`${base}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: 'application/json',
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  const text = await res.text();
  let rows = null;
  try { rows = text ? JSON.parse(text) : []; } catch { rows = null; }
  if (!res.ok || !Array.isArray(rows)) {
    throw new Error(rows?.message || text || `Supabase ${table} version HTTP ${res.status}`);
  }
  const contentRange = res.headers.get('Content-Range') || '';
  const countText = contentRange.includes('/') ? contentRange.split('/').pop() : '';
  const count = /^\d+$/.test(countText) ? Number(countText) : null;
  if (count === null) throw new Error(`Supabase ${table} exact count unavailable`);
  return { table, count, latest_updated_at: cleanText(rows[0]?.updated_at || '') };
}

async function buildInventoryVersions(env) {
  const versionStep = async (label, work) => {
    try { return await work(); }
    catch (error) { throw new Error(`${label}: ${error?.message || error}`); }
  };
  const context = await versionStep('inventory context', () => getSupabaseInventoryContext(env));
  const organizationId = context.organization.id;
  const [materials, balances, bomHeaders, bomItems] = await Promise.all([
    versionStep('materials version', () => supabaseTableVersion(env, 'materials', organizationId)),
    versionStep('inventory balances version', () => supabaseTableVersion(env, 'inventory_balances', organizationId)),
    versionStep('BOM headers version', () => supabaseTableVersion(env, 'bom_headers', organizationId)),
    versionStep('BOM items version', () => supabaseTableVersion(env, 'bom_items', organizationId)),
  ]);
  const inventoryPayload = JSON.stringify({ materials, balances });
  const bomPayload = JSON.stringify({ materials, bomHeaders, bomItems });
  return {
    ok: true,
    source: 'supabase',
    inventory_version: await sha256Short(inventoryPayload),
    bom_version: await sha256Short(bomPayload),
    counts: {
      materials: materials.count,
      inventory_balances: balances.count,
      bom_headers: bomHeaders.count,
      bom_items: bomItems.count,
    },
    latest_updated_at: {
      materials: materials.latest_updated_at,
      inventory_balances: balances.latest_updated_at,
      bom_headers: bomHeaders.latest_updated_at,
      bom_items: bomItems.latest_updated_at,
    },
    checked_at: taipeiISOString(),
  };
}

function responseWithHeaders(response, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  Object.entries(extraHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function cachedInventoryVersions(request, env, cors) {
  const cache = caches.default;
  const cacheUrl = new URL(request.url);
  cacheUrl.search = '';
  cacheUrl.pathname = '/__erp_inventory_versions__';
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return responseWithHeaders(cached, {...cors, 'X-ERP-Cache': 'HIT'});
  try {
    const payload = await buildInventoryVersions(env);
    const body = JSON.stringify(payload);
    const stored = new Response(body, {
      headers: {'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=15'},
    });
    await cache.put(cacheKey, stored.clone());
    return new Response(body, {
      headers: {...jh(cors), 'Cache-Control': 'public, max-age=15', 'X-ERP-Cache': 'MISS'},
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function versionedInventoryResponse(request, cors, loader) {
  const url = new URL(request.url);
  const revision = cleanText(url.searchParams.get('revision') || '');
  if (!revision || !/^[a-f0-9]{24}$/i.test(revision)) return loader();
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return responseWithHeaders(cached, {
      ...cors,
      'X-ERP-Cache': 'HIT',
      'X-ERP-Data-Version': revision,
    });
  }
  const response = await loader();
  if (!response.ok) return response;
  const body = await response.text();
  const stored = new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=604800, immutable',
      'X-ERP-Data-Version': revision,
    },
  });
  await cache.put(cacheKey, stored.clone());
  return responseWithHeaders(stored, {...cors, 'X-ERP-Cache': 'MISS'});
}

function migrationAuthorized(request, env) {
  const expected = cleanText(env.ERP_MIGRATION_TOKEN || env.NOTION_TOKEN || env.ERP_NOTION_TOKEN || '');
  const header = cleanText(request.headers.get('Authorization') || '');
  const supplied = header.replace(/^Bearer\s+/i, '');
  return !!expected && supplied === expected;
}

async function erpInventoryBomList(request, env, cors) {
  try {
    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const materials = await supabaseAll(
      env,
      `/rest/v1/materials?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,sku,notion_page_id,archived_at`
    );
    const headers = await supabaseAll(
      env,
      `/rest/v1/bom_headers?organization_id=eq.${encodeURIComponent(organizationId)}&archived_at=is.null&select=id,parent_material_id,notion_page_id,status`
    );
    const headerIds = new Set(headers.map((row) => cleanText(row.id)).filter(Boolean));
    const items = await supabaseAll(
      env,
      `/rest/v1/bom_items?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,bom_header_id,component_material_id,quantity,notion_page_id,notes`
    );
    const materialById = new Map(materials.map((row) => [cleanText(row.id), row]));
    const headerById = new Map(headers.map((row) => [cleanText(row.id), row]));
    const rows = items.filter((item) => headerIds.has(cleanText(item.bom_header_id))).map((item) => {
      const header = headerById.get(cleanText(item.bom_header_id)) || {};
      const parent = materialById.get(cleanText(header.parent_material_id)) || {};
      const component = materialById.get(cleanText(item.component_material_id)) || {};
      return {
        id: item.id,
        notion_page_id: cleanText(item.notion_page_id || ''),
        parent_notion_page_id: cleanText(parent.notion_page_id || ''),
        child_notion_page_id: cleanText(component.notion_page_id || ''),
        parent_sku: cleanText(parent.sku || ''),
        child_sku: cleanText(component.sku || ''),
        quantity: Number(item.quantity || 0),
        notes: cleanText(item.notes || ''),
      };
    });
    return respOK(cors, {
      ok: true,
      source: 'supabase',
      parent_count: headers.length,
      row_count: rows.length,
      fetched_at: taipeiISOString(),
      rows,
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpInventoryBomMigrate(request, env, cors) {
  try {
    if (!migrationAuthorized(request, env)) {
      return new Response(JSON.stringify({error: 'Unauthorized BOM migration request'}), {
        status: 401,
        headers: jh(cors),
      });
    }

    const body = await request.json();
    const sourceMaterials = Array.isArray(body?.materials) ? body.materials : [];
    const sourceRows = Array.isArray(body?.bom_rows) ? body.bom_rows : [];
    const fullSnapshot = body?.full_snapshot === true;
    if (!sourceMaterials.length) return resp400(cors, 'Missing BOM material snapshot');
    if (!sourceRows.length) return resp400(cors, 'Missing BOM rows');

    const materialSourceByNotion = new Map();
    for (const row of sourceMaterials) {
      const notionId = cleanText(row.notion_page_id);
      const sku = cleanSku(row.sku || row.code || row.name || '');
      if (notionId && sku) materialSourceByNotion.set(notionId, {...row, sku});
    }

    const desiredPairs = new Set();
    const requiredMaterialNotionIds = new Set();
    for (const row of sourceRows) {
      const notionId = cleanText(row.notion_page_id);
      const parentNotionId = cleanText(row.parent_notion_page_id);
      const childNotionId = cleanText(row.child_notion_page_id);
      const quantity = Number(row.quantity);
      if (!notionId || !parentNotionId || !childNotionId) throw new Error('BOM row is missing a Notion page id');
      if (parentNotionId === childNotionId) throw new Error(`Self-referencing BOM is not allowed: ${notionId}`);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Invalid BOM quantity: ${notionId}`);
      const pair = `${parentNotionId}|${childNotionId}`;
      if (desiredPairs.has(pair)) throw new Error(`Duplicate BOM parent/component pair: ${pair}`);
      desiredPairs.add(pair);
      requiredMaterialNotionIds.add(parentNotionId);
      requiredMaterialNotionIds.add(childNotionId);
    }

    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const warehouseId = context.warehouse.id;
    const existingMaterials = await supabaseAll(
      env,
      `/rest/v1/materials?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,sku,name,material_type,unit,safety_stock,status,notes,notion_page_id,archived_at`
    );
    const materialByNotion = new Map(
      existingMaterials.filter((row) => cleanText(row.notion_page_id)).map((row) => [cleanText(row.notion_page_id), row])
    );
    const materialBySku = new Map(
      existingMaterials.filter((row) => cleanSku(row.sku)).map((row) => [cleanSku(row.sku), row])
    );
    const archivedRequiredMaterialIds = existingMaterials
      .filter((row) => row.archived_at && requiredMaterialNotionIds.has(cleanText(row.notion_page_id)))
      .map((row) => cleanText(row.id));
    for (const chunk of chunkRows(archivedRequiredMaterialIds)) {
      await supabaseFetch(env, `/rest/v1/materials?id=in.(${chunk.join(',')})`, {
        method: 'PATCH',
        headers: {Prefer: 'return=minimal'},
        body: JSON.stringify({archived_at: null}),
      });
    }

    const newMaterialRows = [];
    for (const notionId of requiredMaterialNotionIds) {
      if (materialByNotion.has(notionId)) continue;
      const source = materialSourceByNotion.get(notionId);
      if (!source) throw new Error(`BOM material is absent from source snapshot: ${notionId}`);
      const existingBySku = materialBySku.get(cleanSku(source.sku));
      if (existingBySku) {
        const patched = await supabaseFetch(
          env,
          `/rest/v1/materials?id=eq.${encodeURIComponent(existingBySku.id)}&select=id,sku,notion_page_id`,
          {
            method: 'PATCH',
            headers: {Prefer: 'return=representation'},
            body: JSON.stringify({notion_page_id: notionId, archived_at: null}),
          }
        );
        const material = Array.isArray(patched) ? patched[0] : patched;
        materialByNotion.set(notionId, {...existingBySku, ...material});
        continue;
      }
      const id = crypto.randomUUID();
      newMaterialRows.push({
        id,
        organization_id: organizationId,
        sku: cleanSku(source.sku),
        name: cleanText(source.name || source.sku),
        material_type: cleanText(source.material_type || source.type),
        unit: cleanText(source.unit || ''),
        safety_stock: Number(source.safety_stock || 0),
        status: cleanText(existingMaterials[0]?.status || ''),
        notes: cleanText(source.notes || ''),
        notion_page_id: notionId,
        archived_at: null,
      });
      materialByNotion.set(notionId, {id, ...source});
    }

    for (const chunk of chunkRows(newMaterialRows)) {
      await supabaseFetch(env, '/rest/v1/materials?on_conflict=id&select=id', {
        method: 'POST',
        headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify(chunk),
      });
    }
    const newBalanceRows = newMaterialRows.map((material) => ({
      organization_id: organizationId,
      warehouse_id: warehouseId,
      material_id: material.id,
      quantity: Number(materialSourceByNotion.get(material.notion_page_id)?.stock || 0),
    }));
    for (const chunk of chunkRows(newBalanceRows)) {
      await supabaseFetch(
        env,
        '/rest/v1/inventory_balances?on_conflict=organization_id,warehouse_id,material_id&select=id',
        {
          method: 'POST',
          headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
          body: JSON.stringify(chunk),
        }
      );
    }

    const allHeaders = await supabaseAll(
      env,
      `/rest/v1/bom_headers?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,parent_material_id,version,status,notion_page_id,archived_at`
    );
    const activeStatus = cleanText(allHeaders.find((row) => !row.archived_at)?.status || '');
    if (!activeStatus) throw new Error('Cannot determine the active Supabase BOM status');
    const headerByParent = new Map();
    for (const header of allHeaders) {
      const key = cleanText(header.parent_material_id);
      const current = headerByParent.get(key);
      if (
        !current ||
        (!header.archived_at && current.archived_at) ||
        (!!header.archived_at === !!current.archived_at && Number(header.version) < Number(current.version))
      ) {
        headerByParent.set(key, header);
      }
    }

    const desiredParentNotionIds = [...new Set(sourceRows.map((row) => cleanText(row.parent_notion_page_id)))];
    const headerRows = desiredParentNotionIds.map((parentNotionId) => {
      const parent = materialByNotion.get(parentNotionId);
      if (!parent?.id) throw new Error(`Supabase parent material mapping failed: ${parentNotionId}`);
      const existing = headerByParent.get(cleanText(parent.id));
      return {
        id: existing?.id || crypto.randomUUID(),
        organization_id: organizationId,
        parent_material_id: parent.id,
        version: Number(existing?.version || 1),
        status: activeStatus,
        notion_page_id: parentNotionId,
        notes: cleanText(existing?.notes || 'Migrated from Notion BOM'),
        archived_at: null,
      };
    });
    for (const chunk of chunkRows(headerRows)) {
      await supabaseFetch(env, '/rest/v1/bom_headers?on_conflict=id&select=id,parent_material_id', {
        method: 'POST',
        headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify(chunk),
      });
    }
    const desiredHeaderByParentMaterial = new Map(headerRows.map((row) => [cleanText(row.parent_material_id), row]));

    const allItems = await supabaseAll(
      env,
      `/rest/v1/bom_items?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,bom_header_id,component_material_id,quantity,notion_page_id`
    );
    const existingItemByPair = new Map(
      allItems.map((row) => [`${cleanText(row.bom_header_id)}|${cleanText(row.component_material_id)}`, row])
    );
    const itemRows = sourceRows.map((source, index) => {
      const parent = materialByNotion.get(cleanText(source.parent_notion_page_id));
      const component = materialByNotion.get(cleanText(source.child_notion_page_id));
      const header = desiredHeaderByParentMaterial.get(cleanText(parent?.id));
      if (!header?.id || !component?.id) throw new Error(`Supabase BOM mapping failed: ${source.notion_page_id}`);
      const pair = `${header.id}|${component.id}`;
      const existing = existingItemByPair.get(pair);
      return {
        id: existing?.id || crypto.randomUUID(),
        organization_id: organizationId,
        bom_header_id: header.id,
        component_material_id: component.id,
        quantity: Number(source.quantity),
        sequence: Number(existing?.sequence || ((index + 1) * 10)),
        scrap_rate: Number(existing?.scrap_rate || 0),
        notes: cleanText(source.notes || ''),
        notion_page_id: cleanText(source.notion_page_id),
      };
    });
    for (const chunk of chunkRows(itemRows)) {
      await supabaseFetch(env, '/rest/v1/bom_items?on_conflict=id&select=id', {
        method: 'POST',
        headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify(chunk),
      });
    }

    let deletedItems = 0;
    let archivedHeaders = 0;
    if (fullSnapshot) {
      const desiredHeaderIds = new Set(headerRows.map((row) => cleanText(row.id)));
      const desiredItemIds = new Set(itemRows.map((row) => cleanText(row.id)));
      const staleItemIds = allItems
        .filter((row) => desiredHeaderIds.has(cleanText(row.bom_header_id)) && !desiredItemIds.has(cleanText(row.id)))
        .map((row) => cleanText(row.id));
      for (const chunk of chunkRows(staleItemIds)) {
        await supabaseFetch(env, `/rest/v1/bom_items?id=in.(${chunk.join(',')})`, {method: 'DELETE'});
        deletedItems += chunk.length;
      }
      const desiredParentMaterialIds = new Set(headerRows.map((row) => cleanText(row.parent_material_id)));
      const staleHeaderIds = allHeaders
        .filter((row) => !row.archived_at && !desiredParentMaterialIds.has(cleanText(row.parent_material_id)))
        .map((row) => cleanText(row.id));
      for (const chunk of chunkRows(staleHeaderIds)) {
        await supabaseFetch(env, `/rest/v1/bom_headers?id=in.(${chunk.join(',')})`, {
          method: 'PATCH',
          headers: {Prefer: 'return=minimal'},
          body: JSON.stringify({archived_at: new Date().toISOString()}),
        });
        archivedHeaders += chunk.length;
      }
    }

    return respOK(cors, {
      ok: true,
      source: 'notion_export',
      target: 'supabase',
      full_snapshot: fullSnapshot,
      material_count: sourceMaterials.length,
      created_materials: newMaterialRows.length,
      parent_count: headerRows.length,
      bom_row_count: itemRows.length,
      deleted_stale_items: deletedItems,
      archived_stale_headers: archivedHeaders,
      migrated_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpInventoryBomUpsert(request, env, cors) {
  try {
    if (!migrationAuthorized(request, env)) {
      return new Response(JSON.stringify({error: 'Unauthorized BOM update request'}), {
        status: 401,
        headers: jh(cors),
      });
    }

    const body = await request.json();
    const sourceRows = Array.isArray(body?.rows) ? body.rows : [];
    const sourceMaterials = Array.isArray(body?.materials) ? body.materials : [];
    if (!sourceRows.length) return resp400(cors, 'Missing BOM rows');
    if (sourceRows.length > 5000) return resp400(cors, 'BOM update exceeds 5000 rows');

    const materialSpecBySku = new Map();
    for (const source of sourceMaterials) {
      const sku = cleanSku(source.sku || source.code || source.name || '');
      if (!sku) continue;
      materialSpecBySku.set(sku, {...source, sku});
    }

    const desiredPairs = new Set();
    const rows = sourceRows.map((source) => {
      const parentSku = cleanSku(source.parent_sku || source.parent || '');
      const childSku = cleanSku(source.child_sku || source.child || '');
      const quantity = Number(source.quantity ?? source.qty);
      if (!parentSku || !childSku) throw new Error('BOM row is missing parent or child SKU');
      if (parentSku === childSku) throw new Error(`Self-referencing BOM is not allowed: ${parentSku}`);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Invalid BOM quantity: ${parentSku} -> ${childSku}`);
      const pair = `${parentSku}|${childSku}`;
      if (desiredPairs.has(pair)) throw new Error(`Duplicate BOM parent/component pair: ${pair}`);
      desiredPairs.add(pair);
      return {
        parentSku,
        childSku,
        quantity,
        notes: cleanText(source.notes || ''),
        notionPageId: cleanText(source.notion_page_id || ''),
      };
    });

    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const warehouseId = context.warehouse.id;
    const existingMaterials = await supabaseAll(
      env,
      `/rest/v1/materials?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,sku,name,material_type,unit,safety_stock,status,notes,notion_page_id,archived_at`
    );
    const materialBySku = new Map(
      existingMaterials.filter((row) => cleanSku(row.sku)).map((row) => [cleanSku(row.sku), row])
    );
    const requiredSkus = [...new Set(rows.flatMap((row) => [row.parentSku, row.childSku]))];
    let createdMaterials = 0;

    for (const sku of requiredSkus) {
      const current = materialBySku.get(sku);
      const spec = materialSpecBySku.get(sku) || {};
      let material = current;
      if (!current || current.archived_at) {
        material = await upsertSupabaseMaterial(env, organizationId, current, {
          sku,
          name: spec.name || sku,
          type: spec.material_type || spec.type || (/^S-/i.test(sku) ? '蝦皮用' : '零件'),
          unit: spec.unit || '個',
          safe: Number(spec.safety_stock ?? spec.safe ?? 0) || 0,
          note: spec.notes || spec.note || '',
          notion_page_id: spec.notion_page_id || current?.notion_page_id || '',
        });
        if (!current) createdMaterials++;
      }
      if (!material?.id) throw new Error(`Supabase material update failed: ${sku}`);
      materialBySku.set(sku, material);
      if (!current) {
        await upsertSupabaseBalance(
          env,
          organizationId,
          warehouseId,
          material.id,
          Number(spec.stock ?? spec.quantity ?? 0) || 0
        );
      }
    }

    const allHeaders = await supabaseAll(
      env,
      `/rest/v1/bom_headers?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,parent_material_id,version,status,notion_page_id,notes,archived_at`
    );
    const activeStatus = cleanText(allHeaders.find((row) => !row.archived_at)?.status || '啟用');
    const headerByParent = new Map();
    for (const header of allHeaders) {
      const key = cleanText(header.parent_material_id);
      const current = headerByParent.get(key);
      if (!current || (!header.archived_at && current.archived_at)) headerByParent.set(key, header);
    }

    const parentSkus = [...new Set(rows.map((row) => row.parentSku))];
    const headerRows = parentSkus.map((sku) => {
      const parent = materialBySku.get(sku);
      const existing = headerByParent.get(cleanText(parent.id));
      return {
        id: existing?.id || crypto.randomUUID(),
        organization_id: organizationId,
        parent_material_id: parent.id,
        version: Number(existing?.version || 1),
        status: activeStatus,
        notion_page_id: cleanText(existing?.notion_page_id || parent.notion_page_id || ''),
        notes: cleanText(existing?.notes || 'ERP BOM'),
        archived_at: null,
      };
    });
    for (const chunk of chunkRows(headerRows)) {
      await supabaseFetch(env, '/rest/v1/bom_headers?on_conflict=id&select=id,parent_material_id', {
        method: 'POST',
        headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify(chunk),
      });
    }
    const headerByParentMaterial = new Map(headerRows.map((row) => [cleanText(row.parent_material_id), row]));

    const allItems = await supabaseAll(
      env,
      `/rest/v1/bom_items?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,bom_header_id,component_material_id,quantity,notion_page_id,sequence,scrap_rate`
    );
    const existingItemByPair = new Map(
      allItems.map((row) => [`${cleanText(row.bom_header_id)}|${cleanText(row.component_material_id)}`, row])
    );
    const itemRows = rows.map((source, index) => {
      const parent = materialBySku.get(source.parentSku);
      const component = materialBySku.get(source.childSku);
      const header = headerByParentMaterial.get(cleanText(parent.id));
      const pair = `${header.id}|${component.id}`;
      const existing = existingItemByPair.get(pair);
      return {
        id: existing?.id || crypto.randomUUID(),
        organization_id: organizationId,
        bom_header_id: header.id,
        component_material_id: component.id,
        quantity: source.quantity,
        sequence: Number(existing?.sequence || ((index + 1) * 10)),
        scrap_rate: Number(existing?.scrap_rate || 0),
        notes: source.notes,
        notion_page_id: source.notionPageId || cleanText(existing?.notion_page_id || '') || null,
      };
    });
    for (const chunk of chunkRows(itemRows)) {
      await supabaseFetch(env, '/rest/v1/bom_items?on_conflict=id&select=id', {
        method: 'POST',
        headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify(chunk),
      });
    }

    return respOK(cors, {
      ok: true,
      source: 'erp',
      target: 'supabase',
      material_count: requiredSkus.length,
      created_materials: createdMaterials,
      parent_count: headerRows.length,
      bom_row_count: itemRows.length,
      updated_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpInventoryList(request, env, cors) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 5000) || 5000, 1), 20000);
    const pageSize = Math.min(Number(url.searchParams.get('page_size') || 1000) || 1000, 1000);
    const rows = [];

    const select = [
      'id',
      'sku',
      'name',
      'material_type',
      'unit',
      'safety_stock',
      'notes',
      'notion_page_id',
      'status',
      'updated_at',
      'inventory_balances(quantity,reserved_quantity,updated_at,warehouses(code))',
    ].join(',');

    for (let offset = 0; offset < limit; offset += pageSize) {
      const batch = await supabaseFetch(
        env,
        `/rest/v1/materials?archived_at=is.null&select=${encodeURIComponent(select)}&order=sku.asc&limit=${pageSize}&offset=${offset}`
      );
      const list = Array.isArray(batch) ? batch : [];
      rows.push(...list);
      if (list.length < pageSize || rows.length >= limit) break;
    }

    const materials = rows.slice(0, limit).map((row) => {
      const balances = Array.isArray(row.inventory_balances) ? row.inventory_balances : [];
      const main = balances.find((b) => b?.warehouses?.code === 'MAIN') || balances[0] || {};
      const quantity = Number(main.quantity || 0);
      const reserved = Number(main.reserved_quantity || 0);
      return {
        id: row.id,
        supabase_id: row.id,
        notion_page_id: cleanText(row.notion_page_id || ''),
        sku: cleanText(row.sku || ''),
        code: cleanText(row.sku || ''),
        name: cleanText(row.name || row.sku || ''),
        material_type: cleanText(row.material_type || ''),
        type: cleanText(row.material_type || ''),
        unit: cleanText(row.unit || ''),
        stock: quantity,
        qty: quantity,
        reserved_quantity: reserved,
        available_quantity: quantity - reserved,
        safety_stock: Number(row.safety_stock || 0),
        safe: Number(row.safety_stock || 0),
        note: cleanText(row.notes || ''),
        status: cleanText(row.status || ''),
        updated_at: main.updated_at || row.updated_at || '',
        source: 'supabase',
      };
    }).filter((row) => row.sku || row.name);

    return respOK(cors, {
      ok: true,
      source: 'supabase',
      count: materials.length,
      raw_count: rows.length,
      fetched_at: taipeiISOString(),
      materials,
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpInventorySync(request, env, cors) {
  try {
    const body = await request.json();
    const task = body?.task || body;
    const payload = task?.payload || {};
    const sku = cleanSku(payload.sku || payload.code || payload.name || '');
    if (!task?.kind) return resp400(cors, 'Missing inventory sync kind');
    if (!sku) return resp400(cors, 'Missing inventory SKU');

    const context = await getSupabaseInventoryContext(env);
    const organization = context.organization;
    const warehouse = context.warehouse;

    let material = null;
    if (payload.notion_page_id) {
      material = await supabaseSingle(env, `/rest/v1/materials?notion_page_id=eq.${encodeURIComponent(payload.notion_page_id)}&select=id,sku,name,material_type,notion_page_id,organization_id&limit=1`, true);
    }
    if (!material) {
      material = await supabaseSingle(env, `/rest/v1/materials?organization_id=eq.${encodeURIComponent(organization.id)}&sku=eq.${encodeURIComponent(sku)}&select=id,sku,name,material_type,notion_page_id,organization_id&limit=1`, true);
    }

    const existedBeforeSync = !!material;
    if (task.kind === 'upsert_material' || !material) {
      material = await upsertSupabaseMaterial(env, organization.id, material, {...payload, sku});
    }
    if (!material?.id) throw new Error(`Supabase material sync failed: ${sku}`);

    const stock = Number(payload.stock);
    if ((task.kind === 'set_stock' || task.kind === 'upsert_material') && Number.isFinite(stock)) {
      await upsertSupabaseBalance(env, organization.id, warehouse.id, material.id, stock);
    }

    return respOK(cors, {
      ok: true,
      kind: task.kind,
      sku,
      material_id: material.id,
      notion_page_id: cleanText(material.notion_page_id || ''),
      stock: Number.isFinite(stock) ? stock : null,
      created: !existedBeforeSync,
      mirrored_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function activeSupabaseBomReferences(env, materialId) {
  const parentRows = await supabaseFetch(
    env,
    `/rest/v1/bom_headers?parent_material_id=eq.${encodeURIComponent(materialId)}&archived_at=is.null&select=id,notion_page_id&limit=2000`
  );
  const componentRows = await supabaseFetch(
    env,
    `/rest/v1/bom_items?component_material_id=eq.${encodeURIComponent(materialId)}&select=id,bom_header_id&limit=2000`
  );
  const headerIds = [...new Set((Array.isArray(componentRows) ? componentRows : [])
    .map((row) => cleanText(row.bom_header_id))
    .filter(Boolean))];
  let activeComponentRows = [];
  if (headerIds.length) {
    const filter = headerIds.join(',');
    activeComponentRows = await supabaseFetch(
      env,
      `/rest/v1/bom_headers?id=in.(${encodeURIComponent(filter)})&archived_at=is.null&select=id,notion_page_id&limit=2000`
    );
  }
  const parent = Array.isArray(parentRows) ? parentRows : [];
  const component = Array.isArray(activeComponentRows) ? activeComponentRows : [];
  return {
    parent,
    component,
    all: [...new Map([...parent, ...component].map((row) => [row.id, row])).values()],
  };
}

async function erpInventoryMaterialArchive(request, env, cors) {
  try {
    const body = await request.json();
    const payload = body?.payload || body || {};
    const requested = Array.isArray(payload.items) ? payload.items : [payload];
    if (!requested.length) return resp400(cors, 'Missing inventory materials');

    const context = await getSupabaseInventoryContext(env);
    const resolved = [];
    const seen = new Set();
    const allowedBomNotionIds = new Set(
      (Array.isArray(payload.bom_notion_page_ids) ? payload.bom_notion_page_ids : [])
        .map((id) => cleanText(id))
        .filter(Boolean)
    );
    for (const item of requested) {
      const sku = cleanSku(item?.sku || item?.code || item?.name || '');
      const material = await resolveSupabaseMaterial(
        env,
        context.organization.id,
        item || {},
        sku,
        false
      );
      if (!material?.id) {
        if (payload.ignore_missing === true || item?.ignore_missing === true) continue;
        throw new Error(`Supabase 找不到料號：${sku || item?.notion_page_id || '未知料號'}`);
      }
      if (seen.has(material.id)) continue;
      seen.add(material.id);
      resolved.push({material});
    }

    if (!resolved.length) {
      return respOK(cors, {
        ok: true,
        mode: cleanText(payload.mode || 'archive'),
        dry_run: payload.dry_run === true,
        count: 0,
        materials: [],
        bom_headers_archived: 0,
      });
    }

    const allowNonzero = payload.allow_nonzero === true ||
      (requested.length > 0 && requested.every((item) => item?.allow_nonzero === true));
    const rpcResult = await supabaseFetch(env, '/rest/v1/rpc/archive_inventory_materials', {
      method: 'POST',
      body: JSON.stringify({
        p_organization_id: context.organization.id,
        p_warehouse_id: context.warehouse.id,
        p_material_ids: resolved.map((row) => row.material.id),
        p_allowed_bom_notion_ids: [...allowedBomNotionIds],
        p_allow_nonzero: allowNonzero,
        p_dry_run: payload.dry_run === true,
      }),
    });
    const materials = Array.isArray(rpcResult?.materials) ? rpcResult.materials : [];
    const archivedCount = materials.filter((item) => item?.already_archived !== true).length;

    return respOK(cors, {
      ok: true,
      mode: cleanText(payload.mode || 'archive'),
      count: payload.dry_run === true ? materials.length : archivedCount,
      ...rpcResult,
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpInventoryAdjust(request, env, cors) {
  try {
    const body = await request.json();
    const payload = body?.payload || body || {};
    const sku = cleanSku(payload.sku || payload.code || payload.name || '');
    const delta = Number(payload.delta);
    const requestedStock = Number(payload.stock ?? payload.next_stock ?? payload.nextStock);
    if (!sku) return resp400(cors, 'Missing inventory SKU');
    if (!Number.isFinite(delta) && !Number.isFinite(requestedStock)) {
      return resp400(cors, 'Missing inventory delta or stock');
    }

    const context = await getSupabaseInventoryContext(env);
    const shouldCreateMaterial = Number.isFinite(delta) ? delta > 0 : Number.isFinite(requestedStock);
    const material = await resolveSupabaseMaterial(
      env,
      context.organization.id,
      payload,
      sku,
      shouldCreateMaterial
    );
    if (!material?.id) {
      throw new Error(`Supabase material not found; inventory was not changed: ${sku}`);
    }

    let adjusted;
    const idempotencyKey = cleanText(payload.idempotency_key || '');
    if (Number.isFinite(delta) && idempotencyKey && payload.allow_negative !== true) {
      const existingTx = await supabaseSingle(
        env,
        `/rest/v1/inventory_transactions?organization_id=eq.${encodeURIComponent(context.organization.id)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id&limit=1`,
        true
      );
      const sourceId = cleanText(payload.source_id || '');
      const rpcData = await supabaseFetch(env, '/rest/v1/rpc/apply_inventory_transaction', {
        method: 'POST',
        body: JSON.stringify({
          p_organization_id: context.organization.id,
          p_warehouse_id: context.warehouse.id,
          p_material_id: material.id,
          p_transaction_type: inventoryTransactionType(payload.source_type, delta),
          p_quantity_delta: delta,
          p_reason: cleanText(payload.reason || 'ERP inventory adjustment'),
          p_idempotency_key: idempotencyKey,
          p_source_type: cleanText(payload.source_type || 'erp'),
          p_source_id: isUuid(sourceId) ? sourceId : null,
          p_source_number: cleanText(payload.ref_no || sourceId || sku),
        }),
      });
      const tx = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!tx?.id) throw new Error(`Supabase inventory transaction failed: ${sku}`);
      adjusted = {
        beforeStock: Number(tx.quantity_before),
        afterStock: Number(tx.quantity_after),
        transactionId: tx.id,
        duplicate: !!existingTx?.id,
      };
    } else {
      adjusted = await compareAndSwapSupabaseBalance(env, {
        organizationId: context.organization.id,
        warehouseId: context.warehouse.id,
        materialId: material.id,
        sku,
        delta,
        requestedStock,
        allowNegative: payload.allow_negative === true,
      });
    }
    return respOK(cors, {
      ok: true,
      sku,
      material_id: material.id,
      before_stock: adjusted.beforeStock,
      after_stock: adjusted.afterStock,
      delta: adjusted.afterStock - adjusted.beforeStock,
      transaction_id: adjusted.transactionId || null,
      idempotency_key: idempotencyKey || null,
      duplicate: adjusted.duplicate === true,
      adjusted_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpInventoryBatchAdjust(request, env, cors) {
  try {
    const body = await request.json();
    const payload = body?.payload || body || {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    const idempotencyKey = cleanText(payload.idempotency_key || '');
    if (!items.length) return resp400(cors, 'Missing inventory batch items');
    if (items.length > 100) return resp400(cors, 'Inventory batch exceeds 100 items');
    if (!idempotencyKey) return resp400(cors, 'Missing inventory batch idempotency key');

    const context = await getSupabaseInventoryContext(env);
    const resolved = [];
    const materialIds = new Set();
    for (const item of items) {
      const sku = cleanSku(item.sku || item.code || item.name || '');
      const delta = Number(item.delta);
      if (!sku) throw new Error('Inventory batch contains a missing SKU');
      if (!Number.isFinite(delta) || delta === 0) {
        throw new Error(`Inventory batch contains an invalid delta: ${sku}`);
      }
      const material = await resolveSupabaseMaterial(
        env,
        context.organization.id,
        item,
        sku,
        delta > 0
      );
      if (!material?.id) {
        throw new Error(`Supabase material not found; inventory batch was not changed: ${sku}`);
      }
      if (materialIds.has(material.id)) throw new Error(`Inventory batch contains a duplicate material: ${sku}`);
      materialIds.add(material.id);
      resolved.push({
        material_id: material.id,
        notion_page_id: cleanText(item.notion_page_id || material.notion_page_id || ''),
        sku,
        delta,
      });
    }

    const sourceId = cleanText(payload.source_id || '');
    const rpcData = await supabaseFetch(env, '/rest/v1/rpc/apply_inventory_batch', {
      method: 'POST',
      body: JSON.stringify({
        p_organization_id: context.organization.id,
        p_warehouse_id: context.warehouse.id,
        p_items: resolved,
        p_transaction_type: inventoryTransactionType(payload.source_type, -1),
        p_reason: cleanText(payload.reason || 'ERP inventory batch'),
        p_idempotency_key: idempotencyKey,
        p_source_type: cleanText(payload.source_type || 'erp_batch'),
        p_source_id: isUuid(sourceId) ? sourceId : null,
        p_source_number: cleanText(payload.ref_no || sourceId || idempotencyKey),
      }),
    });
    const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const rows = Array.isArray(result?.items) ? result.items : [];
    if (rows.length !== resolved.length) {
      throw new Error('Supabase inventory batch returned an unexpected item count');
    }
    const metadata = new Map(resolved.map(item => [item.material_id, item]));
    return respOK(cors, {
      ok: true,
      duplicate: result.duplicate === true,
      idempotency_key: idempotencyKey,
      items: rows.map(row => ({
        ...row,
        notion_page_id: metadata.get(row.material_id)?.notion_page_id || '',
        sku: metadata.get(row.material_id)?.sku || row.sku || '',
      })),
      adjusted_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

function canonicalNotionId(value) {
  return cleanText(value || '').replace(/-/g, '').toLowerCase();
}

function pickingDateTime(value) {
  const text = cleanText(value || '');
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00+08:00`;
  return text;
}

async function deterministicUuid(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(value || ''))
  )).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizePickingItems(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: cleanText(row.id),
    material_id: cleanText(row.material_id),
    material_notion_page_id: cleanText(row.source_material_notion_page_id),
    notion_page_id: cleanText(row.notion_page_id),
    sku: cleanSku(row?.source_payload?.sku || ''),
    name: cleanText(row.item_display || row?.source_payload?.name || row?.source_payload?.sku || ''),
    type: cleanText(row.item_type || row?.source_payload?.type || ''),
    required_quantity: Number(row.required_quantity || 0),
    picked_quantity: Number(row.picked_quantity || 0),
    status: cleanText(row.status || ''),
    notes: cleanText(row.notes || ''),
  }));
}

async function erpPickingList(request, env, cors) {
  try {
    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get('limit') || 5000);
    const limit = Math.max(1, Math.min(5000, Number.isFinite(requestedLimit) ? requestedLimit : 5000));
    const masters = await supabaseFetch(
      env,
      `/rest/v1/pick_lists?organization_id=eq.${encodeURIComponent(organizationId)}&archived_at=is.null&select=id,pick_number,pick_type,status,production_quantity,picked_at,notes,notion_page_id,product_display,picker_display,source_order_notion_page_id,source,source_payload,created_at,updated_at&order=created_at.desc&limit=${limit}`
    );
    const masterIds = (Array.isArray(masters) ? masters : []).map((row) => cleanText(row.id)).filter(Boolean);
    let itemRows = [];
    if (masterIds.length) {
      itemRows = await supabaseAll(
        env,
        `/rest/v1/pick_items?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,pick_list_id,material_id,required_quantity,picked_quantity,notes,notion_page_id,item_display,item_type,status,source_material_notion_page_id,source_payload,created_at,updated_at`
      );
    }
    const grouped = new Map();
    for (const row of itemRows) {
      const key = cleanText(row.pick_list_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    }
    return respOK(cors, {
      ok: true,
      source: 'supabase',
      rows: (Array.isArray(masters) ? masters : []).map((row) => ({
        id: cleanText(row.id),
        pick_number: cleanText(row.pick_number),
        pick_type: cleanText(row.pick_type),
        status: cleanText(row.status),
        production_quantity: Number(row.production_quantity || 0),
        pick_date: cleanText(row.picked_at || row.created_at).slice(0, 10),
        picked_at: cleanText(row.picked_at),
        picker_display: cleanText(row.picker_display),
        product_display: cleanText(row.product_display),
        notes: cleanText(row.notes),
        notion_page_id: cleanText(row.notion_page_id),
        source_order_notion_page_id: cleanText(row.source_order_notion_page_id),
        source: cleanText(row.source),
        fingerprint: cleanText(row?.source_payload?.fingerprint),
        created_at: cleanText(row.created_at),
        updated_at: cleanText(row.updated_at),
        items: normalizePickingItems(grouped.get(cleanText(row.id)) || []),
      })),
      checked_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpPickingCreate(request, env, cors) {
  try {
    const body = await request.json();
    const pickNumber = cleanText(body?.pick_number);
    const source = cleanText(body?.source || 'ERP');
    const sourceOrderNotionId = cleanText(body?.source_order_notion_page_id);
    const sourceItems = Array.isArray(body?.items) ? body.items : [];
    const dryRun = body?.dry_run === true;
    if (!pickNumber) return resp400(cors, 'Missing pick_number');
    if (!sourceItems.length) return resp400(cors, 'Missing picking items');
    if (sourceItems.length > 500) return resp400(cors, 'Picking item limit exceeded');

    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const [existingMasters, orderRows] = await Promise.all([
      supabaseAll(
        env,
        `/rest/v1/pick_lists?organization_id=eq.${encodeURIComponent(organizationId)}&archived_at=is.null&select=id,pick_number,status,notion_page_id,source_order_notion_page_id,source_payload`
      ),
      sourceOrderNotionId
        ? supabaseAll(
            env,
            `/rest/v1/orders?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,notion_page_id`
          )
        : Promise.resolve([]),
    ]);
    const existing = existingMasters.find((row) =>
      sourceOrderNotionId
        ? canonicalNotionId(row.source_order_notion_page_id) === canonicalNotionId(sourceOrderNotionId)
        : cleanText(row.pick_number) === pickNumber
    ) || null;

    if (existing && ['已領料', '已確認扣料'].includes(cleanText(existing.status))) {
      const currentItems = await supabaseAll(
        env,
        `/rest/v1/pick_items?pick_list_id=eq.${encodeURIComponent(existing.id)}&select=id,pick_list_id,material_id,required_quantity,picked_quantity,notes,notion_page_id,item_display,item_type,status,source_material_notion_page_id,source_payload`
      );
      return respOK(cors, {
        ok: true,
        existing: true,
        completed: true,
        row: {
          id: existing.id,
          pick_number: existing.pick_number,
          status: existing.status,
          notion_page_id: cleanText(existing.notion_page_id),
          items: normalizePickingItems(currentItems),
        },
      });
    }

    const resolved = [];
    const seenMaterialIds = new Set();
    for (const item of sourceItems) {
      const requiredQuantity = Number(item?.required_quantity ?? item?.quantity ?? 0);
      const sku = cleanSku(item?.sku || item?.code || '');
      if (!(requiredQuantity > 0)) throw new Error(`Invalid picking quantity: ${sku || 'unknown material'}`);
      const material = await resolveSupabaseMaterial(
        env,
        organizationId,
        { notion_page_id: cleanText(item?.material_notion_page_id || item?.notion_page_id) },
        sku,
        false
      );
      if (!material?.id) throw new Error(`Material not found in Supabase: ${sku || item?.material_notion_page_id || 'unknown'}`);
      if (seenMaterialIds.has(material.id)) throw new Error(`Duplicate picking material: ${material.sku || sku}`);
      seenMaterialIds.add(material.id);
      resolved.push({
        material,
        required_quantity: requiredQuantity,
        picked_quantity: Number(item?.picked_quantity || 0),
        item_display: cleanText(item?.name || item?.item_display || material.name || material.sku),
        item_type: cleanText(item?.type || item?.item_type || material.material_type),
        status: cleanText(item?.status || '足夠'),
        notes: cleanText(item?.notes || ''),
      });
    }
    const fingerprintSource = resolved
      .map((item) => `${item.material.id}:${item.required_quantity}`)
      .sort()
      .join('|');
    const fingerprint = await sha256Short(fingerprintSource);
    const existingFingerprint = cleanText(existing?.source_payload?.fingerprint);
    if (existingFingerprint && existingFingerprint !== fingerprint) {
      return new Response(JSON.stringify({
        error: 'Picking fingerprint mismatch. BOM or quantity changed after picking started.',
        existing_fingerprint: existingFingerprint,
        requested_fingerprint: fingerprint,
      }), { status: 409, headers: jh(cors) });
    }

    const pickKey = sourceOrderNotionId
      ? `order:${canonicalNotionId(sourceOrderNotionId)}`
      : `manual:${pickNumber}`;
    const pickId = cleanText(existing?.id) || await deterministicUuid(`${organizationId}:pick:${pickKey}`);
    const order = orderRows.find((row) =>
      canonicalNotionId(row.notion_page_id) === canonicalNotionId(sourceOrderNotionId)
    ) || null;
    const masterRow = {
      id: pickId,
      organization_id: organizationId,
      pick_number: cleanText(existing?.pick_number || pickNumber),
      pick_type: cleanText(body?.pick_type || (sourceOrderNotionId ? '訂單領料' : '臨時補料')),
      order_id: order?.id || null,
      status: '待領料',
      production_quantity: Number(body?.production_quantity || resolved.reduce((sum, item) => sum + item.required_quantity, 0)),
      notes: cleanText(body?.notes || ''),
      product_display: cleanText(body?.product_display || ''),
      picker_display: cleanText(body?.picker_display || ''),
      source_order_notion_page_id: sourceOrderNotionId || null,
      source,
      source_payload: {
        fingerprint,
        fingerprint_source: fingerprintSource,
        created_from: source,
      },
      updated_at: taipeiISOString(),
    };
    if (dryRun) {
      return respOK(cors, {
        ok: true,
        dry_run: true,
        existing: Boolean(existing),
        row: {
          ...masterRow,
          notion_page_id: cleanText(existing?.notion_page_id),
          items: resolved.map((item) => ({
            material_id: item.material.id,
            material_notion_page_id: cleanText(item.material.notion_page_id),
            sku: cleanSku(item.material.sku),
            name: item.item_display,
            type: item.item_type,
            required_quantity: item.required_quantity,
          })),
        },
      });
    }

    let savedMaster = null;
    if (existing?.id) {
      const data = await supabaseFetch(
        env,
        `/rest/v1/pick_lists?id=eq.${encodeURIComponent(pickId)}&select=id,pick_number,status,notion_page_id,source_order_notion_page_id,source_payload`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(masterRow),
        }
      );
      savedMaster = Array.isArray(data) ? data[0] : data;
    } else {
      const data = await supabaseFetch(env, '/rest/v1/pick_lists?on_conflict=id&select=id,pick_number,status,notion_page_id,source_order_notion_page_id,source_payload', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(masterRow),
      });
      savedMaster = Array.isArray(data) ? data[0] : data;
    }
    if (!savedMaster?.id) throw new Error('Supabase picking master write failed');

    const existingItemRows = await supabaseAll(
      env,
      `/rest/v1/pick_items?pick_list_id=eq.${encodeURIComponent(pickId)}&select=id,material_id,required_quantity,notion_page_id`
    );
    const existingByMaterial = new Map(existingItemRows.map((row) => [cleanText(row.material_id), row]));
    const savedItems = [];
    for (const item of resolved) {
      const existingItem = existingByMaterial.get(item.material.id) || null;
      if (existingItem && Number(existingItem.required_quantity) !== item.required_quantity) {
        throw new Error(`Picking quantity changed for ${item.material.sku}`);
      }
      const itemId = cleanText(existingItem?.id) || await deterministicUuid(`${pickId}:material:${item.material.id}`);
      const itemRow = {
        id: itemId,
        organization_id: organizationId,
        pick_list_id: pickId,
        material_id: item.material.id,
        required_quantity: item.required_quantity,
        picked_quantity: item.picked_quantity,
        notes: item.notes,
        item_display: item.item_display,
        item_type: item.item_type,
        status: item.status,
        source_material_notion_page_id: cleanText(item.material.notion_page_id) || null,
        source_payload: {
          sku: cleanSku(item.material.sku),
          name: item.item_display,
          type: item.item_type,
        },
        is_historical_migration: false,
        updated_at: taipeiISOString(),
      };
      let savedItem = null;
      if (existingItem?.id) {
        const data = await supabaseFetch(
          env,
          `/rest/v1/pick_items?id=eq.${encodeURIComponent(itemId)}&select=id,pick_list_id,material_id,required_quantity,picked_quantity,notion_page_id,item_display,item_type,status,source_material_notion_page_id,source_payload`,
          {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(itemRow),
          }
        );
        savedItem = Array.isArray(data) ? data[0] : data;
      } else {
        const data = await supabaseFetch(
          env,
          '/rest/v1/pick_items?on_conflict=id&select=id,pick_list_id,material_id,required_quantity,picked_quantity,notion_page_id,item_display,item_type,status,source_material_notion_page_id,source_payload',
          {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
            body: JSON.stringify(itemRow),
          }
        );
        savedItem = Array.isArray(data) ? data[0] : data;
      }
      if (!savedItem?.id) throw new Error(`Supabase picking item write failed: ${item.material.sku}`);
      savedItems.push(savedItem);
    }

    return respOK(cors, {
      ok: true,
      existing: Boolean(existing),
      completed: false,
      row: {
        id: savedMaster.id,
        pick_number: savedMaster.pick_number,
        status: savedMaster.status,
        notion_page_id: cleanText(savedMaster.notion_page_id),
        source_order_notion_page_id: cleanText(savedMaster.source_order_notion_page_id),
        fingerprint,
        items: normalizePickingItems(savedItems),
      },
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpPickingStatus(request, env, cors) {
  try {
    const body = await request.json();
    const pickId = cleanText(body?.pick_id);
    const status = cleanText(body?.status);
    const allowedStatuses = new Set(['待確認', '待領料', '已領料', '已確認扣料', '缺料待補', '取消']);
    if (!pickId) return resp400(cors, 'Missing pick_id');
    if (!allowedStatuses.has(status)) return resp400(cors, 'Invalid picking status');
    const existing = await supabaseSingle(
      env,
      `/rest/v1/pick_lists?id=eq.${encodeURIComponent(pickId)}&select=id,status,picked_at,notion_page_id&limit=1`
    );
    if (['已領料', '已確認扣料'].includes(cleanText(existing.status)) && !['已領料', '已確認扣料'].includes(status)) {
      return new Response(JSON.stringify({ error: 'Completed picking cannot move back to an incomplete status' }), {
        status: 409,
        headers: jh(cors),
      });
    }
    const masterPatch = {
      status,
      picker_display: cleanText(body?.picker_display || ''),
      updated_at: taipeiISOString(),
    };
    if (['已領料', '已確認扣料'].includes(status)) {
      masterPatch.picked_at = cleanText(existing.picked_at) || taipeiISOString();
    }
    const data = await supabaseFetch(
      env,
      `/rest/v1/pick_lists?id=eq.${encodeURIComponent(pickId)}&select=id,pick_number,status,picked_at,notion_page_id`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(masterPatch),
      }
    );
    const saved = Array.isArray(data) ? data[0] : data;
    const itemPatches = Array.isArray(body?.items) ? body.items : [];
    for (const item of itemPatches) {
      const itemId = cleanText(item?.id);
      if (!itemId) continue;
      const patch = {
        status: cleanText(item?.status || (['已領料', '已確認扣料'].includes(status) ? '足夠' : '')),
        picked_quantity: Number(item?.picked_quantity ?? item?.required_quantity ?? 0),
        updated_at: taipeiISOString(),
      };
      await supabaseFetch(
        env,
        `/rest/v1/pick_items?id=eq.${encodeURIComponent(itemId)}&pick_list_id=eq.${encodeURIComponent(pickId)}&select=id`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(patch),
        }
      );
    }
    return respOK(cors, { ok: true, row: saved });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpPickingLinkNotion(request, env, cors) {
  try {
    const body = await request.json();
    const pickId = cleanText(body?.pick_id);
    const notionPageId = cleanText(body?.notion_page_id);
    if (!pickId) return resp400(cors, 'Missing pick_id');
    if (!notionPageId) return resp400(cors, 'Missing notion_page_id');
    const data = await supabaseFetch(
      env,
      `/rest/v1/pick_lists?id=eq.${encodeURIComponent(pickId)}&select=id,notion_page_id`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ notion_page_id: notionPageId, updated_at: taipeiISOString() }),
      }
    );
    const saved = Array.isArray(data) ? data[0] : data;
    if (!saved?.id) throw new Error('Supabase picking master link failed');
    for (const item of (Array.isArray(body?.items) ? body.items : [])) {
      const itemId = cleanText(item?.id);
      const itemNotionPageId = cleanText(item?.notion_page_id);
      if (!itemId || !itemNotionPageId) continue;
      await supabaseFetch(
        env,
        `/rest/v1/pick_items?id=eq.${encodeURIComponent(itemId)}&pick_list_id=eq.${encodeURIComponent(pickId)}&select=id`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ notion_page_id: itemNotionPageId, updated_at: taipeiISOString() }),
        }
      );
    }
    return respOK(cors, { ok: true, row: saved });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpPickingSummary(request, env, cors) {
  try {
    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const masters = await supabaseAll(
      env,
      `/rest/v1/pick_lists?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,pick_number,status,notion_page_id,source_order_notion_page_id`
    );
    const items = await supabaseAll(
      env,
      `/rest/v1/pick_items?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,pick_list_id,material_id,status,notion_page_id,source_material_notion_page_id`
    );
    const statusCounts = {};
    for (const row of masters) {
      const status = cleanText(row.status || '未設定') || '未設定';
      statusCounts[status] = Number(statusCounts[status] || 0) + 1;
    }
    return respOK(cors, {
      ok: true,
      source: 'supabase',
      master_count: masters.length,
      item_count: items.length,
      status_counts: statusCounts,
      missing_master_notion_ids: masters.filter((row) => !cleanText(row.notion_page_id)).length,
      missing_item_notion_ids: items.filter((row) => !cleanText(row.notion_page_id)).length,
      missing_item_material_links: items.filter((row) => !cleanText(row.material_id)).length,
      master_notion_ids: masters.map((row) => cleanText(row.notion_page_id)).filter(Boolean),
      item_notion_ids: items.map((row) => cleanText(row.notion_page_id)).filter(Boolean),
      checked_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpPickingMigrate(request, env, cors) {
  try {
    if (!migrationAuthorized(request, env)) {
      return new Response(JSON.stringify({error: 'Unauthorized picking migration request'}), {
        status: 401,
        headers: jh(cors),
      });
    }

    const body = await request.json();
    const sourceMasters = Array.isArray(body?.masters) ? body.masters : [];
    const sourceItems = Array.isArray(body?.items) ? body.items : [];
    const dryRun = body?.dry_run !== false;
    if (!sourceMasters.length) return resp400(cors, 'Missing picking master rows');
    if (!sourceItems.length) return resp400(cors, 'Missing picking item rows');
    if (sourceMasters.length > 5000 || sourceItems.length > 20000) {
      return resp400(cors, 'Picking migration exceeds the safety row limit');
    }

    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const [existingMasters, existingItems, materials, orders] = await Promise.all([
      supabaseAll(
        env,
        `/rest/v1/pick_lists?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,pick_number,notion_page_id`
      ),
      supabaseAll(
        env,
        `/rest/v1/pick_items?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,notion_page_id`
      ),
      supabaseAll(
        env,
        `/rest/v1/materials?organization_id=eq.${encodeURIComponent(organizationId)}&archived_at=is.null&select=id,sku,notion_page_id`
      ),
      supabaseAll(
        env,
        `/rest/v1/orders?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,order_number,notion_page_id`
      ),
    ]);

    const existingMasterByNotion = new Map(
      existingMasters
        .filter((row) => canonicalNotionId(row.notion_page_id))
        .map((row) => [canonicalNotionId(row.notion_page_id), row])
    );
    const existingItemByNotion = new Map(
      existingItems
        .filter((row) => canonicalNotionId(row.notion_page_id))
        .map((row) => [canonicalNotionId(row.notion_page_id), row])
    );
    const materialByNotion = new Map(
      materials
        .filter((row) => canonicalNotionId(row.notion_page_id))
        .map((row) => [canonicalNotionId(row.notion_page_id), row])
    );
    const materialBySku = new Map(
      materials
        .filter((row) => cleanSku(row.sku))
        .map((row) => [cleanSku(row.sku), row])
    );
    const orderByNotion = new Map(
      orders
        .filter((row) => canonicalNotionId(row.notion_page_id))
        .map((row) => [canonicalNotionId(row.notion_page_id), row])
    );

    const allowedStatuses = new Set(['待確認', '待領料', '已領料', '已確認扣料', '缺料待補', '取消']);
    const masterRows = [];
    const masterBySourceNotion = new Map();
    const masterHoldbacks = [];
    const masterExclusions = [];
    const seenMasterNotionIds = new Set();
    for (const source of sourceMasters) {
      const notionId = cleanText(source.notion_page_id || '');
      const notionKey = canonicalNotionId(notionId);
      const pickNumber = cleanText(source.pick_number || source.name || '');
      const productionQuantity = source.production_quantity == null || source.production_quantity === ''
        ? null
        : Number(source.production_quantity);
      const isEmptyHistoricalPage = notionKey
        && !pickNumber
        && !cleanText(source.source_order_notion_page_id || '')
        && !cleanText(source.product_display || '')
        && !cleanText(source.status || '')
        && productionQuantity === null
        && !cleanText(source.picker_display || '')
        && !cleanText(source.pick_date || '')
        && !cleanText(source.notes || '');
      if (isEmptyHistoricalPage) {
        masterExclusions.push({notion_page_id: notionId, reason: 'empty_historical_page'});
        continue;
      }
      if (!notionKey || !pickNumber) {
        masterHoldbacks.push({notion_page_id: notionId, pick_number: pickNumber, reason: 'missing_identity'});
        continue;
      }
      if (seenMasterNotionIds.has(notionKey)) {
        masterHoldbacks.push({notion_page_id: notionId, pick_number: pickNumber, reason: 'duplicate_source_identity'});
        continue;
      }
      if (productionQuantity !== null && (!Number.isFinite(productionQuantity) || productionQuantity <= 0)) {
        masterHoldbacks.push({notion_page_id: notionId, pick_number: pickNumber, reason: 'invalid_production_quantity'});
        continue;
      }
      seenMasterNotionIds.add(notionKey);
      const existing = existingMasterByNotion.get(notionKey);
      const sourceOrderNotionId = cleanText(source.source_order_notion_page_id || '');
      const order = orderByNotion.get(canonicalNotionId(sourceOrderNotionId));
      const rawStatus = cleanText(source.status || '');
      const status = allowedStatuses.has(rawStatus) ? rawStatus : '待領料';
      const row = {
        id: existing?.id || crypto.randomUUID(),
        organization_id: organizationId,
        pick_number: pickNumber,
        pick_type: cleanText(source.pick_type || (sourceOrderNotionId ? '訂單領料' : '臨時補料')),
        order_id: order?.id || null,
        status,
        production_quantity: productionQuantity,
        picked_at: pickingDateTime(source.picked_at || source.pick_date),
        notes: cleanText(source.notes || ''),
        notion_page_id: notionId,
        product_display: cleanText(source.product_display || ''),
        picker_display: cleanText(source.picker_display || ''),
        source_order_notion_page_id: sourceOrderNotionId || null,
        source: cleanText(source.source || 'Notion migration'),
        notion_created_at: pickingDateTime(source.notion_created_at),
        notion_last_edited_at: pickingDateTime(source.notion_last_edited_at),
        source_payload: source.source_payload || null,
        archived_at: null,
      };
      masterRows.push(row);
      masterBySourceNotion.set(notionKey, row);
    }

    const itemRows = [];
    const itemHoldbacks = [];
    const seenItemNotionIds = new Set();
    let materialMappedByRelation = 0;
    let materialMappedByExactSku = 0;
    let materialMappedByLegacyYAlias = 0;
    let materialUnlinkedHistorical = 0;
    for (const source of sourceItems) {
      const notionId = cleanText(source.notion_page_id || '');
      const notionKey = canonicalNotionId(notionId);
      const masterKey = canonicalNotionId(source.master_notion_page_id || '');
      const materialKey = canonicalNotionId(source.material_notion_page_id || '');
      const requiredQuantity = Number(source.required_quantity);
      const pickedQuantity = source.picked_quantity == null || source.picked_quantity === ''
        ? null
        : Number(source.picked_quantity);
      const master = masterBySourceNotion.get(masterKey);
      let material = materialByNotion.get(materialKey);
      let mapping = 'relation';
      if (!material) {
        const exactSku = cleanSku(source.item_display || '');
        material = materialBySku.get(exactSku);
        mapping = 'exact_sku';
        if (!material && cleanText(source.item_type || '') === '零件' && exactSku && !exactSku.startsWith('Y-')) {
          material = materialBySku.get(cleanSku(`Y-${exactSku}`));
          mapping = 'legacy_y_alias';
        }
      }
      if (!material) mapping = 'unlinked_historical';
      let reason = '';
      if (!notionKey) reason = 'missing_identity';
      else if (seenItemNotionIds.has(notionKey)) reason = 'duplicate_source_identity';
      else if (!master) reason = 'missing_master_relation';
      else if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) reason = 'invalid_required_quantity';
      else if (pickedQuantity !== null && !Number.isFinite(pickedQuantity)) reason = 'invalid_picked_quantity';
      if (reason) {
        itemHoldbacks.push({
          notion_page_id: notionId,
          master_notion_page_id: cleanText(source.master_notion_page_id || ''),
          material_notion_page_id: cleanText(source.material_notion_page_id || ''),
          item_display: cleanText(source.item_display || ''),
          reason,
        });
        continue;
      }
      seenItemNotionIds.add(notionKey);
      if (mapping === 'relation') materialMappedByRelation++;
      else if (mapping === 'exact_sku') materialMappedByExactSku++;
      else if (mapping === 'legacy_y_alias') materialMappedByLegacyYAlias++;
      else materialUnlinkedHistorical++;
      const existing = existingItemByNotion.get(notionKey);
      itemRows.push({
        id: existing?.id || crypto.randomUUID(),
        organization_id: organizationId,
        pick_list_id: master.id,
        material_id: material?.id || null,
        required_quantity: requiredQuantity,
        picked_quantity: pickedQuantity,
        notes: cleanText(source.notes || ''),
        notion_page_id: notionId,
        item_display: cleanText(source.item_display || material.sku || ''),
        item_type: cleanText(source.item_type || ''),
        status: cleanText(source.status || ''),
        source_material_notion_page_id: cleanText(source.material_notion_page_id || '') || null,
        notion_created_at: pickingDateTime(source.notion_created_at),
        notion_last_edited_at: pickingDateTime(source.notion_last_edited_at),
        source_payload: source.source_payload || null,
        is_historical_migration: true,
      });
    }

    const result = {
      ok: masterHoldbacks.length === 0 && itemHoldbacks.length === 0,
      dry_run: dryRun,
      source_master_count: sourceMasters.length,
      source_item_count: sourceItems.length,
      importable_master_count: masterRows.length,
      importable_item_count: itemRows.length,
      material_mapped_by_relation: materialMappedByRelation,
      material_mapped_by_exact_sku: materialMappedByExactSku,
      material_mapped_by_legacy_y_alias: materialMappedByLegacyYAlias,
      material_unlinked_historical: materialUnlinkedHistorical,
      master_exclusions: masterExclusions,
      master_holdbacks: masterHoldbacks,
      item_holdbacks: itemHoldbacks,
      migrated_at: taipeiISOString(),
    };
    if (dryRun || !result.ok) return respOK(cors, result);

    for (const chunk of chunkRows(masterRows)) {
      await supabaseFetch(env, '/rest/v1/pick_lists?on_conflict=id&select=id,notion_page_id,pick_number', {
        method: 'POST',
        headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify(chunk),
      });
    }
    for (const chunk of chunkRows(itemRows)) {
      await supabaseFetch(env, '/rest/v1/pick_items?on_conflict=id&select=id,notion_page_id,pick_list_id,material_id', {
        method: 'POST',
        headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify(chunk),
      });
    }
    return respOK(cors, {...result, applied: true});
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpStockLogSync(request, env, cors) {
  try {
    const body = await request.json();
    const item = body?.item || body || {};
    const trace = cleanText(item.client_trace_id || '');
    const requestedSource = cleanText(item.source || 'erp_frontend') || 'erp_frontend';
    const source = ['erp_frontend', 'notion_backfill', 'codex_sync'].includes(requestedSource)
      ? requestedSource
      : 'erp_frontend';
    if (trace) {
      const existing = await supabaseSingle(env, `/rest/v1/erp_stock_logs?client_trace_id=eq.${encodeURIComponent(trace)}&select=id,client_trace_id,notion_page_id,created_at&limit=1`, true);
      if (existing?.id) {
        return respOK(cors, {
          ok: true,
          duplicate: true,
          id: existing.id,
          client_trace_id: trace,
          notion_page_id: existing.notion_page_id || '',
          created_at: existing.created_at || '',
        });
      }
    }

    const row = {
      notion_page_id: cleanText(item.notion_page_id || '') || null,
      item_title: cleanText(item.item_title || ''),
      material_id: cleanText(item.material_id || ''),
      material_name: cleanText(item.material_name || ''),
      material_code: cleanText(item.material_code || ''),
      change_type: cleanText(item.change_type || '手動調整'),
      original_action: cleanText(item.original_action || item.change_type || '手動調整'),
      quantity: Number(item.quantity) || 0,
      before_stock: Number(item.before_stock) || 0,
      after_stock: Number(item.after_stock) || 0,
      change_date: cleanDate(item.change_date),
      ref_no: cleanText(item.ref_no || ''),
      operator_role: cleanText(item.operator_role || ''),
      note: cleanText(item.note || ''),
      source,
      client_trace_id: trace || `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    const data = await supabaseFetch(env, '/rest/v1/erp_stock_logs?select=id,client_trace_id,created_at', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    const saved = Array.isArray(data) ? data[0] : data;
    if (!saved?.id) throw new Error('Supabase stock log insert did not return a saved row');
    return respOK(cors, { ok: true, id: saved.id, client_trace_id: saved.client_trace_id, created_at: saved.created_at });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpStockLogList(request, env, cors) {
  try {
    const url = new URL(request.url);
    const mode = cleanText(url.searchParams.get('mode') || 'recent');
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get('days') || 30) || 30));
    // Keep one row below PostgREST's common 1,000-row response cap so the
    // extra look-ahead row remains available for reliable pagination.
    const limit = Math.max(1, Math.min(995, Number(url.searchParams.get('limit') || 300) || 300));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0);
    const pendingNotion = url.searchParams.get('pending_notion') === 'true';
    const fields = 'id,notion_page_id,item_title,material_id,material_name,material_code,change_type,original_action,quantity,before_stock,after_stock,change_date,ref_no,operator_role,note,source,client_trace_id,created_at';
    const filters = [`select=${fields}`];
    if (mode !== 'all') {
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      filters.push(`change_date=gte.${since}`);
    }
    if (pendingNotion) {
      filters.push('or=(notion_page_id.is.null,notion_page_id.eq.)');
    }
    filters.push('order=change_date.desc,created_at.desc');
    filters.push(`limit=${limit + 1}`);
    filters.push(`offset=${offset}`);
    const rows = await supabaseFetch(env, `/rest/v1/stock_logs_public?${filters.join('&')}`);
    const rawRows = Array.isArray(rows) ? rows : [];
    const hasMore = rawRows.length > limit;
    const visibleRows = rawRows.slice(0, limit).filter((row) => !isStockLogTestRow(row));
    return respOK(cors, {
      ok: true,
      rows: visibleRows,
      has_more: hasMore,
      next_offset: hasMore ? offset + limit : null,
      mode,
      days,
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

function isStockLogTestRow(row) {
  const trace = String(row?.client_trace_id || '').toLowerCase();
  const code = String(row?.material_code || '').toUpperCase();
  const ref = String(row?.ref_no || '').toUpperCase();
  const source = String(row?.source || '').toLowerCase();
  return (
    trace.startsWith('codex-') ||
    code.startsWith('TEST-') ||
    ref.includes('SMOKE_TEST') ||
    ref.includes('WORKER_WRITE_TEST') ||
    ref.endsWith('_TEST') ||
    source === 'codex_sync'
  );
}

async function erpStockLogMarkNotion(request, env, cors) {
  try {
    const body = await request.json();
    const id = Number(body?.id || 0);
    const notionPageId = cleanText(body?.notion_page_id || '');
    if (!id) return resp400(cors, 'Missing stock log id');
    if (!notionPageId) return resp400(cors, 'Missing notion_page_id');
    const data = await supabaseFetch(env, `/rest/v1/erp_stock_logs?id=eq.${encodeURIComponent(String(id))}&select=id,notion_page_id`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ notion_page_id: notionPageId }),
    });
    const saved = Array.isArray(data) ? data[0] : data;
    if (!saved?.id) throw new Error('Supabase stock log mark did not return a saved row');
    return respOK(cors, { ok: true, id: saved.id, notion_page_id: saved.notion_page_id });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

function normalizeNotesShadowRow(item, organizationId) {
  const notionPageId = cleanText(item?.notion_page_id || item?.notionPageId || item?.id || '');
  if (!notionPageId) throw new Error('Missing note notion_page_id');
  const list = (value, max = 20) => {
    const source = Array.isArray(value) ? value : String(value || '').split(/[,\s、，]+/);
    return [...new Set(source.map(cleanText).filter(Boolean))].slice(0, max);
  };
  const text = (value, max = 2000) => cleanText(value || '').slice(0, max);
  const nullableDate = (value) => {
    const result = cleanText(value || '');
    return /^\d{4}-\d{2}-\d{2}/.test(result) ? result : null;
  };
  const sourcePayload = item && typeof item === 'object' ? item : {};
  return {
    organization_id: organizationId,
    notion_page_id: notionPageId,
    actual_notion_page_id: text(item.actual_notion_page_id || item.actualNotionPageId, 120) || null,
    title: text(item.title, 300) || '未命名記事',
    note_date: nullableDate(item.note_date || item.noteDate || item.date),
    note_time: text(item.note_time || item.noteTime || item.time, 30),
    note_type: text(item.note_type || item.noteType || item.type, 40) || '一般',
    status: text(item.status, 40) || '未處理',
    body: text(item.body, 5000),
    owner_role: text(item.owner_role || item.ownerRole || item.owner, 80),
    priority: text(item.priority, 40),
    remind_date: nullableDate(item.remind_date || item.remindDate),
    tags: list(item.tags, 30),
    customer_code: text(item.customer_code || item.customerCode, 120),
    linked_customer: text(item.linked_customer || item.linkedCustomer, 500),
    linked_order: text(item.linked_order || item.linkedOrder, 500),
    linked_material: text(item.linked_material || item.linkedMaterial, 1000),
    target_roles: list(item.target_roles || item.targetRoles, 20),
    author_name: text(item.author_name || item.authorName || item.author, 120),
    author_role: text(item.author_role || item.authorRole, 80),
    need_ack: Boolean(item.need_ack ?? item.needAck),
    ack_roles: list(item.ack_roles || item.ackRoles, 20),
    pending_roles: list(item.pending_roles || item.pendingRoles, 20),
    reply_action: text(item.reply_action || item.replyAction, 120),
    replies: text(item.replies, 10000),
    reply_count: Math.max(0, Number(item.reply_count ?? item.replyCount) || 0),
    last_reply: text(item.last_reply || item.lastReply, 2000),
    last_reply_by: text(item.last_reply_by || item.lastReplyBy, 120),
    last_reply_at: nullableDate(item.last_reply_at || item.lastReplyAt),
    completed_at: nullableDate(item.completed_at || item.completedAt),
    customer_notes_page_id: text(item.customer_notes_page_id || item.customerNotesPageId, 120),
    event_page_id: text(item.event_page_id || item.eventPageId, 120),
    backend_url: text(item.backend_url || item.backendUrl || item.notionUrl || item.url, 2000),
    attachment_count: Math.max(
      0,
      Number(item.attachment_count ?? item.attachmentCount)
        || (Array.isArray(item.attachments) ? item.attachments.length : 0)
    ),
    notion_created_at: nullableDate(item.notion_created_at || item.notionCreatedAt || item.createdAt),
    notion_last_edited_at: nullableDate(item.notion_last_edited_at || item.notionLastEditedAt || item.lastEditedAt),
    source_payload: sourcePayload,
    payload_hash: '',
    shadow_synced_at: taipeiISOString(),
    notion_sync_status: text(item.notion_sync_status || item.notionSyncStatus, 30) || 'synced',
    notion_sync_error: text(item.notion_sync_error || item.notionSyncError, 2000) || null,
    notion_synced_at: nullableDate(item.notion_synced_at || item.notionSyncedAt),
    archived_at: nullableDate(item.archived_at || item.archivedAt),
    updated_at: taipeiISOString(),
  };
}

async function erpNotesShadowSync(request, env, cors) {
  try {
    if (!(await erpClientAuthorized(request))) return unauthorizedErpClient(cors);
    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) return resp400(cors, 'Missing notes shadow items');
    if (items.length > 500) return resp400(cors, 'Notes shadow batch exceeds 500 rows');
    const {organization} = await getSupabaseInventoryContext(env);
    const rows = [];
    for (const item of items) {
      const row = normalizeNotesShadowRow(item, organization.id);
      row.payload_hash = await sha256Short(JSON.stringify(row.source_payload));
      rows.push(row);
    }
    let savedCount = 0;
    for (const chunk of chunkRows(rows, 100)) {
      const saved = await supabaseFetch(
        env,
        '/rest/v1/erp_notes_shadow?on_conflict=organization_id,notion_page_id&select=id,notion_page_id',
        {
          method: 'POST',
          headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
          body: JSON.stringify(chunk),
        }
      );
      savedCount += Array.isArray(saved) ? saved.length : 0;
    }
    if (savedCount !== rows.length) {
      throw new Error(`Notes shadow count mismatch: expected ${rows.length}, saved ${savedCount}`);
    }
    return respOK(cors, {
      ok: true,
      source: 'notion',
      target: 'supabase_shadow',
      received: items.length,
      saved: savedCount,
      synced_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpNotesShadowList(request, env, cors) {
  try {
    if (!(await erpClientAuthorized(request))) return unauthorizedErpClient(cors);
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get('limit') || 500) || 500));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0);
    const {organization} = await getSupabaseInventoryContext(env);
    const fields = [
      'id','notion_page_id','actual_notion_page_id','title','note_date','note_time','note_type','status',
      'body','owner_role','priority','remind_date','tags','customer_code','linked_customer',
      'linked_order','linked_material','target_roles','author_name','author_role','need_ack',
      'ack_roles','pending_roles','reply_action','replies','reply_count','last_reply',
      'last_reply_by','last_reply_at','completed_at','customer_notes_page_id','event_page_id',
      'backend_url','attachment_count','notion_created_at','notion_last_edited_at',
      'shadow_synced_at','notion_sync_status','notion_sync_error','notion_synced_at','archived_at','updated_at'
    ].join(',');
    const rows = await supabaseFetch(
      env,
      `/rest/v1/erp_notes_shadow?organization_id=eq.${encodeURIComponent(organization.id)}&archived_at=is.null&select=${fields}&order=note_date.desc,last_reply_at.desc&limit=${limit + 1}&offset=${offset}`
    );
    const list = Array.isArray(rows) ? rows : [];
    const hasMore = list.length > limit;
    return respOK(cors, {
      ok: true,
      source: 'supabase_shadow',
      rows: list.slice(0, limit),
      has_more: hasMore,
      next_offset: hasMore ? offset + limit : null,
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpNotesShadowDelete(request, env, cors) {
  try {
    if (!(await erpClientAuthorized(request))) return unauthorizedErpClient(cors);
    const body = await request.json();
    const notionPageId = cleanText(body?.notion_page_id || body?.notionPageId || '');
    if (!notionPageId) return resp400(cors, 'Missing note notion_page_id');
    const {organization} = await getSupabaseInventoryContext(env);
    await supabaseFetch(
      env,
      `/rest/v1/erp_notes_shadow?organization_id=eq.${encodeURIComponent(organization.id)}&notion_page_id=eq.${encodeURIComponent(notionPageId)}`,
      {method: 'DELETE', headers: {Prefer: 'return=minimal'}}
    );
    return respOK(cors, {ok: true, deleted: notionPageId});
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpNotesShadowSummary(request, env, cors) {
  try {
    if (!(await erpClientAuthorized(request))) return unauthorizedErpClient(cors);
    const {organization} = await getSupabaseInventoryContext(env);
    const rows = await supabaseAll(
      env,
      `/rest/v1/erp_notes_shadow?organization_id=eq.${encodeURIComponent(organization.id)}&select=notion_page_id,note_date,status,pending_roles,reply_count,customer_code,linked_order,linked_material`
    );
    const summary = rows.reduce((acc, row) => {
      acc.total += 1;
      if (!['完成', '取消', '拒絕'].includes(row.status)) acc.active += 1;
      if ((row.pending_roles || []).length) acc.pending += 1;
      if (Number(row.reply_count || 0) > 0) acc.with_replies += 1;
      if (row.customer_code) acc.with_customer += 1;
      if (row.linked_order) acc.with_order += 1;
      if (row.linked_material) acc.with_material += 1;
      if (row.note_date) acc.dated += 1;
      return acc;
    }, {total: 0, active: 0, pending: 0, with_replies: 0, with_customer: 0, with_order: 0, with_material: 0, dated: 0});
    return respOK(cors, {
      ok: true,
      source: 'supabase_shadow',
      summary,
      checked_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpNotesPrimaryWrite(request, env, cors) {
  try {
    if (!(await erpClientAuthorized(request))) return unauthorizedErpClient(cors);
    const body = await request.json();
    const operation = cleanText(body?.operation || 'upsert').toLowerCase();
    const item = body?.item && typeof body.item === 'object' ? body.item : {};
    const noteKey = cleanText(
      body?.note_key || body?.noteKey || item?.notion_page_id || item?.notionPageId || item?.id || ''
    );
    if (!noteKey) return resp400(cors, 'Missing note key');
    const {organization} = await getSupabaseInventoryContext(env);
    const now = taipeiISOString();

    if (operation === 'archive') {
      const saved = await supabaseFetch(
        env,
        `/rest/v1/erp_notes_shadow?organization_id=eq.${encodeURIComponent(organization.id)}&notion_page_id=eq.${encodeURIComponent(noteKey)}&select=id,notion_page_id,archived_at`,
        {
          method: 'PATCH',
          headers: {Prefer: 'return=representation'},
          body: JSON.stringify({
            archived_at: now,
            notion_sync_status: 'pending',
            notion_sync_error: null,
            updated_at: now,
          }),
        }
      );
      return respOK(cors, {ok: true, operation, note_key: noteKey, row: Array.isArray(saved) ? saved[0] : saved});
    }

    const row = normalizeNotesShadowRow({...item, notionPageId: noteKey}, organization.id);
    row.notion_sync_status = cleanText(body?.notion_sync_status || item?.notionSyncStatus || 'pending') || 'pending';
    row.notion_sync_error = null;
    row.archived_at = null;
    row.payload_hash = await sha256Short(JSON.stringify(row.source_payload));
    const savedRows = await supabaseFetch(
      env,
      '/rest/v1/erp_notes_shadow?on_conflict=organization_id,notion_page_id&select=*',
      {
        method: 'POST',
        headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify(row),
      }
    );
    const saved = Array.isArray(savedRows) ? savedRows[0] : savedRows;
    if (!saved?.id) throw new Error('Supabase note write did not return a saved row');

    const event = body?.event && typeof body.event === 'object' ? body.event : null;
    if (event) {
      await supabaseFetch(env, '/rest/v1/erp_note_replies', {
        method: 'POST',
        headers: {Prefer: 'return=minimal'},
        body: JSON.stringify({
          organization_id: organization.id,
          note_key: noteKey,
          actor_role: cleanText(event.actor_role || event.actorRole || ''),
          action: cleanText(event.action || operation),
          comment: cleanText(event.comment || ''),
          created_at: event.created_at || event.createdAt || now,
        }),
      });
    }

    await supabaseFetch(
      env,
      `/rest/v1/erp_note_assignments?organization_id=eq.${encodeURIComponent(organization.id)}&note_key=eq.${encodeURIComponent(noteKey)}`,
      {method: 'DELETE', headers: {Prefer: 'return=minimal'}}
    );
    const targetRoles = Array.isArray(saved.target_roles) ? saved.target_roles : [];
    if (targetRoles.length) {
      const ack = new Set(Array.isArray(saved.ack_roles) ? saved.ack_roles : []);
      const pending = new Set(Array.isArray(saved.pending_roles) ? saved.pending_roles : []);
      await supabaseFetch(env, '/rest/v1/erp_note_assignments', {
        method: 'POST',
        headers: {Prefer: 'return=minimal'},
        body: JSON.stringify(targetRoles.map(role => ({
          organization_id: organization.id,
          note_key: noteKey,
          role_name: role,
          status: pending.has(role) ? 'pending' : ack.has(role) ? 'read' : 'assigned',
          seen_at: ack.has(role) ? now : null,
          acknowledged_at: ack.has(role) ? now : null,
          updated_at: now,
        }))),
      });
    }

    return respOK(cors, {
      ok: true,
      source: 'supabase_primary',
      operation,
      note_key: noteKey,
      row: saved,
      saved_at: now,
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpSupabaseUsage(request, env, cors) {
  try {
    if (!(await erpClientAuthorized(request))) return unauthorizedErpClient(cors);
    const rows = await supabaseFetch(env, '/rest/v1/rpc/erp_resource_usage', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const usage = Array.isArray(rows) ? rows[0] : rows;
    if (!usage) throw new Error('Supabase usage RPC returned no data');
    const limits = {
      database_bytes: 500 * 1024 * 1024,
      storage_bytes: 1024 * 1024 * 1024,
      egress_bytes: 5 * 1024 * 1024 * 1024,
    };
    const egressValue = Number(env.SUPABASE_EGRESS_USED_BYTES || 0);
    return respOK(cors, {
      ok: true,
      plan: 'free',
      usage: {
        database_bytes: Number(usage.database_bytes || 0),
        storage_bytes: Number(usage.storage_bytes || 0),
        storage_objects: Number(usage.storage_objects || 0),
        egress_bytes: egressValue > 0 ? egressValue : null,
      },
      limits,
      egress_source: egressValue > 0 ? 'worker_env' : 'supabase_dashboard_required',
      measured_at: usage.measured_at || taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpPublicHealth(request, env, cors) {
  const checkedAt = taipeiISOString();
  const modules = [];
  const addModule = (name, scope, status, detail, extra = {}) => {
    modules.push({name, scope, status, detail: cleanText(detail), ...extra});
  };
  const runPublic = async (name, detail, work) => {
    try {
      const result = await work();
      addModule(name, 'public', 'ok', detail, result && typeof result === 'object' ? result : {});
    } catch (error) {
      addModule(name, 'public', 'error', error?.message || String(error));
    }
  };

  await runPublic('inventory_versions', 'Inventory and BOM version probe uses Supabase through Worker.', async () => {
    const versions = await buildInventoryVersions(env);
    return {
      source: versions.source,
      counts: versions.counts,
      latest_updated_at: versions.latest_updated_at,
    };
  });

  await runPublic('corder_sequence', 'C-order SHPTW state is read-only; reserve/set are excluded.', async () => {
    const context = await getSupabaseInventoryContext(env);
    const data = await supabaseFetch(env, '/rest/v1/rpc/get_corder_number_state', {
      method: 'POST',
      body: JSON.stringify({p_organization_id: context.organization.id}),
    });
    const state = Array.isArray(data) ? data[0] : data;
    if (!state) throw new Error('C-order sequence state missing');
    return {
      prefix: cleanText(state.prefix),
      next_number: Number(state.next_number || 0),
      updated_at: cleanText(state.updated_at),
    };
  });

  const failed = modules.filter((item) => item.status === 'error').length;
  return respOK(cors, {
    ok: failed === 0,
    version: 'erp-health-v2',
    checked_at: checkedAt,
    public_checks: modules,
    authorized_checks: [
      {route: '/api/notes/shadow/summary', reason: 'Notes counts and fallback state require ERP bearer token.'},
      {route: '/api/health/supabase-usage', reason: 'Supabase usage details require ERP bearer token.'},
      {route: '/api/reliability/summary', reason: 'Mirror jobs and missing mirror counts require ERP bearer token.'},
    ],
    manual_checks: [
      {item: 'Supabase egress usage', reason: 'Egress is Dashboard-only unless Worker env provides a measured value.'},
      {item: 'Failed mirror jobs >= 5 attempts', reason: 'Needs staff review before marking complete or retrying indefinitely.'},
      {item: 'Sequence-mutating C-order checks', reason: 'Use reserve/set only for real orders or intentional admin correction.'},
    ],
  });
}

async function erpClientAuthorized(request) {
  const match = String(request.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)$/i);
  if (!match) return false;
  try {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${match[1]}`,
        'Notion-Version': '2022-06-28',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

function unauthorizedErpClient(cors) {
  return new Response(JSON.stringify({error: 'Unauthorized ERP client request'}), {
    status: 401,
    headers: jh(cors),
  });
}

function normalizeMirrorJob(row) {
  return {
    id: cleanText(row?.id),
    dedupe_key: cleanText(row?.dedupe_key),
    module: cleanText(row?.module),
    action: cleanText(row?.action),
    entity_id: cleanText(row?.entity_id),
    payload: row?.payload && typeof row.payload === 'object' ? row.payload : {},
    status: cleanText(row?.status || 'pending'),
    attempt_count: Number(row?.attempt_count) || 0,
    last_error: cleanText(row?.last_error),
    next_retry_at: cleanText(row?.next_retry_at),
    created_at: cleanText(row?.created_at),
    updated_at: cleanText(row?.updated_at),
  };
}

async function erpMirrorJobEnqueue(request, env, cors) {
  try {
    if (!(await erpClientAuthorized(request))) return unauthorizedErpClient(cors);
    const body = await request.json();
    const job = body?.job || body || {};
    const dedupeKey = cleanText(job.dedupe_key);
    const module = cleanText(job.module);
    const action = cleanText(job.action);
    if (!dedupeKey || !module || !action) return resp400(cors, 'Missing mirror job identity');
    if (dedupeKey.length > 240) return resp400(cors, 'Mirror job dedupe_key is too long');
    const context = await getSupabaseInventoryContext(env);
    const now = taipeiISOString();
    const data = await supabaseFetch(
      env,
      '/rest/v1/erp_mirror_jobs?on_conflict=organization_id,dedupe_key&select=id,dedupe_key,module,action,entity_id,payload,status,attempt_count,last_error,next_retry_at,created_at,updated_at',
      {
        method: 'POST',
        headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify({
          organization_id: context.organization.id,
          dedupe_key: dedupeKey,
          module,
          action,
          entity_id: cleanText(job.entity_id) || null,
          payload: job.payload && typeof job.payload === 'object' ? job.payload : {},
          status: 'pending',
          attempt_count: 0,
          last_error: null,
          next_retry_at: now,
          completed_at: null,
          updated_at: now,
        }),
      }
    );
    const saved = Array.isArray(data) ? data[0] : data;
    if (!saved?.id) throw new Error('Supabase mirror job enqueue did not return a saved row');
    return respOK(cors, {ok: true, job: normalizeMirrorJob(saved)});
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpMirrorJobList(request, env, cors) {
  try {
    if (!(await erpClientAuthorized(request))) return unauthorizedErpClient(cors);
    const context = await getSupabaseInventoryContext(env);
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(300, Number(url.searchParams.get('limit') || 200) || 200));
    const rows = await supabaseFetch(
      env,
      `/rest/v1/erp_mirror_jobs?organization_id=eq.${encodeURIComponent(context.organization.id)}&status=in.(pending,retrying,failed)&select=id,dedupe_key,module,action,entity_id,payload,status,attempt_count,last_error,next_retry_at,created_at,updated_at&order=created_at.asc&limit=${limit}`
    );
    return respOK(cors, {ok: true, jobs: (Array.isArray(rows) ? rows : []).map(normalizeMirrorJob)});
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpMirrorJobComplete(request, env, cors) {
  try {
    if (!(await erpClientAuthorized(request))) return unauthorizedErpClient(cors);
    const body = await request.json();
    const dedupeKey = cleanText(body?.dedupe_key);
    if (!dedupeKey) return resp400(cors, 'Missing mirror job dedupe_key');
    const context = await getSupabaseInventoryContext(env);
    const now = taipeiISOString();
    const data = await supabaseFetch(
      env,
      `/rest/v1/erp_mirror_jobs?organization_id=eq.${encodeURIComponent(context.organization.id)}&dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=id,dedupe_key,status,completed_at`,
      {
        method: 'PATCH',
        headers: {Prefer: 'return=representation'},
        body: JSON.stringify({
          status: 'completed',
          last_error: null,
          next_retry_at: null,
          completed_at: now,
          updated_at: now,
        }),
      }
    );
    const saved = Array.isArray(data) ? data[0] : data;
    if (!saved?.id) throw new Error('Mirror job not found');
    return respOK(cors, {ok: true, job: saved});
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpMirrorJobFail(request, env, cors) {
  try {
    if (!(await erpClientAuthorized(request))) return unauthorizedErpClient(cors);
    const body = await request.json();
    const dedupeKey = cleanText(body?.dedupe_key);
    if (!dedupeKey) return resp400(cors, 'Missing mirror job dedupe_key');
    const context = await getSupabaseInventoryContext(env);
    const current = await supabaseSingle(
      env,
      `/rest/v1/erp_mirror_jobs?organization_id=eq.${encodeURIComponent(context.organization.id)}&dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=id,attempt_count&limit=1`,
      true
    );
    if (!current?.id) throw new Error('Mirror job not found');
    const attempts = (Number(current.attempt_count) || 0) + 1;
    const retryMinutes = Math.min(360, Math.max(1, 2 ** Math.min(attempts - 1, 8)));
    const nextRetry = new Date(Date.now() + retryMinutes * 60000).toISOString();
    const status = attempts >= 5 ? 'failed' : 'retrying';
    const data = await supabaseFetch(
      env,
      `/rest/v1/erp_mirror_jobs?id=eq.${encodeURIComponent(current.id)}&select=id,dedupe_key,status,attempt_count,last_error,next_retry_at`,
      {
        method: 'PATCH',
        headers: {Prefer: 'return=representation'},
        body: JSON.stringify({
          status,
          attempt_count: attempts,
          last_error: cleanText(body?.error || 'Mirror sync failed').slice(0, 2000),
          next_retry_at: nextRetry,
          updated_at: taipeiISOString(),
        }),
      }
    );
    const saved = Array.isArray(data) ? data[0] : data;
    return respOK(cors, {ok: true, job: saved});
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpReliabilitySummary(request, env, cors) {
  try {
    if (!(await erpClientAuthorized(request))) return unauthorizedErpClient(cors);
    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const [jobs, stockLogs, pickMasters, pickItems, inboundReceipts] = await Promise.all([
      supabaseAll(
        env,
        `/rest/v1/erp_mirror_jobs?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,module,status,attempt_count,last_error,next_retry_at,created_at,updated_at`
      ),
      supabaseAll(env, '/rest/v1/erp_stock_logs?select=id,notion_page_id'),
      supabaseAll(env, `/rest/v1/pick_lists?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,notion_page_id`),
      supabaseAll(env, `/rest/v1/pick_items?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,notion_page_id`),
      supabaseAll(env, `/rest/v1/inbound_receipts?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,notion_page_id`),
    ]);
    const activeJobs = jobs.filter((row) => row.status !== 'completed');
    const byStatus = {};
    const byModule = {};
    for (const row of activeJobs) {
      const status = cleanText(row.status || 'pending') || 'pending';
      const module = cleanText(row.module || 'unknown') || 'unknown';
      byStatus[status] = Number(byStatus[status] || 0) + 1;
      byModule[module] = Number(byModule[module] || 0) + 1;
    }
    const oldest = activeJobs
      .map((row) => cleanText(row.created_at))
      .filter(Boolean)
      .sort()[0] || '';
    return respOK(cors, {
      ok: true,
      source: 'supabase',
      mirror_jobs: {
        active: activeJobs.length,
        pending: Number(byStatus.pending || 0) + Number(byStatus.retrying || 0),
        failed: Number(byStatus.failed || 0),
        by_status: byStatus,
        by_module: byModule,
        oldest_created_at: oldest,
      },
      missing_notion_mirrors: {
        stock_logs: stockLogs.filter((row) => !cleanText(row.notion_page_id)).length,
        pick_masters: pickMasters.filter((row) => !cleanText(row.notion_page_id)).length,
        pick_items: pickItems.filter((row) => !cleanText(row.notion_page_id)).length,
        inbound_receipts: inboundReceipts.filter((row) => !cleanText(row.notion_page_id)).length,
      },
      checked_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

function normalizeInboundStockStatus(value) {
  const status = cleanText(value || '待入庫');
  if (status === '已入庫') return '已入庫';
  if (status === '退回' || status === '退回倉管' || status === '退回供應商') return '退回';
  if (status === '未入庫') return '未入庫';
  return '待入庫';
}

function normalizeInboundQcStatus(value) {
  const status = cleanText(value || '待品檢');
  const allowed = new Set(['待品檢', '品檢通過', '品檢不合格', '退回倉管', '退回供應商']);
  return allowed.has(status) ? status : '待品檢';
}

function inboundReturnTarget(value, stockStatus = '') {
  const target = cleanText(value || '');
  if (target === '供應商' || cleanText(stockStatus).includes('供應商')) return '供應商';
  if (target === '倉管' || cleanText(stockStatus).includes('倉管')) return '倉管';
  return null;
}

function normalizeInboundRows(receipts, items, materials) {
  const materialById = new Map((Array.isArray(materials) ? materials : []).map((row) => [cleanText(row.id), row]));
  const grouped = new Map();
  for (const item of (Array.isArray(items) ? items : [])) {
    const key = cleanText(item.inbound_receipt_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return (Array.isArray(receipts) ? receipts : []).map((receipt) => {
    const receiptItems = grouped.get(cleanText(receipt.id)) || [];
    const item = receiptItems[0] || {};
    const material = materialById.get(cleanText(item.material_id)) || {};
    return {
      id: cleanText(receipt.id),
      inbound_number: cleanText(receipt.inbound_number),
      supplier_display: cleanText(receipt.supplier_display),
      received_date: cleanText(receipt.received_date),
      qc_status: cleanText(receipt.qc_status),
      stock_status: cleanText(receipt.stock_status),
      return_target: cleanText(receipt.return_target),
      return_reason_type: cleanText(receipt.return_reason_type),
      return_reason: cleanText(receipt.return_reason),
      notes: cleanText(receipt.notes),
      notion_page_id: cleanText(receipt.notion_page_id),
      resubmitted_at: cleanText(receipt.resubmitted_at),
      created_at: cleanText(receipt.created_at),
      updated_at: cleanText(receipt.updated_at),
      item: {
        id: cleanText(item.id),
        material_id: cleanText(item.material_id),
        material_notion_page_id: cleanText(material.notion_page_id),
        sku: cleanSku(material.sku),
        name: cleanText(material.name || material.sku),
        type: cleanText(material.material_type),
        quantity: Number(item.quantity || 0),
        accepted_quantity: item.accepted_quantity == null ? null : Number(item.accepted_quantity),
        rejected_quantity: item.rejected_quantity == null ? null : Number(item.rejected_quantity),
        inventory_transaction_id: cleanText(item.inventory_transaction_id),
        notion_page_id: cleanText(item.notion_page_id),
        notes: cleanText(item.notes),
      },
    };
  });
}

async function erpInboundList(request, env, cors) {
  try {
    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get('limit') || 5000);
    const limit = Math.max(1, Math.min(10000, Number.isFinite(requestedLimit) ? requestedLimit : 5000));
    const receiptPath = `/rest/v1/inbound_receipts?organization_id=eq.${encodeURIComponent(organizationId)}&archived_at=is.null&select=id,inbound_number,supplier_display,received_date,qc_status,stock_status,return_target,return_reason_type,return_reason,resubmitted_at,notes,notion_page_id,created_at,updated_at&order=received_date.desc,created_at.desc`;
    const receipts = limit <= 1000
      ? await supabaseFetch(env, `${receiptPath}&limit=${limit}`)
      : (await supabaseAll(env, receiptPath)).slice(0, limit);
    const receiptIds = (Array.isArray(receipts) ? receipts : []).map((row) => cleanText(row.id)).filter(Boolean);
    let items = [];
    if (receiptIds.length) {
      items = await supabaseAll(
        env,
        `/rest/v1/inbound_items?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,inbound_receipt_id,material_id,quantity,accepted_quantity,rejected_quantity,inventory_transaction_id,notes,notion_page_id,created_at,updated_at`
      );
      const wanted = new Set(receiptIds);
      items = items.filter((row) => wanted.has(cleanText(row.inbound_receipt_id)));
    }
    const materialIds = [...new Set(items.map((row) => cleanText(row.material_id)).filter(Boolean))];
    let materials = [];
    if (materialIds.length) {
      materials = await supabaseAll(
        env,
        `/rest/v1/materials?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,sku,name,material_type,notion_page_id`
      );
      const wanted = new Set(materialIds);
      materials = materials.filter((row) => wanted.has(cleanText(row.id)));
    }
    return respOK(cors, {
      ok: true,
      source: 'supabase',
      rows: normalizeInboundRows(receipts, items, materials),
      checked_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpInboundCreate(request, env, cors) {
  try {
    const body = await request.json();
    const inboundNumber = cleanText(body?.inbound_number);
    const quantity = Number(body?.quantity || 0);
    const sku = cleanSku(body?.sku || body?.code || '');
    const materialNotionPageId = cleanText(body?.material_notion_page_id);
    if (!inboundNumber) return resp400(cors, 'Missing inbound_number');
    if (!(quantity > 0)) return resp400(cors, 'Invalid inbound quantity');
    if (!sku && !materialNotionPageId) return resp400(cors, 'Missing inbound material');

    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const existing = await supabaseSingle(
      env,
      `/rest/v1/inbound_receipts?organization_id=eq.${encodeURIComponent(organizationId)}&inbound_number=eq.${encodeURIComponent(inboundNumber)}&select=id,inbound_number,qc_status,stock_status,notion_page_id&limit=1`,
      true
    );
    if (existing?.id) {
      const currentItems = await supabaseAll(
        env,
        `/rest/v1/inbound_items?inbound_receipt_id=eq.${encodeURIComponent(existing.id)}&select=id,inbound_receipt_id,material_id,quantity,accepted_quantity,rejected_quantity,inventory_transaction_id,notes,notion_page_id`
      );
      if (currentItems.length !== 1) {
        return new Response(JSON.stringify({
          error: `Inbound number ${inboundNumber} already exists with an invalid item count`,
        }), { status: 409, headers: jh(cors) });
      }
      const currentItem = currentItems[0];
      const currentMaterial = await supabaseSingle(
        env,
        `/rest/v1/materials?id=eq.${encodeURIComponent(currentItem.material_id)}&organization_id=eq.${encodeURIComponent(organizationId)}&select=id,sku,name,material_type,notion_page_id&limit=1`
      );
      const sameMaterial = (
        (materialNotionPageId && canonicalNotionId(currentMaterial?.notion_page_id) === canonicalNotionId(materialNotionPageId))
        || (sku && cleanSku(currentMaterial?.sku) === sku)
      );
      if (!sameMaterial || Number(currentItem.quantity) !== quantity) {
        return new Response(JSON.stringify({
          error: `Inbound number ${inboundNumber} already exists with different material or quantity`,
        }), { status: 409, headers: jh(cors) });
      }
      return respOK(cors, {
        ok: true,
        existing: true,
        row: normalizeInboundRows([existing], currentItems, [currentMaterial])[0],
      });
    }

    const material = await resolveSupabaseMaterial(
      env,
      organizationId,
      {
        notion_page_id: materialNotionPageId,
        name: cleanText(body?.material_name || sku),
        type: cleanText(body?.material_type || '零件'),
      },
      sku,
      false
    );
    if (!material?.id) throw new Error(`Material not found in Supabase: ${sku || materialNotionPageId}`);

    const receiptId = await deterministicUuid(`${organizationId}:inbound:${inboundNumber}`);
    const receiptRow = {
      id: receiptId,
      organization_id: organizationId,
      inbound_number: inboundNumber,
      supplier_display: cleanText(body?.supplier_display || '') || null,
      received_date: cleanText(body?.received_date || '').slice(0, 10) || taipeiISOString().slice(0, 10),
      qc_status: '待品檢',
      stock_status: '待入庫',
      notes: cleanText(body?.notes || ''),
      updated_at: taipeiISOString(),
    };
    const savedReceiptData = await supabaseFetch(
      env,
      '/rest/v1/inbound_receipts?on_conflict=id&select=id,inbound_number,supplier_display,received_date,qc_status,stock_status,return_target,return_reason_type,return_reason,resubmitted_at,notes,notion_page_id,created_at,updated_at',
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(receiptRow),
      }
    );
    const savedReceipt = Array.isArray(savedReceiptData) ? savedReceiptData[0] : savedReceiptData;
    if (!savedReceipt?.id) throw new Error(`Supabase inbound receipt write failed: ${inboundNumber}`);

    const itemId = await deterministicUuid(`${receiptId}:material:${material.id}`);
    const itemRow = {
      id: itemId,
      organization_id: organizationId,
      inbound_receipt_id: receiptId,
      material_id: material.id,
      quantity,
      notes: cleanText(body?.item_notes || ''),
      updated_at: taipeiISOString(),
    };
    let savedItemData;
    try {
      savedItemData = await supabaseFetch(
        env,
        '/rest/v1/inbound_items?on_conflict=id&select=id,inbound_receipt_id,material_id,quantity,accepted_quantity,rejected_quantity,inventory_transaction_id,notes,notion_page_id,created_at,updated_at',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(itemRow),
        }
      );
    } catch (itemError) {
      await supabaseFetch(
        env,
        `/rest/v1/inbound_receipts?id=eq.${encodeURIComponent(receiptId)}&notion_page_id=is.null`,
        { method: 'DELETE' }
      ).catch(() => null);
      throw itemError;
    }
    const savedItem = Array.isArray(savedItemData) ? savedItemData[0] : savedItemData;
    if (!savedItem?.id) throw new Error(`Supabase inbound item write failed: ${inboundNumber}`);
    return respOK(cors, {
      ok: true,
      existing: false,
      row: normalizeInboundRows([savedReceipt], [savedItem], [material])[0],
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpInboundAction(request, env, cors) {
  try {
    const body = await request.json();
    const inboundId = cleanText(body?.inbound_id);
    const action = cleanText(body?.action);
    if (!inboundId) return resp400(cors, 'Missing inbound_id');
    if (!['approve', 'reject', 'resubmit'].includes(action)) return resp400(cors, 'Invalid inbound action');

    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const receipt = await supabaseSingle(
      env,
      `/rest/v1/inbound_receipts?id=eq.${encodeURIComponent(inboundId)}&organization_id=eq.${encodeURIComponent(organizationId)}&select=id,inbound_number,qc_status,stock_status,notion_page_id,notes&limit=1`
    );
    const items = await supabaseAll(
      env,
      `/rest/v1/inbound_items?inbound_receipt_id=eq.${encodeURIComponent(inboundId)}&select=id,material_id,quantity,accepted_quantity,rejected_quantity,inventory_transaction_id,notion_page_id,notes`
    );
    if (items.length !== 1) throw new Error(`Inbound ${receipt.inbound_number} must have exactly one item`);
    let item = items[0];

    if (action === 'resubmit') {
      if (cleanText(item.inventory_transaction_id)) {
        return new Response(JSON.stringify({ error: 'Stocked inbound cannot be resubmitted' }), {
          status: 409,
          headers: jh(cors),
        });
      }
      const quantity = Number(body?.quantity || item.quantity || 0);
      const sku = cleanSku(body?.sku || body?.code || '');
      const materialNotionPageId = cleanText(body?.material_notion_page_id);
      if (!(quantity > 0)) return resp400(cors, 'Invalid inbound quantity');
      const material = await resolveSupabaseMaterial(
        env,
        organizationId,
        { notion_page_id: materialNotionPageId },
        sku,
        false
      );
      if (!material?.id) throw new Error(`Material not found in Supabase: ${sku || materialNotionPageId}`);
      const itemData = await supabaseFetch(
        env,
        `/rest/v1/inbound_items?id=eq.${encodeURIComponent(item.id)}&select=id,inbound_receipt_id,material_id,quantity,accepted_quantity,rejected_quantity,inventory_transaction_id,notes,notion_page_id`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            material_id: material.id,
            quantity,
            accepted_quantity: null,
            rejected_quantity: null,
            notes: cleanText(body?.notes || item.notes || ''),
            updated_at: taipeiISOString(),
          }),
        }
      );
      item = Array.isArray(itemData) ? itemData[0] : itemData;
      const receiptData = await supabaseFetch(
        env,
        `/rest/v1/inbound_receipts?id=eq.${encodeURIComponent(inboundId)}&select=id,inbound_number,supplier_display,received_date,qc_status,stock_status,return_target,return_reason_type,return_reason,resubmitted_at,notes,notion_page_id,created_at,updated_at`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            qc_status: '待品檢',
            stock_status: '待入庫',
            return_target: null,
            return_reason_type: null,
            return_reason: null,
            resubmitted_at: taipeiISOString(),
            notes: cleanText(body?.notes || receipt.notes || ''),
            updated_at: taipeiISOString(),
          }),
        }
      );
      const savedReceipt = Array.isArray(receiptData) ? receiptData[0] : receiptData;
      return respOK(cors, {
        ok: true,
        action,
        row: normalizeInboundRows([savedReceipt], [item], [material])[0],
      });
    }

    if (action === 'reject') {
      if (cleanText(item.inventory_transaction_id)) {
        return new Response(JSON.stringify({ error: 'Stocked inbound cannot be rejected' }), {
          status: 409,
          headers: jh(cors),
        });
      }
      const target = inboundReturnTarget(body?.return_target || '倉管') || '倉管';
      const reasonType = ['質量異常', '數量異常', '其他'].includes(cleanText(body?.reason_type))
        ? cleanText(body.reason_type)
        : '其他';
      const reason = cleanText(body?.reason || reasonType);
      const itemData = await supabaseFetch(
        env,
        `/rest/v1/inbound_items?id=eq.${encodeURIComponent(item.id)}&select=id,inbound_receipt_id,material_id,quantity,accepted_quantity,rejected_quantity,inventory_transaction_id,notes,notion_page_id`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            accepted_quantity: 0,
            rejected_quantity: Number(item.quantity || 0),
            updated_at: taipeiISOString(),
          }),
        }
      );
      item = Array.isArray(itemData) ? itemData[0] : itemData;
      const receiptData = await supabaseFetch(
        env,
        `/rest/v1/inbound_receipts?id=eq.${encodeURIComponent(inboundId)}&select=id,inbound_number,supplier_display,received_date,qc_status,stock_status,return_target,return_reason_type,return_reason,resubmitted_at,notes,notion_page_id,created_at,updated_at`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            qc_status: '品檢不合格',
            stock_status: '退回',
            return_target: target,
            return_reason_type: reasonType,
            return_reason: reason,
            notes: cleanText(body?.notes || receipt.notes || ''),
            updated_at: taipeiISOString(),
          }),
        }
      );
      const savedReceipt = Array.isArray(receiptData) ? receiptData[0] : receiptData;
      const material = await supabaseSingle(
        env,
        `/rest/v1/materials?id=eq.${encodeURIComponent(item.material_id)}&organization_id=eq.${encodeURIComponent(organizationId)}&select=id,sku,name,material_type,notion_page_id&limit=1`
      );
      return respOK(cors, {
        ok: true,
        action,
        row: normalizeInboundRows([savedReceipt], [item], [material])[0],
      });
    }

    const material = await supabaseSingle(
      env,
      `/rest/v1/materials?id=eq.${encodeURIComponent(item.material_id)}&organization_id=eq.${encodeURIComponent(organizationId)}&select=id,sku,name,material_type,notion_page_id&limit=1`
    );
    const quantity = Number(item.quantity || 0);
    if (!(quantity > 0)) throw new Error(`Invalid inbound quantity: ${receipt.inbound_number}`);
    const idempotencyKey = `inbound_qc_pass:${inboundId}`;
    let transaction = null;
    let duplicate = false;
    if (cleanText(item.inventory_transaction_id)) {
      transaction = await supabaseSingle(
        env,
        `/rest/v1/inventory_transactions?id=eq.${encodeURIComponent(item.inventory_transaction_id)}&select=id,quantity_before,quantity_after&limit=1`
      );
      duplicate = true;
    } else {
      const existingTx = await supabaseSingle(
        env,
        `/rest/v1/inventory_transactions?organization_id=eq.${encodeURIComponent(organizationId)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,quantity_before,quantity_after&limit=1`,
        true
      );
      const rpcData = await supabaseFetch(env, '/rest/v1/rpc/apply_inventory_transaction', {
        method: 'POST',
        body: JSON.stringify({
          p_organization_id: organizationId,
          p_warehouse_id: context.warehouse.id,
          p_material_id: material.id,
          p_transaction_type: inventoryTransactionType('inbound_qc_pass', quantity),
          p_quantity_delta: quantity,
          p_reason: cleanText(body?.reason || '入料品管通過入庫'),
          p_idempotency_key: idempotencyKey,
          p_source_type: 'inbound_qc_pass',
          p_source_id: inboundId,
          p_source_number: cleanText(receipt.inbound_number),
        }),
      });
      transaction = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!transaction?.id) throw new Error(`Supabase inbound inventory transaction failed: ${receipt.inbound_number}`);
      duplicate = Boolean(existingTx?.id);
    }
    const itemData = await supabaseFetch(
      env,
      `/rest/v1/inbound_items?id=eq.${encodeURIComponent(item.id)}&select=id,inbound_receipt_id,material_id,quantity,accepted_quantity,rejected_quantity,inventory_transaction_id,notes,notion_page_id`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          accepted_quantity: quantity,
          rejected_quantity: 0,
          inventory_transaction_id: transaction.id,
          updated_at: taipeiISOString(),
        }),
      }
    );
    item = Array.isArray(itemData) ? itemData[0] : itemData;
    const receiptData = await supabaseFetch(
      env,
      `/rest/v1/inbound_receipts?id=eq.${encodeURIComponent(inboundId)}&select=id,inbound_number,supplier_display,received_date,qc_status,stock_status,return_target,return_reason_type,return_reason,resubmitted_at,notes,notion_page_id,created_at,updated_at`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          qc_status: '品檢通過',
          stock_status: '已入庫',
          return_target: null,
          return_reason_type: null,
          return_reason: null,
          updated_at: taipeiISOString(),
        }),
      }
    );
    const savedReceipt = Array.isArray(receiptData) ? receiptData[0] : receiptData;
    return respOK(cors, {
      ok: true,
      action,
      duplicate,
      transaction_id: transaction.id,
      before_stock: Number(transaction.quantity_before),
      after_stock: Number(transaction.quantity_after),
      row: normalizeInboundRows([savedReceipt], [item], [material])[0],
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpInboundLinkNotion(request, env, cors) {
  try {
    const body = await request.json();
    const inboundId = cleanText(body?.inbound_id);
    const notionPageId = cleanText(body?.notion_page_id);
    if (!inboundId) return resp400(cors, 'Missing inbound_id');
    if (!notionPageId) return resp400(cors, 'Missing notion_page_id');
    const receiptData = await supabaseFetch(
      env,
      `/rest/v1/inbound_receipts?id=eq.${encodeURIComponent(inboundId)}&select=id,notion_page_id`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ notion_page_id: notionPageId, updated_at: taipeiISOString() }),
      }
    );
    const saved = Array.isArray(receiptData) ? receiptData[0] : receiptData;
    if (!saved?.id) throw new Error('Supabase inbound link failed');
    const itemId = cleanText(body?.item_id);
    if (itemId) {
      await supabaseFetch(
        env,
        `/rest/v1/inbound_items?id=eq.${encodeURIComponent(itemId)}&inbound_receipt_id=eq.${encodeURIComponent(inboundId)}&select=id`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ notion_page_id: notionPageId, updated_at: taipeiISOString() }),
        }
      );
    }
    return respOK(cors, { ok: true, row: saved });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpInboundSummary(request, env, cors) {
  try {
    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const receipts = await supabaseAll(
      env,
      `/rest/v1/inbound_receipts?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,inbound_number,qc_status,stock_status,notion_page_id`
    );
    const items = await supabaseAll(
      env,
      `/rest/v1/inbound_items?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,inbound_receipt_id,material_id,inventory_transaction_id,notion_page_id`
    );
    const statusCounts = {};
    for (const row of receipts) {
      const key = `${cleanText(row.qc_status) || '未設定'} / ${cleanText(row.stock_status) || '未設定'}`;
      statusCounts[key] = Number(statusCounts[key] || 0) + 1;
    }
    return respOK(cors, {
      ok: true,
      source: 'supabase',
      receipt_count: receipts.length,
      item_count: items.length,
      status_counts: statusCounts,
      missing_receipt_notion_ids: receipts.filter((row) => !cleanText(row.notion_page_id)).length,
      missing_item_material_links: items.filter((row) => !cleanText(row.material_id)).length,
      stocked_item_count: items.filter((row) => cleanText(row.inventory_transaction_id)).length,
      receipt_notion_ids: receipts.map((row) => cleanText(row.notion_page_id)).filter(Boolean),
      checked_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function erpInboundMigrate(request, env, cors) {
  try {
    if (!migrationAuthorized(request, env)) {
      return new Response(JSON.stringify({ error: 'Unauthorized inbound migration request' }), {
        status: 401,
        headers: jh(cors),
      });
    }
    const body = await request.json();
    const sourceRows = Array.isArray(body?.rows) ? body.rows : [];
    const dryRun = body?.dry_run !== false;
    if (!sourceRows.length) return resp400(cors, 'Missing inbound rows');
    if (sourceRows.length > 20000) return resp400(cors, 'Inbound migration exceeds the safety row limit');

    const context = await getSupabaseInventoryContext(env);
    const organizationId = context.organization.id;
    const [existingReceipts, existingItems, materials] = await Promise.all([
      supabaseAll(
        env,
        `/rest/v1/inbound_receipts?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,inbound_number,notion_page_id`
      ),
      supabaseAll(
        env,
        `/rest/v1/inbound_items?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,inbound_receipt_id,notion_page_id,inventory_transaction_id`
      ),
      supabaseAll(
        env,
        `/rest/v1/materials?organization_id=eq.${encodeURIComponent(organizationId)}&archived_at=is.null&select=id,sku,name,material_type,notion_page_id`
      ),
    ]);
    const materialByNotion = new Map(
      materials.filter((row) => canonicalNotionId(row.notion_page_id)).map((row) => [canonicalNotionId(row.notion_page_id), row])
    );
    const materialBySku = new Map(
      materials.filter((row) => cleanSku(row.sku)).map((row) => [cleanSku(row.sku), row])
    );
    const existingReceiptByNotion = new Map(
      existingReceipts.filter((row) => canonicalNotionId(row.notion_page_id)).map((row) => [canonicalNotionId(row.notion_page_id), row])
    );
    const existingItemByReceipt = new Map(existingItems.map((row) => [cleanText(row.inbound_receipt_id), row]));
    const normalized = [];
    for (const source of sourceRows) {
      const notionPageId = cleanText(source?.notion_page_id);
      const inboundNumber = cleanText(source?.inbound_number);
      const quantity = Number(source?.quantity || 0);
      if (!notionPageId || !inboundNumber || !(quantity > 0)) {
        throw new Error(`Invalid inbound source row: ${inboundNumber || notionPageId || 'unknown'}`);
      }
      const material = materialByNotion.get(canonicalNotionId(source?.material_notion_page_id))
        || materialBySku.get(cleanSku(source?.sku || source?.material_code || ''));
      const existingReceipt = existingReceiptByNotion.get(canonicalNotionId(notionPageId)) || null;
      const receiptId = cleanText(existingReceipt?.id) || await deterministicUuid(`${organizationId}:inbound:notion:${canonicalNotionId(notionPageId)}`);
      const existingItem = existingItemByReceipt.get(receiptId) || null;
      const materialId = cleanText(material?.id);
      const stockStatusSource = cleanText(source?.stock_status);
      const qcStatus = normalizeInboundQcStatus(source?.qc_status);
      normalized.push({
        receipt: {
          id: receiptId,
          organization_id: organizationId,
          inbound_number: inboundNumber,
          supplier_display: cleanText(source?.supplier_display || '') || null,
          received_date: cleanText(source?.received_date || '').slice(0, 10) || taipeiISOString().slice(0, 10),
          qc_status: qcStatus,
          stock_status: normalizeInboundStockStatus(stockStatusSource),
          return_target: inboundReturnTarget(source?.return_target, stockStatusSource),
          return_reason_type: ['質量異常', '數量異常', '其他'].includes(cleanText(source?.return_reason_type))
            ? cleanText(source.return_reason_type)
            : null,
          return_reason: cleanText(source?.return_reason || '') || null,
          notes: cleanText(source?.notes || ''),
          notion_page_id: notionPageId,
          updated_at: cleanText(source?.notion_last_edited_at) || taipeiISOString(),
        },
        item: {
          id: cleanText(existingItem?.id) || await deterministicUuid(`${receiptId}:material:${materialId || `unmapped:${canonicalNotionId(notionPageId)}`}`),
          organization_id: organizationId,
          inbound_receipt_id: receiptId,
          material_id: materialId || null,
          quantity,
          accepted_quantity: qcStatus === '品檢通過' ? quantity : (qcStatus === '品檢不合格' ? 0 : null),
          rejected_quantity: qcStatus === '品檢不合格' ? quantity : (qcStatus === '品檢通過' ? 0 : null),
          inventory_transaction_id: existingItem?.inventory_transaction_id || null,
          notes: cleanText(source?.item_notes || ''),
          notion_page_id: notionPageId,
          updated_at: cleanText(source?.notion_last_edited_at) || taipeiISOString(),
        },
      });
    }
    if (dryRun) {
      return respOK(cors, {
        ok: true,
        dry_run: true,
        source_count: sourceRows.length,
        receipt_count: normalized.length,
        item_count: normalized.length,
        unmapped_material_count: normalized.filter((row) => !row.item.material_id).length,
        existing_receipt_count: normalized.filter((row) => existingReceiptByNotion.has(canonicalNotionId(row.receipt.notion_page_id))).length,
      });
    }
    for (const chunk of chunkRows(normalized.map((row) => row.receipt))) {
      await supabaseFetch(
        env,
        '/rest/v1/inbound_receipts?on_conflict=id&select=id',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(chunk),
        }
      );
    }
    for (const chunk of chunkRows(normalized.map((row) => row.item))) {
      await supabaseFetch(
        env,
        '/rest/v1/inbound_items?on_conflict=id&select=id',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(chunk),
        }
      );
    }
    return respOK(cors, {
      ok: true,
      dry_run: false,
      source: 'notion_export',
      target: 'supabase',
      receipt_count: normalized.length,
      item_count: normalized.length,
      migrated_at: taipeiISOString(),
    });
  } catch (e) {
    return resp500(cors, e.message);
  }
}

async function supabaseFetch(env, path, options = {}) {
  const base = String(env.SUPABASE_URL || env.SUPABASE_REST_URL || '').replace(/\/+$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || '';
  if (!base || !serviceKey) throw new Error('Supabase sync env missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Worker');
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(`${base}${path}`, {...options, headers});
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error((data && data.message) || text || `Supabase HTTP ${res.status}`);
  }
  return data;
}

async function supabaseSingle(env, path, allowMissing = false) {
  const data = await supabaseFetch(env, path);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row && !allowMissing) throw new Error(`Supabase row not found: ${path}`);
  return row || null;
}

async function erpCorderNumberState(request, env, cors) {
  try {
    const context = await getSupabaseInventoryContext(env);
    const data = await supabaseFetch(env, '/rest/v1/rpc/get_corder_number_state', {
      method: 'POST',
      body: JSON.stringify({ p_organization_id: context.organization.id }),
    });
    const state = Array.isArray(data) ? data[0] : data;
    if (!state) throw new Error('C端起始單號尚未設定');
    return respOK(cors, state);
  } catch (error) {
    return resp500(cors, error?.message || String(error));
  }
}

async function erpCorderNumberReserve(request, env, cors) {
  try {
    const payload = await request.json();
    const count = Number(payload?.count);
    if (!Number.isInteger(count) || count < 1 || count > 5000) {
      return resp400(cors, '保留筆數必須是 1 到 5000 的整數');
    }
    const context = await getSupabaseInventoryContext(env);
    const data = await supabaseFetch(env, '/rest/v1/rpc/reserve_corder_numbers', {
      method: 'POST',
      body: JSON.stringify({
        p_organization_id: context.organization.id,
        p_count: count,
      }),
    });
    const range = Array.isArray(data) ? data[0] : data;
    if (!range) throw new Error('無法保留 C端訂單號碼');
    return respOK(cors, range);
  } catch (error) {
    return resp500(cors, error?.message || String(error));
  }
}

async function erpCorderNumberSet(request, env, cors) {
  try {
    const payload = await request.json();
    const nextNumber = Number(payload?.next_number);
    const role = cleanText(payload?.role || '');
    if (!['vic', 'manager', 'sales'].includes(role)) {
      return resp400(cors, '只有 Vic、廠長或業務可調整下一張單號');
    }
    if (!Number.isInteger(nextNumber) || nextNumber < 16279 || nextNumber > 999999) {
      return resp400(cors, '下一張單號必須是 16279 到 999999 的整數');
    }
    const context = await getSupabaseInventoryContext(env);
    const data = await supabaseFetch(env, '/rest/v1/rpc/set_corder_next_number', {
      method: 'POST',
      body: JSON.stringify({
        p_organization_id: context.organization.id,
        p_next_number: nextNumber,
      }),
    });
    const state = Array.isArray(data) ? data[0] : data;
    if (!state) throw new Error('無法更新 C端起始單號');
    return respOK(cors, state);
  } catch (error) {
    return resp500(cors, error?.message || String(error));
  }
}

async function getSupabaseInventoryContext(env) {
  const envOrganizationId = cleanText(env.SUPABASE_ORGANIZATION_ID || env.SUPABASE_ORG_ID || '');
  const envWarehouseId = cleanText(env.SUPABASE_WAREHOUSE_ID || '');
  if (envOrganizationId && envWarehouseId) {
    return { organization: { id: envOrganizationId }, warehouse: { id: envWarehouseId } };
  }

  let warehouse = null;
  if (envWarehouseId) {
    warehouse = await supabaseSingle(env, `/rest/v1/warehouses?id=eq.${encodeURIComponent(envWarehouseId)}&select=id,organization_id,code&limit=1`, true);
  }
  if (!warehouse && envOrganizationId) {
    warehouse = await supabaseSingle(env, `/rest/v1/warehouses?organization_id=eq.${encodeURIComponent(envOrganizationId)}&code=eq.MAIN&select=id,organization_id,code&limit=1`, true);
  }
  if (!warehouse) {
    warehouse = await supabaseSingle(env, '/rest/v1/warehouses?code=eq.MAIN&select=id,organization_id,code&limit=1', true);
  }

  let organizationId = cleanText(envOrganizationId || warehouse?.organization_id || '');
  if (!organizationId) {
    const sampleMaterial = await supabaseSingle(env, '/rest/v1/materials?select=organization_id&limit=1', true);
    organizationId = cleanText(sampleMaterial?.organization_id || '');
  }
  if (!organizationId) {
    const organization = await supabaseSingle(env, '/rest/v1/organizations?slug=eq.lematec&select=id&limit=1', true);
    organizationId = cleanText(organization?.id || '');
  }
  if (!organizationId) throw new Error('Supabase organization id not found. Set SUPABASE_ORGANIZATION_ID on Worker.');
  if (!warehouse?.id) throw new Error('Supabase MAIN warehouse not found. Set SUPABASE_WAREHOUSE_ID on Worker.');
  const organization = { id: organizationId };
  return { organization, warehouse };
}

async function resolveSupabaseMaterial(env, organizationId, payload, sku, createIfMissing = true) {
  let material = null;
  if (payload.notion_page_id) {
    material = await supabaseSingle(env, `/rest/v1/materials?notion_page_id=eq.${encodeURIComponent(payload.notion_page_id)}&select=id,sku,name,material_type,notion_page_id,organization_id&limit=1`, true);
  }
  if (!material) {
    const organizationFilter = organizationId ? `organization_id=eq.${encodeURIComponent(organizationId)}&` : '';
    material = await supabaseSingle(env, `/rest/v1/materials?${organizationFilter}sku=eq.${encodeURIComponent(sku)}&select=id,sku,name,material_type,notion_page_id,organization_id&limit=1`, true);
  }
  if (!material && createIfMissing) {
    material = await upsertSupabaseMaterial(env, organizationId, null, {...payload, sku});
  }
  return material;
}

async function getSupabaseBalance(env, organizationId, warehouseId, materialId) {
  return supabaseSingle(
    env,
    `/rest/v1/inventory_balances?organization_id=eq.${organizationId}&warehouse_id=eq.${warehouseId}&material_id=eq.${materialId}&select=id,quantity&limit=1`,
    true
  );
}

async function upsertSupabaseMaterial(env, organizationId, existing, payload) {
  const sku = cleanSku(payload.sku || payload.code || payload.name || '');
  const row = {
    organization_id: organizationId,
    sku,
    name: cleanText(payload.name || sku),
    material_type: normalizeMaterialType(payload.type || payload.material_type),
    unit: cleanText(payload.unit || '個'),
    safety_stock: Number(payload.safe ?? payload.safety_stock ?? 0) || 0,
    status: '啟用',
    notes: cleanText(payload.note || payload.notes || ''),
    archived_at: null,
  };
  if (payload.notion_page_id) row.notion_page_id = cleanText(payload.notion_page_id);

  if (existing?.id) {
    const data = await supabaseFetch(env, `/rest/v1/materials?id=eq.${existing.id}&select=id,sku,name,material_type,notion_page_id`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    return Array.isArray(data) ? data[0] : data;
  }

  const data = await supabaseFetch(env, '/rest/v1/materials?select=id,sku,name,material_type,notion_page_id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  return Array.isArray(data) ? data[0] : data;
}

async function upsertSupabaseBalance(env, organizationId, warehouseId, materialId, quantity) {
  const data = await supabaseFetch(env, '/rest/v1/inventory_balances?on_conflict=organization_id,warehouse_id,material_id&select=id,quantity', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      organization_id: organizationId,
      warehouse_id: warehouseId,
      material_id: materialId,
      quantity,
    }),
  });
  return Array.isArray(data) ? data[0] : data;
}

async function compareAndSwapSupabaseBalance(env, {
  organizationId,
  warehouseId,
  materialId,
  sku,
  delta,
  requestedStock,
  allowNegative = false,
}) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let balance = await getSupabaseBalance(env, organizationId, warehouseId, materialId);
    if (!balance?.id) {
      await upsertSupabaseBalance(env, organizationId, warehouseId, materialId, 0);
      balance = await getSupabaseBalance(env, organizationId, warehouseId, materialId);
    }
    if (!balance?.id) throw new Error(`Supabase inventory balance unavailable: ${sku}`);

    const beforeStock = Number(balance.quantity || 0);
    const afterStock = Number.isFinite(delta) ? beforeStock + delta : requestedStock;
    if (!Number.isFinite(afterStock)) throw new Error(`Invalid inventory result for ${sku}`);
    if (afterStock < 0 && !allowNegative) {
      throw new Error(`Insufficient inventory for ${sku}: ${beforeStock} + (${Number.isFinite(delta) ? delta : afterStock - beforeStock}) would become ${afterStock}`);
    }

    const data = await supabaseFetch(
      env,
      `/rest/v1/inventory_balances?id=eq.${encodeURIComponent(balance.id)}&quantity=eq.${encodeURIComponent(String(balance.quantity))}&select=id,quantity`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ quantity: afterStock }),
      }
    );
    const saved = Array.isArray(data) ? data[0] : data;
    if (saved?.id) return { beforeStock, afterStock: Number(saved.quantity) };
  }
  throw new Error(`Inventory changed concurrently for ${sku}; retry the operation`);
}

function cleanText(value) {
  return String(value ?? '').trim();
}
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value));
}
function inventoryTransactionType(sourceType, delta) {
  const type = cleanText(sourceType).toLowerCase();
  if (type.includes('corder_ship')) return 'C端出貨';
  if (type.includes('order_pick') || type.includes('manual_pick') || type.includes('bom_deduct')) return '領料扣除';
  if (type.includes('shopee_order_complete') || type.includes('sfg_qc_pass') || type.includes('sfg_inspection')) return '生產完成';
  if (type.includes('inbound') || type.includes('qc_stock_in')) return Number(delta) >= 0 ? '入料入庫' : '取消回料';
  if (type.includes('return') || type.includes('compensation') || type.includes('rollback')) return '取消回料';
  if (type.includes('merge')) return '合併料號';
  if (type.includes('manual')) return '手動調整';
  return '其他';
}

function cleanDate(value) {
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : taipeiISOString().slice(0, 10);
}

function cleanSku(value) {
  return cleanText(value).replace(/\s+/g, '').toUpperCase();
}

function normalizeMaterialType(value) {
  const text = cleanText(value);
  if (text.includes('蝦皮') || /^S-/i.test(text)) return '蝦皮用';
  if (text.includes('半')) return '半成品';
  if (text.includes('成')) return '成品';
  if (text.includes('零') || text.includes('料')) return '零件';
  return '零件';
}

function u8b64(u8){ let s=''; for(let i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return btoa(s); }
function r32(b,o){ return (b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24)>>>0; }
function r16(b,o){ return b[o]|b[o+1]<<8; }

// ── AES-JS (embedded, ECB support) ──
const aesjs = (function() {

    "use strict";

    function checkInt(value) {
        return (parseInt(value) === value);
    }

    function checkInts(arrayish) {
        if (!checkInt(arrayish.length)) { return false; }

        for (var i = 0; i < arrayish.length; i++) {
            if (!checkInt(arrayish[i]) || arrayish[i] < 0 || arrayish[i] > 255) {
                return false;
            }
        }

        return true;
    }

    function coerceArray(arg, copy) {

        // ArrayBuffer view
        if (arg.buffer && arg.name === 'Uint8Array') {

            if (copy) {
                if (arg.slice) {
                    arg = arg.slice();
                } else {
                    arg = Array.prototype.slice.call(arg);
                }
            }

            return arg;
        }

        // It's an array; check it is a valid representation of a byte
        if (Array.isArray(arg)) {
            if (!checkInts(arg)) {
                throw new Error('Array contains invalid value: ' + arg);
            }

            return new Uint8Array(arg);
        }

        // Something else, but behaves like an array (maybe a Buffer? Arguments?)
        if (checkInt(arg.length) && checkInts(arg)) {
            return new Uint8Array(arg);
        }

        throw new Error('unsupported array-like object');
    }

    function createArray(length) {
        return new Uint8Array(length);
    }

    function copyArray(sourceArray, targetArray, targetStart, sourceStart, sourceEnd) {
        if (sourceStart != null || sourceEnd != null) {
            if (sourceArray.slice) {
                sourceArray = sourceArray.slice(sourceStart, sourceEnd);
            } else {
                sourceArray = Array.prototype.slice.call(sourceArray, sourceStart, sourceEnd);
            }
        }
        targetArray.set(sourceArray, targetStart);
    }



    var convertUtf8 = (function() {
        function toBytes(text) {
            var result = [], i = 0;
            text = encodeURI(text);
            while (i < text.length) {
                var c = text.charCodeAt(i++);

                // if it is a % sign, encode the following 2 bytes as a hex value
                if (c === 37) {
                    result.push(parseInt(text.substr(i, 2), 16))
                    i += 2;

                // otherwise, just the actual byte
                } else {
                    result.push(c)
                }
            }

            return coerceArray(result);
        }

        function fromBytes(bytes) {
            var result = [], i = 0;

            while (i < bytes.length) {
                var c = bytes[i];

                if (c < 128) {
                    result.push(String.fromCharCode(c));
                    i++;
                } else if (c > 191 && c < 224) {
                    result.push(String.fromCharCode(((c & 0x1f) << 6) | (bytes[i + 1] & 0x3f)));
                    i += 2;
                } else {
                    result.push(String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)));
                    i += 3;
                }
            }

            return result.join('');
        }

        return {
            toBytes: toBytes,
            fromBytes: fromBytes,
        }
    })();

    var convertHex = (function() {
        function toBytes(text) {
            var result = [];
            for (var i = 0; i < text.length; i += 2) {
                result.push(parseInt(text.substr(i, 2), 16));
            }

            return result;
        }

        // http://ixti.net/development/javascript/2011/11/11/base64-encodedecode-of-utf8-in-browser-with-js.html
        var Hex = '0123456789abcdef';

        function fromBytes(bytes) {
                var result = [];
                for (var i = 0; i < bytes.length; i++) {
                    var v = bytes[i];
                    result.push(Hex[(v & 0xf0) >> 4] + Hex[v & 0x0f]);
                }
                return result.join('');
        }

        return {
            toBytes: toBytes,
            fromBytes: fromBytes,
        }
    })();


    // Number of rounds by keysize
    var numberOfRounds = {16: 10, 24: 12, 32: 14}

    // Round constant words
    var rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d, 0x9a, 0x2f, 0x5e, 0xbc, 0x63, 0xc6, 0x97, 0x35, 0x6a, 0xd4, 0xb3, 0x7d, 0xfa, 0xef, 0xc5, 0x91];

    // S-box and Inverse S-box (S is for Substitution)
    var S = [0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0, 0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15, 0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75, 0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84, 0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf, 0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8, 0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2, 0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73, 0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb, 0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79, 0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08, 0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a, 0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e, 0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf, 0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16];
    var Si =[0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb, 0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb, 0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e, 0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25, 0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92, 0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84, 0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06, 0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b, 0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73, 0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e, 0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b, 0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4, 0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f, 0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef, 0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61, 0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d];

    // Transformations for encryption
    var T1 = [0xc66363a5, 0xf87c7c84, 0xee777799, 0xf67b7b8d, 0xfff2f20d, 0xd66b6bbd, 0xde6f6fb1, 0x91c5c554, 0x60303050, 0x02010103, 0xce6767a9, 0x562b2b7d, 0xe7fefe19, 0xb5d7d762, 0x4dababe6, 0xec76769a, 0x8fcaca45, 0x1f82829d, 0x89c9c940, 0xfa7d7d87, 0xeffafa15, 0xb25959eb, 0x8e4747c9, 0xfbf0f00b, 0x41adadec, 0xb3d4d467, 0x5fa2a2fd, 0x45afafea, 0x239c9cbf, 0x53a4a4f7, 0xe4727296, 0x9bc0c05b, 0x75b7b7c2, 0xe1fdfd1c, 0x3d9393ae, 0x4c26266a, 0x6c36365a, 0x7e3f3f41, 0xf5f7f702, 0x83cccc4f, 0x6834345c, 0x51a5a5f4, 0xd1e5e534, 0xf9f1f108, 0xe2717193, 0xabd8d873, 0x62313153, 0x2a15153f, 0x0804040c, 0x95c7c752, 0x46232365, 0x9dc3c35e, 0x30181828, 0x379696a1, 0x0a05050f, 0x2f9a9ab5, 0x0e070709, 0x24121236, 0x1b80809b, 0xdfe2e23d, 0xcdebeb26, 0x4e272769, 0x7fb2b2cd, 0xea75759f, 0x1209091b, 0x1d83839e, 0x582c2c74, 0x341a1a2e, 0x361b1b2d, 0xdc6e6eb2, 0xb45a5aee, 0x5ba0a0fb, 0xa45252f6, 0x763b3b4d, 0xb7d6d661, 0x7db3b3ce, 0x5229297b, 0xdde3e33e, 0x5e2f2f71, 0x13848497, 0xa65353f5, 0xb9d1d168, 0x00000000, 0xc1eded2c, 0x40202060, 0xe3fcfc1f, 0x79b1b1c8, 0xb65b5bed, 0xd46a6abe, 0x8dcbcb46, 0x67bebed9, 0x7239394b, 0x944a4ade, 0x984c4cd4, 0xb05858e8, 0x85cfcf4a, 0xbbd0d06b, 0xc5efef2a, 0x4faaaae5, 0xedfbfb16, 0x864343c5, 0x9a4d4dd7, 0x66333355, 0x11858594, 0x8a4545cf, 0xe9f9f910, 0x04020206, 0xfe7f7f81, 0xa05050f0, 0x783c3c44, 0x259f9fba, 0x4ba8a8e3, 0xa25151f3, 0x5da3a3fe, 0x804040c0, 0x058f8f8a, 0x3f9292ad, 0x219d9dbc, 0x70383848, 0xf1f5f504, 0x63bcbcdf, 0x77b6b6c1, 0xafdada75, 0x42212163, 0x20101030, 0xe5ffff1a, 0xfdf3f30e, 0xbfd2d26d, 0x81cdcd4c, 0x180c0c14, 0x26131335, 0xc3ecec2f, 0xbe5f5fe1, 0x359797a2, 0x884444cc, 0x2e171739, 0x93c4c457, 0x55a7a7f2, 0xfc7e7e82, 0x7a3d3d47, 0xc86464ac, 0xba5d5de7, 0x3219192b, 0xe6737395, 0xc06060a0, 0x19818198, 0x9e4f4fd1, 0xa3dcdc7f, 0x44222266, 0x542a2a7e, 0x3b9090ab, 0x0b888883, 0x8c4646ca, 0xc7eeee29, 0x6bb8b8d3, 0x2814143c, 0xa7dede79, 0xbc5e5ee2, 0x160b0b1d, 0xaddbdb76, 0xdbe0e03b, 0x64323256, 0x743a3a4e, 0x140a0a1e, 0x924949db, 0x0c06060a, 0x4824246c, 0xb85c5ce4, 0x9fc2c25d, 0xbdd3d36e, 0x43acacef, 0xc46262a6, 0x399191a8, 0x319595a4, 0xd3e4e437, 0xf279798b, 0xd5e7e732, 0x8bc8c843, 0x6e373759, 0xda6d6db7, 0x018d8d8c, 0xb1d5d564, 0x9c4e4ed2, 0x49a9a9e0, 0xd86c6cb4, 0xac5656fa, 0xf3f4f407, 0xcfeaea25, 0xca6565af, 0xf47a7a8e, 0x47aeaee9, 0x10080818, 0x6fbabad5, 0xf0787888, 0x4a25256f, 0x5c2e2e72, 0x381c1c24, 0x57a6a6f1, 0x73b4b4c7, 0x97c6c651, 0xcbe8e823, 0xa1dddd7c, 0xe874749c, 0x3e1f1f21, 0x964b4bdd, 0x61bdbddc, 0x0d8b8b86, 0x0f8a8a85, 0xe0707090, 0x7c3e3e42, 0x71b5b5c4, 0xcc6666aa, 0x904848d8, 0x06030305, 0xf7f6f601, 0x1c0e0e12, 0xc26161a3, 0x6a35355f, 0xae5757f9, 0x69b9b9d0, 0x17868691, 0x99c1c158, 0x3a1d1d27, 0x279e9eb9, 0xd9e1e138, 0xebf8f813, 0x2b9898b3, 0x22111133, 0xd26969bb, 0xa9d9d970, 0x078e8e89, 0x339494a7, 0x2d9b9bb6, 0x3c1e1e22, 0x15878792, 0xc9e9e920, 0x87cece49, 0xaa5555ff, 0x50282878, 0xa5dfdf7a, 0x038c8c8f, 0x59a1a1f8, 0x09898980, 0x1a0d0d17, 0x65bfbfda, 0xd7e6e631, 0x844242c6, 0xd06868b8, 0x824141c3, 0x299999b0, 0x5a2d2d77, 0x1e0f0f11, 0x7bb0b0cb, 0xa85454fc, 0x6dbbbbd6, 0x2c16163a];
    var T2 = [0xa5c66363, 0x84f87c7c, 0x99ee7777, 0x8df67b7b, 0x0dfff2f2, 0xbdd66b6b, 0xb1de6f6f, 0x5491c5c5, 0x50603030, 0x03020101, 0xa9ce6767, 0x7d562b2b, 0x19e7fefe, 0x62b5d7d7, 0xe64dabab, 0x9aec7676, 0x458fcaca, 0x9d1f8282, 0x4089c9c9, 0x87fa7d7d, 0x15effafa, 0xebb25959, 0xc98e4747, 0x0bfbf0f0, 0xec41adad, 0x67b3d4d4, 0xfd5fa2a2, 0xea45afaf, 0xbf239c9c, 0xf753a4a4, 0x96e47272, 0x5b9bc0c0, 0xc275b7b7, 0x1ce1fdfd, 0xae3d9393, 0x6a4c2626, 0x5a6c3636, 0x417e3f3f, 0x02f5f7f7, 0x4f83cccc, 0x5c683434, 0xf451a5a5, 0x34d1e5e5, 0x08f9f1f1, 0x93e27171, 0x73abd8d8, 0x53623131, 0x3f2a1515, 0x0c080404, 0x5295c7c7, 0x65462323, 0x5e9dc3c3, 0x28301818, 0xa1379696, 0x0f0a0505, 0xb52f9a9a, 0x090e0707, 0x36241212, 0x9b1b8080, 0x3ddfe2e2, 0x26cdebeb, 0x694e2727, 0xcd7fb2b2, 0x9fea7575, 0x1b120909, 0x9e1d8383, 0x74582c2c, 0x2e341a1a, 0x2d361b1b, 0xb2dc6e6e, 0xeeb45a5a, 0xfb5ba0a0, 0xf6a45252, 0x4d763b3b, 0x61b7d6d6, 0xce7db3b3, 0x7b522929, 0x3edde3e3, 0x715e2f2f, 0x97138484, 0xf5a65353, 0x68b9d1d1, 0x00000000, 0x2cc1eded, 0x60402020, 0x1fe3fcfc, 0xc879b1b1, 0xedb65b5b, 0xbed46a6a, 0x468dcbcb, 0xd967bebe, 0x4b723939, 0xde944a4a, 0xd4984c4c, 0xe8b05858, 0x4a85cfcf, 0x6bbbd0d0, 0x2ac5efef, 0xe54faaaa, 0x16edfbfb, 0xc5864343, 0xd79a4d4d, 0x55663333, 0x94118585, 0xcf8a4545, 0x10e9f9f9, 0x06040202, 0x81fe7f7f, 0xf0a05050, 0x44783c3c, 0xba259f9f, 0xe34ba8a8, 0xf3a25151, 0xfe5da3a3, 0xc0804040, 0x8a058f8f, 0xad3f9292, 0xbc219d9d, 0x48703838, 0x04f1f5f5, 0xdf63bcbc, 0xc177b6b6, 0x75afdada, 0x63422121, 0x30201010, 0x1ae5ffff, 0x0efdf3f3, 0x6dbfd2d2, 0x4c81cdcd, 0x14180c0c, 0x35261313, 0x2fc3ecec, 0xe1be5f5f, 0xa2359797, 0xcc884444, 0x392e1717, 0x5793c4c4, 0xf255a7a7, 0x82fc7e7e, 0x477a3d3d, 0xacc86464, 0xe7ba5d5d, 0x2b321919, 0x95e67373, 0xa0c06060, 0x98198181, 0xd19e4f4f, 0x7fa3dcdc, 0x66442222, 0x7e542a2a, 0xab3b9090, 0x830b8888, 0xca8c4646, 0x29c7eeee, 0xd36bb8b8, 0x3c281414, 0x79a7dede, 0xe2bc5e5e, 0x1d160b0b, 0x76addbdb, 0x3bdbe0e0, 0x56643232, 0x4e743a3a, 0x1e140a0a, 0xdb924949, 0x0a0c0606, 0x6c482424, 0xe4b85c5c, 0x5d9fc2c2, 0x6ebdd3d3, 0xef43acac, 0xa6c46262, 0xa8399191, 0xa4319595, 0x37d3e4e4, 0x8bf27979, 0x32d5e7e7, 0x438bc8c8, 0x596e3737, 0xb7da6d6d, 0x8c018d8d, 0x64b1d5d5, 0xd29c4e4e, 0xe049a9a9, 0xb4d86c6c, 0xfaac5656, 0x07f3f4f4, 0x25cfeaea, 0xafca6565, 0x8ef47a7a, 0xe947aeae, 0x18100808, 0xd56fbaba, 0x88f07878, 0x6f4a2525, 0x725c2e2e, 0x24381c1c, 0xf157a6a6, 0xc773b4b4, 0x5197c6c6, 0x23cbe8e8, 0x7ca1dddd, 0x9ce87474, 0x213e1f1f, 0xdd964b4b, 0xdc61bdbd, 0x860d8b8b, 0x850f8a8a, 0x90e07070, 0x427c3e3e, 0xc471b5b5, 0xaacc6666, 0xd8904848, 0x05060303, 0x01f7f6f6, 0x121c0e0e, 0xa3c26161, 0x5f6a3535, 0xf9ae5757, 0xd069b9b9, 0x91178686, 0x5899c1c1, 0x273a1d1d, 0xb9279e9e, 0x38d9e1e1, 0x13ebf8f8, 0xb32b9898, 0x33221111, 0xbbd26969, 0x70a9d9d9, 0x89078e8e, 0xa7339494, 0xb62d9b9b, 0x223c1e1e, 0x92158787, 0x20c9e9e9, 0x4987cece, 0xffaa5555, 0x78502828, 0x7aa5dfdf, 0x8f038c8c, 0xf859a1a1, 0x80098989, 0x171a0d0d, 0xda65bfbf, 0x31d7e6e6, 0xc6844242, 0xb8d06868, 0xc3824141, 0xb0299999, 0x775a2d2d, 0x111e0f0f, 0xcb7bb0b0, 0xfca85454, 0xd66dbbbb, 0x3a2c1616];
    var T3 = [0x63a5c663, 0x7c84f87c, 0x7799ee77, 0x7b8df67b, 0xf20dfff2, 0x6bbdd66b, 0x6fb1de6f, 0xc55491c5, 0x30506030, 0x01030201, 0x67a9ce67, 0x2b7d562b, 0xfe19e7fe, 0xd762b5d7, 0xabe64dab, 0x769aec76, 0xca458fca, 0x829d1f82, 0xc94089c9, 0x7d87fa7d, 0xfa15effa, 0x59ebb259, 0x47c98e47, 0xf00bfbf0, 0xadec41ad, 0xd467b3d4, 0xa2fd5fa2, 0xafea45af, 0x9cbf239c, 0xa4f753a4, 0x7296e472, 0xc05b9bc0, 0xb7c275b7, 0xfd1ce1fd, 0x93ae3d93, 0x266a4c26, 0x365a6c36, 0x3f417e3f, 0xf702f5f7, 0xcc4f83cc, 0x345c6834, 0xa5f451a5, 0xe534d1e5, 0xf108f9f1, 0x7193e271, 0xd873abd8, 0x31536231, 0x153f2a15, 0x040c0804, 0xc75295c7, 0x23654623, 0xc35e9dc3, 0x18283018, 0x96a13796, 0x050f0a05, 0x9ab52f9a, 0x07090e07, 0x12362412, 0x809b1b80, 0xe23ddfe2, 0xeb26cdeb, 0x27694e27, 0xb2cd7fb2, 0x759fea75, 0x091b1209, 0x839e1d83, 0x2c74582c, 0x1a2e341a, 0x1b2d361b, 0x6eb2dc6e, 0x5aeeb45a, 0xa0fb5ba0, 0x52f6a452, 0x3b4d763b, 0xd661b7d6, 0xb3ce7db3, 0x297b5229, 0xe33edde3, 0x2f715e2f, 0x84971384, 0x53f5a653, 0xd168b9d1, 0x00000000, 0xed2cc1ed, 0x20604020, 0xfc1fe3fc, 0xb1c879b1, 0x5bedb65b, 0x6abed46a, 0xcb468dcb, 0xbed967be, 0x394b7239, 0x4ade944a, 0x4cd4984c, 0x58e8b058, 0xcf4a85cf, 0xd06bbbd0, 0xef2ac5ef, 0xaae54faa, 0xfb16edfb, 0x43c58643, 0x4dd79a4d, 0x33556633, 0x85941185, 0x45cf8a45, 0xf910e9f9, 0x02060402, 0x7f81fe7f, 0x50f0a050, 0x3c44783c, 0x9fba259f, 0xa8e34ba8, 0x51f3a251, 0xa3fe5da3, 0x40c08040, 0x8f8a058f, 0x92ad3f92, 0x9dbc219d, 0x38487038, 0xf504f1f5, 0xbcdf63bc, 0xb6c177b6, 0xda75afda, 0x21634221, 0x10302010, 0xff1ae5ff, 0xf30efdf3, 0xd26dbfd2, 0xcd4c81cd, 0x0c14180c, 0x13352613, 0xec2fc3ec, 0x5fe1be5f, 0x97a23597, 0x44cc8844, 0x17392e17, 0xc45793c4, 0xa7f255a7, 0x7e82fc7e, 0x3d477a3d, 0x64acc864, 0x5de7ba5d, 0x192b3219, 0x7395e673, 0x60a0c060, 0x81981981, 0x4fd19e4f, 0xdc7fa3dc, 0x22664422, 0x2a7e542a, 0x90ab3b90, 0x88830b88, 0x46ca8c46, 0xee29c7ee, 0xb8d36bb8, 0x143c2814, 0xde79a7de, 0x5ee2bc5e, 0x0b1d160b, 0xdb76addb, 0xe03bdbe0, 0x32566432, 0x3a4e743a, 0x0a1e140a, 0x49db9249, 0x060a0c06, 0x246c4824, 0x5ce4b85c, 0xc25d9fc2, 0xd36ebdd3, 0xacef43ac, 0x62a6c462, 0x91a83991, 0x95a43195, 0xe437d3e4, 0x798bf279, 0xe732d5e7, 0xc8438bc8, 0x37596e37, 0x6db7da6d, 0x8d8c018d, 0xd564b1d5, 0x4ed29c4e, 0xa9e049a9, 0x6cb4d86c, 0x56faac56, 0xf407f3f4, 0xea25cfea, 0x65afca65, 0x7a8ef47a, 0xaee947ae, 0x08181008, 0xbad56fba, 0x7888f078, 0x256f4a25, 0x2e725c2e, 0x1c24381c, 0xa6f157a6, 0xb4c773b4, 0xc65197c6, 0xe823cbe8, 0xdd7ca1dd, 0x749ce874, 0x1f213e1f, 0x4bdd964b, 0xbddc61bd, 0x8b860d8b, 0x8a850f8a, 0x7090e070, 0x3e427c3e, 0xb5c471b5, 0x66aacc66, 0x48d89048, 0x03050603, 0xf601f7f6, 0x0e121c0e, 0x61a3c261, 0x355f6a35, 0x57f9ae57, 0xb9d069b9, 0x86911786, 0xc15899c1, 0x1d273a1d, 0x9eb9279e, 0xe138d9e1, 0xf813ebf8, 0x98b32b98, 0x11332211, 0x69bbd269, 0xd970a9d9, 0x8e89078e, 0x94a73394, 0x9bb62d9b, 0x1e223c1e, 0x87921587, 0xe920c9e9, 0xce4987ce, 0x55ffaa55, 0x28785028, 0xdf7aa5df, 0x8c8f038c, 0xa1f859a1, 0x89800989, 0x0d171a0d, 0xbfda65bf, 0xe631d7e6, 0x42c68442, 0x68b8d068, 0x41c38241, 0x99b02999, 0x2d775a2d, 0x0f111e0f, 0xb0cb7bb0, 0x54fca854, 0xbbd66dbb, 0x163a2c16];
    var T4 = [0x6363a5c6, 0x7c7c84f8, 0x777799ee, 0x7b7b8df6, 0xf2f20dff, 0x6b6bbdd6, 0x6f6fb1de, 0xc5c55491, 0x30305060, 0x01010302, 0x6767a9ce, 0x2b2b7d56, 0xfefe19e7, 0xd7d762b5, 0xababe64d, 0x76769aec, 0xcaca458f, 0x82829d1f, 0xc9c94089, 0x7d7d87fa, 0xfafa15ef, 0x5959ebb2, 0x4747c98e, 0xf0f00bfb, 0xadadec41, 0xd4d467b3, 0xa2a2fd5f, 0xafafea45, 0x9c9cbf23, 0xa4a4f753, 0x727296e4, 0xc0c05b9b, 0xb7b7c275, 0xfdfd1ce1, 0x9393ae3d, 0x26266a4c, 0x36365a6c, 0x3f3f417e, 0xf7f702f5, 0xcccc4f83, 0x34345c68, 0xa5a5f451, 0xe5e534d1, 0xf1f108f9, 0x717193e2, 0xd8d873ab, 0x31315362, 0x15153f2a, 0x04040c08, 0xc7c75295, 0x23236546, 0xc3c35e9d, 0x18182830, 0x9696a137, 0x05050f0a, 0x9a9ab52f, 0x0707090e, 0x12123624, 0x80809b1b, 0xe2e23ddf, 0xebeb26cd, 0x2727694e, 0xb2b2cd7f, 0x75759fea, 0x09091b12, 0x83839e1d, 0x2c2c7458, 0x1a1a2e34, 0x1b1b2d36, 0x6e6eb2dc, 0x5a5aeeb4, 0xa0a0fb5b, 0x5252f6a4, 0x3b3b4d76, 0xd6d661b7, 0xb3b3ce7d, 0x29297b52, 0xe3e33edd, 0x2f2f715e, 0x84849713, 0x5353f5a6, 0xd1d168b9, 0x00000000, 0xeded2cc1, 0x20206040, 0xfcfc1fe3, 0xb1b1c879, 0x5b5bedb6, 0x6a6abed4, 0xcbcb468d, 0xbebed967, 0x39394b72, 0x4a4ade94, 0x4c4cd498, 0x5858e8b0, 0xcfcf4a85, 0xd0d06bbb, 0xefef2ac5, 0xaaaae54f, 0xfbfb16ed, 0x4343c586, 0x4d4dd79a, 0x33335566, 0x85859411, 0x4545cf8a, 0xf9f910e9, 0x02020604, 0x7f7f81fe, 0x5050f0a0, 0x3c3c4478, 0x9f9fba25, 0xa8a8e34b, 0x5151f3a2, 0xa3a3fe5d, 0x4040c080, 0x8f8f8a05, 0x9292ad3f, 0x9d9dbc21, 0x38384870, 0xf5f504f1, 0xbcbcdf63, 0xb6b6c177, 0xdada75af, 0x21216342, 0x10103020, 0xffff1ae5, 0xf3f30efd, 0xd2d26dbf, 0xcdcd4c81, 0x0c0c1418, 0x13133526, 0xecec2fc3, 0x5f5fe1be, 0x9797a235, 0x4444cc88, 0x1717392e, 0xc4c45793, 0xa7a7f255, 0x7e7e82fc, 0x3d3d477a, 0x6464acc8, 0x5d5de7ba, 0x19192b32, 0x737395e6, 0x6060a0c0, 0x81819819, 0x4f4fd19e, 0xdcdc7fa3, 0x22226644, 0x2a2a7e54, 0x9090ab3b, 0x8888830b, 0x4646ca8c, 0xeeee29c7, 0xb8b8d36b, 0x14143c28, 0xdede79a7, 0x5e5ee2bc, 0x0b0b1d16, 0xdbdb76ad, 0xe0e03bdb, 0x32325664, 0x3a3a4e74, 0x0a0a1e14, 0x4949db92, 0x06060a0c, 0x24246c48, 0x5c5ce4b8, 0xc2c25d9f, 0xd3d36ebd, 0xacacef43, 0x6262a6c4, 0x9191a839, 0x9595a431, 0xe4e437d3, 0x79798bf2, 0xe7e732d5, 0xc8c8438b, 0x3737596e, 0x6d6db7da, 0x8d8d8c01, 0xd5d564b1, 0x4e4ed29c, 0xa9a9e049, 0x6c6cb4d8, 0x5656faac, 0xf4f407f3, 0xeaea25cf, 0x6565afca, 0x7a7a8ef4, 0xaeaee947, 0x08081810, 0xbabad56f, 0x787888f0, 0x25256f4a, 0x2e2e725c, 0x1c1c2438, 0xa6a6f157, 0xb4b4c773, 0xc6c65197, 0xe8e823cb, 0xdddd7ca1, 0x74749ce8, 0x1f1f213e, 0x4b4bdd96, 0xbdbddc61, 0x8b8b860d, 0x8a8a850f, 0x707090e0, 0x3e3e427c, 0xb5b5c471, 0x6666aacc, 0x4848d890, 0x03030506, 0xf6f601f7, 0x0e0e121c, 0x6161a3c2, 0x35355f6a, 0x5757f9ae, 0xb9b9d069, 0x86869117, 0xc1c15899, 0x1d1d273a, 0x9e9eb927, 0xe1e138d9, 0xf8f813eb, 0x9898b32b, 0x11113322, 0x6969bbd2, 0xd9d970a9, 0x8e8e8907, 0x9494a733, 0x9b9bb62d, 0x1e1e223c, 0x87879215, 0xe9e920c9, 0xcece4987, 0x5555ffaa, 0x28287850, 0xdfdf7aa5, 0x8c8c8f03, 0xa1a1f859, 0x89898009, 0x0d0d171a, 0xbfbfda65, 0xe6e631d7, 0x4242c684, 0x6868b8d0, 0x4141c382, 0x9999b029, 0x2d2d775a, 0x0f0f111e, 0xb0b0cb7b, 0x5454fca8, 0xbbbbd66d, 0x16163a2c];

    // Transformations for decryption
    var T5 = [0x51f4a750, 0x7e416553, 0x1a17a4c3, 0x3a275e96, 0x3bab6bcb, 0x1f9d45f1, 0xacfa58ab, 0x4be30393, 0x2030fa55, 0xad766df6, 0x88cc7691, 0xf5024c25, 0x4fe5d7fc, 0xc52acbd7, 0x26354480, 0xb562a38f, 0xdeb15a49, 0x25ba1b67, 0x45ea0e98, 0x5dfec0e1, 0xc32f7502, 0x814cf012, 0x8d4697a3, 0x6bd3f9c6, 0x038f5fe7, 0x15929c95, 0xbf6d7aeb, 0x955259da, 0xd4be832d, 0x587421d3, 0x49e06929, 0x8ec9c844, 0x75c2896a, 0xf48e7978, 0x99583e6b, 0x27b971dd, 0xbee14fb6, 0xf088ad17, 0xc920ac66, 0x7dce3ab4, 0x63df4a18, 0xe51a3182, 0x97513360, 0x62537f45, 0xb16477e0, 0xbb6bae84, 0xfe81a01c, 0xf9082b94, 0x70486858, 0x8f45fd19, 0x94de6c87, 0x527bf8b7, 0xab73d323, 0x724b02e2, 0xe31f8f57, 0x6655ab2a, 0xb2eb2807, 0x2fb5c203, 0x86c57b9a, 0xd33708a5, 0x302887f2, 0x23bfa5b2, 0x02036aba, 0xed16825c, 0x8acf1c2b, 0xa779b492, 0xf307f2f0, 0x4e69e2a1, 0x65daf4cd, 0x0605bed5, 0xd134621f, 0xc4a6fe8a, 0x342e539d, 0xa2f355a0, 0x058ae132, 0xa4f6eb75, 0x0b83ec39, 0x4060efaa, 0x5e719f06, 0xbd6e1051, 0x3e218af9, 0x96dd063d, 0xdd3e05ae, 0x4de6bd46, 0x91548db5, 0x71c45d05, 0x0406d46f, 0x605015ff, 0x1998fb24, 0xd6bde997, 0x894043cc, 0x67d99e77, 0xb0e842bd, 0x07898b88, 0xe7195b38, 0x79c8eedb, 0xa17c0a47, 0x7c420fe9, 0xf8841ec9, 0x00000000, 0x09808683, 0x322bed48, 0x1e1170ac, 0x6c5a724e, 0xfd0efffb, 0x0f853856, 0x3daed51e, 0x362d3927, 0x0a0fd964, 0x685ca621, 0x9b5b54d1, 0x24362e3a, 0x0c0a67b1, 0x9357e70f, 0xb4ee96d2, 0x1b9b919e, 0x80c0c54f, 0x61dc20a2, 0x5a774b69, 0x1c121a16, 0xe293ba0a, 0xc0a02ae5, 0x3c22e043, 0x121b171d, 0x0e090d0b, 0xf28bc7ad, 0x2db6a8b9, 0x141ea9c8, 0x57f11985, 0xaf75074c, 0xee99ddbb, 0xa37f60fd, 0xf701269f, 0x5c72f5bc, 0x44663bc5, 0x5bfb7e34, 0x8b432976, 0xcb23c6dc, 0xb6edfc68, 0xb8e4f163, 0xd731dcca, 0x42638510, 0x13972240, 0x84c61120, 0x854a247d, 0xd2bb3df8, 0xaef93211, 0xc729a16d, 0x1d9e2f4b, 0xdcb230f3, 0x0d8652ec, 0x77c1e3d0, 0x2bb3166c, 0xa970b999, 0x119448fa, 0x47e96422, 0xa8fc8cc4, 0xa0f03f1a, 0x567d2cd8, 0x223390ef, 0x87494ec7, 0xd938d1c1, 0x8ccaa2fe, 0x98d40b36, 0xa6f581cf, 0xa57ade28, 0xdab78e26, 0x3fadbfa4, 0x2c3a9de4, 0x5078920d, 0x6a5fcc9b, 0x547e4662, 0xf68d13c2, 0x90d8b8e8, 0x2e39f75e, 0x82c3aff5, 0x9f5d80be, 0x69d0937c, 0x6fd52da9, 0xcf2512b3, 0xc8ac993b, 0x10187da7, 0xe89c636e, 0xdb3bbb7b, 0xcd267809, 0x6e5918f4, 0xec9ab701, 0x834f9aa8, 0xe6956e65, 0xaaffe67e, 0x21bccf08, 0xef15e8e6, 0xbae79bd9, 0x4a6f36ce, 0xea9f09d4, 0x29b07cd6, 0x31a4b2af, 0x2a3f2331, 0xc6a59430, 0x35a266c0, 0x744ebc37, 0xfc82caa6, 0xe090d0b0, 0x33a7d815, 0xf104984a, 0x41ecdaf7, 0x7fcd500e, 0x1791f62f, 0x764dd68d, 0x43efb04d, 0xccaa4d54, 0xe49604df, 0x9ed1b5e3, 0x4c6a881b, 0xc12c1fb8, 0x4665517f, 0x9d5eea04, 0x018c355d, 0xfa877473, 0xfb0b412e, 0xb3671d5a, 0x92dbd252, 0xe9105633, 0x6dd64713, 0x9ad7618c, 0x37a10c7a, 0x59f8148e, 0xeb133c89, 0xcea927ee, 0xb761c935, 0xe11ce5ed, 0x7a47b13c, 0x9cd2df59, 0x55f2733f, 0x1814ce79, 0x73c737bf, 0x53f7cdea, 0x5ffdaa5b, 0xdf3d6f14, 0x7844db86, 0xcaaff381, 0xb968c43e, 0x3824342c, 0xc2a3405f, 0x161dc372, 0xbce2250c, 0x283c498b, 0xff0d9541, 0x39a80171, 0x080cb3de, 0xd8b4e49c, 0x6456c190, 0x7bcb8461, 0xd532b670, 0x486c5c74, 0xd0b85742];
    var T6 = [0x5051f4a7, 0x537e4165, 0xc31a17a4, 0x963a275e, 0xcb3bab6b, 0xf11f9d45, 0xabacfa58, 0x934be303, 0x552030fa, 0xf6ad766d, 0x9188cc76, 0x25f5024c, 0xfc4fe5d7, 0xd7c52acb, 0x80263544, 0x8fb562a3, 0x49deb15a, 0x6725ba1b, 0x9845ea0e, 0xe15dfec0, 0x02c32f75, 0x12814cf0, 0xa38d4697, 0xc66bd3f9, 0xe7038f5f, 0x9515929c, 0xebbf6d7a, 0xda955259, 0x2dd4be83, 0xd3587421, 0x2949e069, 0x448ec9c8, 0x6a75c289, 0x78f48e79, 0x6b99583e, 0xdd27b971, 0xb6bee14f, 0x17f088ad, 0x66c920ac, 0xb47dce3a, 0x1863df4a, 0x82e51a31, 0x60975133, 0x4562537f, 0xe0b16477, 0x84bb6bae, 0x1cfe81a0, 0x94f9082b, 0x58704868, 0x198f45fd, 0x8794de6c, 0xb7527bf8, 0x23ab73d3, 0xe2724b02, 0x57e31f8f, 0x2a6655ab, 0x07b2eb28, 0x032fb5c2, 0x9a86c57b, 0xa5d33708, 0xf2302887, 0xb223bfa5, 0xba02036a, 0x5ced1682, 0x2b8acf1c, 0x92a779b4, 0xf0f307f2, 0xa14e69e2, 0xcd65daf4, 0xd50605be, 0x1fd13462, 0x8ac4a6fe, 0x9d342e53, 0xa0a2f355, 0x32058ae1, 0x75a4f6eb, 0x390b83ec, 0xaa4060ef, 0x065e719f, 0x51bd6e10, 0xf93e218a, 0x3d96dd06, 0xaedd3e05, 0x464de6bd, 0xb591548d, 0x0571c45d, 0x6f0406d4, 0xff605015, 0x241998fb, 0x97d6bde9, 0xcc894043, 0x7767d99e, 0xbdb0e842, 0x8807898b, 0x38e7195b, 0xdb79c8ee, 0x47a17c0a, 0xe97c420f, 0xc9f8841e, 0x00000000, 0x83098086, 0x48322bed, 0xac1e1170, 0x4e6c5a72, 0xfbfd0eff, 0x560f8538, 0x1e3daed5, 0x27362d39, 0x640a0fd9, 0x21685ca6, 0xd19b5b54, 0x3a24362e, 0xb10c0a67, 0x0f9357e7, 0xd2b4ee96, 0x9e1b9b91, 0x4f80c0c5, 0xa261dc20, 0x695a774b, 0x161c121a, 0x0ae293ba, 0xe5c0a02a, 0x433c22e0, 0x1d121b17, 0x0b0e090d, 0xadf28bc7, 0xb92db6a8, 0xc8141ea9, 0x8557f119, 0x4caf7507, 0xbbee99dd, 0xfda37f60, 0x9ff70126, 0xbc5c72f5, 0xc544663b, 0x345bfb7e, 0x768b4329, 0xdccb23c6, 0x68b6edfc, 0x63b8e4f1, 0xcad731dc, 0x10426385, 0x40139722, 0x2084c611, 0x7d854a24, 0xf8d2bb3d, 0x11aef932, 0x6dc729a1, 0x4b1d9e2f, 0xf3dcb230, 0xec0d8652, 0xd077c1e3, 0x6c2bb316, 0x99a970b9, 0xfa119448, 0x2247e964, 0xc4a8fc8c, 0x1aa0f03f, 0xd8567d2c, 0xef223390, 0xc787494e, 0xc1d938d1, 0xfe8ccaa2, 0x3698d40b, 0xcfa6f581, 0x28a57ade, 0x26dab78e, 0xa43fadbf, 0xe42c3a9d, 0x0d507892, 0x9b6a5fcc, 0x62547e46, 0xc2f68d13, 0xe890d8b8, 0x5e2e39f7, 0xf582c3af, 0xbe9f5d80, 0x7c69d093, 0xa96fd52d, 0xb3cf2512, 0x3bc8ac99, 0xa710187d, 0x6ee89c63, 0x7bdb3bbb, 0x09cd2678, 0xf46e5918, 0x01ec9ab7, 0xa8834f9a, 0x65e6956e, 0x7eaaffe6, 0x0821bccf, 0xe6ef15e8, 0xd9bae79b, 0xce4a6f36, 0xd4ea9f09, 0xd629b07c, 0xaf31a4b2, 0x312a3f23, 0x30c6a594, 0xc035a266, 0x37744ebc, 0xa6fc82ca, 0xb0e090d0, 0x1533a7d8, 0x4af10498, 0xf741ecda, 0x0e7fcd50, 0x2f1791f6, 0x8d764dd6, 0x4d43efb0, 0x54ccaa4d, 0xdfe49604, 0xe39ed1b5, 0x1b4c6a88, 0xb8c12c1f, 0x7f466551, 0x049d5eea, 0x5d018c35, 0x73fa8774, 0x2efb0b41, 0x5ab3671d, 0x5292dbd2, 0x33e91056, 0x136dd647, 0x8c9ad761, 0x7a37a10c, 0x8e59f814, 0x89eb133c, 0xeecea927, 0x35b761c9, 0xede11ce5, 0x3c7a47b1, 0x599cd2df, 0x3f55f273, 0x791814ce, 0xbf73c737, 0xea53f7cd, 0x5b5ffdaa, 0x14df3d6f, 0x867844db, 0x81caaff3, 0x3eb968c4, 0x2c382434, 0x5fc2a340, 0x72161dc3, 0x0cbce225, 0x8b283c49, 0x41ff0d95, 0x7139a801, 0xde080cb3, 0x9cd8b4e4, 0x906456c1, 0x617bcb84, 0x70d532b6, 0x74486c5c, 0x42d0b857];
    var T7 = [0xa75051f4, 0x65537e41, 0xa4c31a17, 0x5e963a27, 0x6bcb3bab, 0x45f11f9d, 0x58abacfa, 0x03934be3, 0xfa552030, 0x6df6ad76, 0x769188cc, 0x4c25f502, 0xd7fc4fe5, 0xcbd7c52a, 0x44802635, 0xa38fb562, 0x5a49deb1, 0x1b6725ba, 0x0e9845ea, 0xc0e15dfe, 0x7502c32f, 0xf012814c, 0x97a38d46, 0xf9c66bd3, 0x5fe7038f, 0x9c951592, 0x7aebbf6d, 0x59da9552, 0x832dd4be, 0x21d35874, 0x692949e0, 0xc8448ec9, 0x896a75c2, 0x7978f48e, 0x3e6b9958, 0x71dd27b9, 0x4fb6bee1, 0xad17f088, 0xac66c920, 0x3ab47dce, 0x4a1863df, 0x3182e51a, 0x33609751, 0x7f456253, 0x77e0b164, 0xae84bb6b, 0xa01cfe81, 0x2b94f908, 0x68587048, 0xfd198f45, 0x6c8794de, 0xf8b7527b, 0xd323ab73, 0x02e2724b, 0x8f57e31f, 0xab2a6655, 0x2807b2eb, 0xc2032fb5, 0x7b9a86c5, 0x08a5d337, 0x87f23028, 0xa5b223bf, 0x6aba0203, 0x825ced16, 0x1c2b8acf, 0xb492a779, 0xf2f0f307, 0xe2a14e69, 0xf4cd65da, 0xbed50605, 0x621fd134, 0xfe8ac4a6, 0x539d342e, 0x55a0a2f3, 0xe132058a, 0xeb75a4f6, 0xec390b83, 0xefaa4060, 0x9f065e71, 0x1051bd6e, 0x8af93e21, 0x063d96dd, 0x05aedd3e, 0xbd464de6, 0x8db59154, 0x5d0571c4, 0xd46f0406, 0x15ff6050, 0xfb241998, 0xe997d6bd, 0x43cc8940, 0x9e7767d9, 0x42bdb0e8, 0x8b880789, 0x5b38e719, 0xeedb79c8, 0x0a47a17c, 0x0fe97c42, 0x1ec9f884, 0x00000000, 0x86830980, 0xed48322b, 0x70ac1e11, 0x724e6c5a, 0xfffbfd0e, 0x38560f85, 0xd51e3dae, 0x3927362d, 0xd9640a0f, 0xa621685c, 0x54d19b5b, 0x2e3a2436, 0x67b10c0a, 0xe70f9357, 0x96d2b4ee, 0x919e1b9b, 0xc54f80c0, 0x20a261dc, 0x4b695a77, 0x1a161c12, 0xba0ae293, 0x2ae5c0a0, 0xe0433c22, 0x171d121b, 0x0d0b0e09, 0xc7adf28b, 0xa8b92db6, 0xa9c8141e, 0x198557f1, 0x074caf75, 0xddbbee99, 0x60fda37f, 0x269ff701, 0xf5bc5c72, 0x3bc54466, 0x7e345bfb, 0x29768b43, 0xc6dccb23, 0xfc68b6ed, 0xf163b8e4, 0xdccad731, 0x85104263, 0x22401397, 0x112084c6, 0x247d854a, 0x3df8d2bb, 0x3211aef9, 0xa16dc729, 0x2f4b1d9e, 0x30f3dcb2, 0x52ec0d86, 0xe3d077c1, 0x166c2bb3, 0xb999a970, 0x48fa1194, 0x642247e9, 0x8cc4a8fc, 0x3f1aa0f0, 0x2cd8567d, 0x90ef2233, 0x4ec78749, 0xd1c1d938, 0xa2fe8cca, 0x0b3698d4, 0x81cfa6f5, 0xde28a57a, 0x8e26dab7, 0xbfa43fad, 0x9de42c3a, 0x920d5078, 0xcc9b6a5f, 0x4662547e, 0x13c2f68d, 0xb8e890d8, 0xf75e2e39, 0xaff582c3, 0x80be9f5d, 0x937c69d0, 0x2da96fd5, 0x12b3cf25, 0x993bc8ac, 0x7da71018, 0x636ee89c, 0xbb7bdb3b, 0x7809cd26, 0x18f46e59, 0xb701ec9a, 0x9aa8834f, 0x6e65e695, 0xe67eaaff, 0xcf0821bc, 0xe8e6ef15, 0x9bd9bae7, 0x36ce4a6f, 0x09d4ea9f, 0x7cd629b0, 0xb2af31a4, 0x23312a3f, 0x9430c6a5, 0x66c035a2, 0xbc37744e, 0xcaa6fc82, 0xd0b0e090, 0xd81533a7, 0x984af104, 0xdaf741ec, 0x500e7fcd, 0xf62f1791, 0xd68d764d, 0xb04d43ef, 0x4d54ccaa, 0x04dfe496, 0xb5e39ed1, 0x881b4c6a, 0x1fb8c12c, 0x517f4665, 0xea049d5e, 0x355d018c, 0x7473fa87, 0x412efb0b, 0x1d5ab367, 0xd25292db, 0x5633e910, 0x47136dd6, 0x618c9ad7, 0x0c7a37a1, 0x148e59f8, 0x3c89eb13, 0x27eecea9, 0xc935b761, 0xe5ede11c, 0xb13c7a47, 0xdf599cd2, 0x733f55f2, 0xce791814, 0x37bf73c7, 0xcdea53f7, 0xaa5b5ffd, 0x6f14df3d, 0xdb867844, 0xf381caaf, 0xc43eb968, 0x342c3824, 0x405fc2a3, 0xc372161d, 0x250cbce2, 0x498b283c, 0x9541ff0d, 0x017139a8, 0xb3de080c, 0xe49cd8b4, 0xc1906456, 0x84617bcb, 0xb670d532, 0x5c74486c, 0x5742d0b8];
    var T8 = [0xf4a75051, 0x4165537e, 0x17a4c31a, 0x275e963a, 0xab6bcb3b, 0x9d45f11f, 0xfa58abac, 0xe303934b, 0x30fa5520, 0x766df6ad, 0xcc769188, 0x024c25f5, 0xe5d7fc4f, 0x2acbd7c5, 0x35448026, 0x62a38fb5, 0xb15a49de, 0xba1b6725, 0xea0e9845, 0xfec0e15d, 0x2f7502c3, 0x4cf01281, 0x4697a38d, 0xd3f9c66b, 0x8f5fe703, 0x929c9515, 0x6d7aebbf, 0x5259da95, 0xbe832dd4, 0x7421d358, 0xe0692949, 0xc9c8448e, 0xc2896a75, 0x8e7978f4, 0x583e6b99, 0xb971dd27, 0xe14fb6be, 0x88ad17f0, 0x20ac66c9, 0xce3ab47d, 0xdf4a1863, 0x1a3182e5, 0x51336097, 0x537f4562, 0x6477e0b1, 0x6bae84bb, 0x81a01cfe, 0x082b94f9, 0x48685870, 0x45fd198f, 0xde6c8794, 0x7bf8b752, 0x73d323ab, 0x4b02e272, 0x1f8f57e3, 0x55ab2a66, 0xeb2807b2, 0xb5c2032f, 0xc57b9a86, 0x3708a5d3, 0x2887f230, 0xbfa5b223, 0x036aba02, 0x16825ced, 0xcf1c2b8a, 0x79b492a7, 0x07f2f0f3, 0x69e2a14e, 0xdaf4cd65, 0x05bed506, 0x34621fd1, 0xa6fe8ac4, 0x2e539d34, 0xf355a0a2, 0x8ae13205, 0xf6eb75a4, 0x83ec390b, 0x60efaa40, 0x719f065e, 0x6e1051bd, 0x218af93e, 0xdd063d96, 0x3e05aedd, 0xe6bd464d, 0x548db591, 0xc45d0571, 0x06d46f04, 0x5015ff60, 0x98fb2419, 0xbde997d6, 0x4043cc89, 0xd99e7767, 0xe842bdb0, 0x898b8807, 0x195b38e7, 0xc8eedb79, 0x7c0a47a1, 0x420fe97c, 0x841ec9f8, 0x00000000, 0x80868309, 0x2bed4832, 0x1170ac1e, 0x5a724e6c, 0x0efffbfd, 0x8538560f, 0xaed51e3d, 0x2d392736, 0x0fd9640a, 0x5ca62168, 0x5b54d19b, 0x362e3a24, 0x0a67b10c, 0x57e70f93, 0xee96d2b4, 0x9b919e1b, 0xc0c54f80, 0xdc20a261, 0x774b695a, 0x121a161c, 0x93ba0ae2, 0xa02ae5c0, 0x22e0433c, 0x1b171d12, 0x090d0b0e, 0x8bc7adf2, 0xb6a8b92d, 0x1ea9c814, 0xf1198557, 0x75074caf, 0x99ddbbee, 0x7f60fda3, 0x01269ff7, 0x72f5bc5c, 0x663bc544, 0xfb7e345b, 0x4329768b, 0x23c6dccb, 0xedfc68b6, 0xe4f163b8, 0x31dccad7, 0x63851042, 0x97224013, 0xc6112084, 0x4a247d85, 0xbb3df8d2, 0xf93211ae, 0x29a16dc7, 0x9e2f4b1d, 0xb230f3dc, 0x8652ec0d, 0xc1e3d077, 0xb3166c2b, 0x70b999a9, 0x9448fa11, 0xe9642247, 0xfc8cc4a8, 0xf03f1aa0, 0x7d2cd856, 0x3390ef22, 0x494ec787, 0x38d1c1d9, 0xcaa2fe8c, 0xd40b3698, 0xf581cfa6, 0x7ade28a5, 0xb78e26da, 0xadbfa43f, 0x3a9de42c, 0x78920d50, 0x5fcc9b6a, 0x7e466254, 0x8d13c2f6, 0xd8b8e890, 0x39f75e2e, 0xc3aff582, 0x5d80be9f, 0xd0937c69, 0xd52da96f, 0x2512b3cf, 0xac993bc8, 0x187da710, 0x9c636ee8, 0x3bbb7bdb, 0x267809cd, 0x5918f46e, 0x9ab701ec, 0x4f9aa883, 0x956e65e6, 0xffe67eaa, 0xbccf0821, 0x15e8e6ef, 0xe79bd9ba, 0x6f36ce4a, 0x9f09d4ea, 0xb07cd629, 0xa4b2af31, 0x3f23312a, 0xa59430c6, 0xa266c035, 0x4ebc3774, 0x82caa6fc, 0x90d0b0e0, 0xa7d81533, 0x04984af1, 0xecdaf741, 0xcd500e7f, 0x91f62f17, 0x4dd68d76, 0xefb04d43, 0xaa4d54cc, 0x9604dfe4, 0xd1b5e39e, 0x6a881b4c, 0x2c1fb8c1, 0x65517f46, 0x5eea049d, 0x8c355d01, 0x877473fa, 0x0b412efb, 0x671d5ab3, 0xdbd25292, 0x105633e9, 0xd647136d, 0xd7618c9a, 0xa10c7a37, 0xf8148e59, 0x133c89eb, 0xa927eece, 0x61c935b7, 0x1ce5ede1, 0x47b13c7a, 0xd2df599c, 0xf2733f55, 0x14ce7918, 0xc737bf73, 0xf7cdea53, 0xfdaa5b5f, 0x3d6f14df, 0x44db8678, 0xaff381ca, 0x68c43eb9, 0x24342c38, 0xa3405fc2, 0x1dc37216, 0xe2250cbc, 0x3c498b28, 0x0d9541ff, 0xa8017139, 0x0cb3de08, 0xb4e49cd8, 0x56c19064, 0xcb84617b, 0x32b670d5, 0x6c5c7448, 0xb85742d0];

    // Transformations for decryption key expansion
    var U1 = [0x00000000, 0x0e090d0b, 0x1c121a16, 0x121b171d, 0x3824342c, 0x362d3927, 0x24362e3a, 0x2a3f2331, 0x70486858, 0x7e416553, 0x6c5a724e, 0x62537f45, 0x486c5c74, 0x4665517f, 0x547e4662, 0x5a774b69, 0xe090d0b0, 0xee99ddbb, 0xfc82caa6, 0xf28bc7ad, 0xd8b4e49c, 0xd6bde997, 0xc4a6fe8a, 0xcaaff381, 0x90d8b8e8, 0x9ed1b5e3, 0x8ccaa2fe, 0x82c3aff5, 0xa8fc8cc4, 0xa6f581cf, 0xb4ee96d2, 0xbae79bd9, 0xdb3bbb7b, 0xd532b670, 0xc729a16d, 0xc920ac66, 0xe31f8f57, 0xed16825c, 0xff0d9541, 0xf104984a, 0xab73d323, 0xa57ade28, 0xb761c935, 0xb968c43e, 0x9357e70f, 0x9d5eea04, 0x8f45fd19, 0x814cf012, 0x3bab6bcb, 0x35a266c0, 0x27b971dd, 0x29b07cd6, 0x038f5fe7, 0x0d8652ec, 0x1f9d45f1, 0x119448fa, 0x4be30393, 0x45ea0e98, 0x57f11985, 0x59f8148e, 0x73c737bf, 0x7dce3ab4, 0x6fd52da9, 0x61dc20a2, 0xad766df6, 0xa37f60fd, 0xb16477e0, 0xbf6d7aeb, 0x955259da, 0x9b5b54d1, 0x894043cc, 0x87494ec7, 0xdd3e05ae, 0xd33708a5, 0xc12c1fb8, 0xcf2512b3, 0xe51a3182, 0xeb133c89, 0xf9082b94, 0xf701269f, 0x4de6bd46, 0x43efb04d, 0x51f4a750, 0x5ffdaa5b, 0x75c2896a, 0x7bcb8461, 0x69d0937c, 0x67d99e77, 0x3daed51e, 0x33a7d815, 0x21bccf08, 0x2fb5c203, 0x058ae132, 0x0b83ec39, 0x1998fb24, 0x1791f62f, 0x764dd68d, 0x7844db86, 0x6a5fcc9b, 0x6456c190, 0x4e69e2a1, 0x4060efaa, 0x527bf8b7, 0x5c72f5bc, 0x0605bed5, 0x080cb3de, 0x1a17a4c3, 0x141ea9c8, 0x3e218af9, 0x302887f2, 0x223390ef, 0x2c3a9de4, 0x96dd063d, 0x98d40b36, 0x8acf1c2b, 0x84c61120, 0xaef93211, 0xa0f03f1a, 0xb2eb2807, 0xbce2250c, 0xe6956e65, 0xe89c636e, 0xfa877473, 0xf48e7978, 0xdeb15a49, 0xd0b85742, 0xc2a3405f, 0xccaa4d54, 0x41ecdaf7, 0x4fe5d7fc, 0x5dfec0e1, 0x53f7cdea, 0x79c8eedb, 0x77c1e3d0, 0x65daf4cd, 0x6bd3f9c6, 0x31a4b2af, 0x3fadbfa4, 0x2db6a8b9, 0x23bfa5b2, 0x09808683, 0x07898b88, 0x15929c95, 0x1b9b919e, 0xa17c0a47, 0xaf75074c, 0xbd6e1051, 0xb3671d5a, 0x99583e6b, 0x97513360, 0x854a247d, 0x8b432976, 0xd134621f, 0xdf3d6f14, 0xcd267809, 0xc32f7502, 0xe9105633, 0xe7195b38, 0xf5024c25, 0xfb0b412e, 0x9ad7618c, 0x94de6c87, 0x86c57b9a, 0x88cc7691, 0xa2f355a0, 0xacfa58ab, 0xbee14fb6, 0xb0e842bd, 0xea9f09d4, 0xe49604df, 0xf68d13c2, 0xf8841ec9, 0xd2bb3df8, 0xdcb230f3, 0xcea927ee, 0xc0a02ae5, 0x7a47b13c, 0x744ebc37, 0x6655ab2a, 0x685ca621, 0x42638510, 0x4c6a881b, 0x5e719f06, 0x5078920d, 0x0a0fd964, 0x0406d46f, 0x161dc372, 0x1814ce79, 0x322bed48, 0x3c22e043, 0x2e39f75e, 0x2030fa55, 0xec9ab701, 0xe293ba0a, 0xf088ad17, 0xfe81a01c, 0xd4be832d, 0xdab78e26, 0xc8ac993b, 0xc6a59430, 0x9cd2df59, 0x92dbd252, 0x80c0c54f, 0x8ec9c844, 0xa4f6eb75, 0xaaffe67e, 0xb8e4f163, 0xb6edfc68, 0x0c0a67b1, 0x02036aba, 0x10187da7, 0x1e1170ac, 0x342e539d, 0x3a275e96, 0x283c498b, 0x26354480, 0x7c420fe9, 0x724b02e2, 0x605015ff, 0x6e5918f4, 0x44663bc5, 0x4a6f36ce, 0x587421d3, 0x567d2cd8, 0x37a10c7a, 0x39a80171, 0x2bb3166c, 0x25ba1b67, 0x0f853856, 0x018c355d, 0x13972240, 0x1d9e2f4b, 0x47e96422, 0x49e06929, 0x5bfb7e34, 0x55f2733f, 0x7fcd500e, 0x71c45d05, 0x63df4a18, 0x6dd64713, 0xd731dcca, 0xd938d1c1, 0xcb23c6dc, 0xc52acbd7, 0xef15e8e6, 0xe11ce5ed, 0xf307f2f0, 0xfd0efffb, 0xa779b492, 0xa970b999, 0xbb6bae84, 0xb562a38f, 0x9f5d80be, 0x91548db5, 0x834f9aa8, 0x8d4697a3];
    var U2 = [0x00000000, 0x0b0e090d, 0x161c121a, 0x1d121b17, 0x2c382434, 0x27362d39, 0x3a24362e, 0x312a3f23, 0x58704868, 0x537e4165, 0x4e6c5a72, 0x4562537f, 0x74486c5c, 0x7f466551, 0x62547e46, 0x695a774b, 0xb0e090d0, 0xbbee99dd, 0xa6fc82ca, 0xadf28bc7, 0x9cd8b4e4, 0x97d6bde9, 0x8ac4a6fe, 0x81caaff3, 0xe890d8b8, 0xe39ed1b5, 0xfe8ccaa2, 0xf582c3af, 0xc4a8fc8c, 0xcfa6f581, 0xd2b4ee96, 0xd9bae79b, 0x7bdb3bbb, 0x70d532b6, 0x6dc729a1, 0x66c920ac, 0x57e31f8f, 0x5ced1682, 0x41ff0d95, 0x4af10498, 0x23ab73d3, 0x28a57ade, 0x35b761c9, 0x3eb968c4, 0x0f9357e7, 0x049d5eea, 0x198f45fd, 0x12814cf0, 0xcb3bab6b, 0xc035a266, 0xdd27b971, 0xd629b07c, 0xe7038f5f, 0xec0d8652, 0xf11f9d45, 0xfa119448, 0x934be303, 0x9845ea0e, 0x8557f119, 0x8e59f814, 0xbf73c737, 0xb47dce3a, 0xa96fd52d, 0xa261dc20, 0xf6ad766d, 0xfda37f60, 0xe0b16477, 0xebbf6d7a, 0xda955259, 0xd19b5b54, 0xcc894043, 0xc787494e, 0xaedd3e05, 0xa5d33708, 0xb8c12c1f, 0xb3cf2512, 0x82e51a31, 0x89eb133c, 0x94f9082b, 0x9ff70126, 0x464de6bd, 0x4d43efb0, 0x5051f4a7, 0x5b5ffdaa, 0x6a75c289, 0x617bcb84, 0x7c69d093, 0x7767d99e, 0x1e3daed5, 0x1533a7d8, 0x0821bccf, 0x032fb5c2, 0x32058ae1, 0x390b83ec, 0x241998fb, 0x2f1791f6, 0x8d764dd6, 0x867844db, 0x9b6a5fcc, 0x906456c1, 0xa14e69e2, 0xaa4060ef, 0xb7527bf8, 0xbc5c72f5, 0xd50605be, 0xde080cb3, 0xc31a17a4, 0xc8141ea9, 0xf93e218a, 0xf2302887, 0xef223390, 0xe42c3a9d, 0x3d96dd06, 0x3698d40b, 0x2b8acf1c, 0x2084c611, 0x11aef932, 0x1aa0f03f, 0x07b2eb28, 0x0cbce225, 0x65e6956e, 0x6ee89c63, 0x73fa8774, 0x78f48e79, 0x49deb15a, 0x42d0b857, 0x5fc2a340, 0x54ccaa4d, 0xf741ecda, 0xfc4fe5d7, 0xe15dfec0, 0xea53f7cd, 0xdb79c8ee, 0xd077c1e3, 0xcd65daf4, 0xc66bd3f9, 0xaf31a4b2, 0xa43fadbf, 0xb92db6a8, 0xb223bfa5, 0x83098086, 0x8807898b, 0x9515929c, 0x9e1b9b91, 0x47a17c0a, 0x4caf7507, 0x51bd6e10, 0x5ab3671d, 0x6b99583e, 0x60975133, 0x7d854a24, 0x768b4329, 0x1fd13462, 0x14df3d6f, 0x09cd2678, 0x02c32f75, 0x33e91056, 0x38e7195b, 0x25f5024c, 0x2efb0b41, 0x8c9ad761, 0x8794de6c, 0x9a86c57b, 0x9188cc76, 0xa0a2f355, 0xabacfa58, 0xb6bee14f, 0xbdb0e842, 0xd4ea9f09, 0xdfe49604, 0xc2f68d13, 0xc9f8841e, 0xf8d2bb3d, 0xf3dcb230, 0xeecea927, 0xe5c0a02a, 0x3c7a47b1, 0x37744ebc, 0x2a6655ab, 0x21685ca6, 0x10426385, 0x1b4c6a88, 0x065e719f, 0x0d507892, 0x640a0fd9, 0x6f0406d4, 0x72161dc3, 0x791814ce, 0x48322bed, 0x433c22e0, 0x5e2e39f7, 0x552030fa, 0x01ec9ab7, 0x0ae293ba, 0x17f088ad, 0x1cfe81a0, 0x2dd4be83, 0x26dab78e, 0x3bc8ac99, 0x30c6a594, 0x599cd2df, 0x5292dbd2, 0x4f80c0c5, 0x448ec9c8, 0x75a4f6eb, 0x7eaaffe6, 0x63b8e4f1, 0x68b6edfc, 0xb10c0a67, 0xba02036a, 0xa710187d, 0xac1e1170, 0x9d342e53, 0x963a275e, 0x8b283c49, 0x80263544, 0xe97c420f, 0xe2724b02, 0xff605015, 0xf46e5918, 0xc544663b, 0xce4a6f36, 0xd3587421, 0xd8567d2c, 0x7a37a10c, 0x7139a801, 0x6c2bb316, 0x6725ba1b, 0x560f8538, 0x5d018c35, 0x40139722, 0x4b1d9e2f, 0x2247e964, 0x2949e069, 0x345bfb7e, 0x3f55f273, 0x0e7fcd50, 0x0571c45d, 0x1863df4a, 0x136dd647, 0xcad731dc, 0xc1d938d1, 0xdccb23c6, 0xd7c52acb, 0xe6ef15e8, 0xede11ce5, 0xf0f307f2, 0xfbfd0eff, 0x92a779b4, 0x99a970b9, 0x84bb6bae, 0x8fb562a3, 0xbe9f5d80, 0xb591548d, 0xa8834f9a, 0xa38d4697];
    var U3 = [0x00000000, 0x0d0b0e09, 0x1a161c12, 0x171d121b, 0x342c3824, 0x3927362d, 0x2e3a2436, 0x23312a3f, 0x68587048, 0x65537e41, 0x724e6c5a, 0x7f456253, 0x5c74486c, 0x517f4665, 0x4662547e, 0x4b695a77, 0xd0b0e090, 0xddbbee99, 0xcaa6fc82, 0xc7adf28b, 0xe49cd8b4, 0xe997d6bd, 0xfe8ac4a6, 0xf381caaf, 0xb8e890d8, 0xb5e39ed1, 0xa2fe8cca, 0xaff582c3, 0x8cc4a8fc, 0x81cfa6f5, 0x96d2b4ee, 0x9bd9bae7, 0xbb7bdb3b, 0xb670d532, 0xa16dc729, 0xac66c920, 0x8f57e31f, 0x825ced16, 0x9541ff0d, 0x984af104, 0xd323ab73, 0xde28a57a, 0xc935b761, 0xc43eb968, 0xe70f9357, 0xea049d5e, 0xfd198f45, 0xf012814c, 0x6bcb3bab, 0x66c035a2, 0x71dd27b9, 0x7cd629b0, 0x5fe7038f, 0x52ec0d86, 0x45f11f9d, 0x48fa1194, 0x03934be3, 0x0e9845ea, 0x198557f1, 0x148e59f8, 0x37bf73c7, 0x3ab47dce, 0x2da96fd5, 0x20a261dc, 0x6df6ad76, 0x60fda37f, 0x77e0b164, 0x7aebbf6d, 0x59da9552, 0x54d19b5b, 0x43cc8940, 0x4ec78749, 0x05aedd3e, 0x08a5d337, 0x1fb8c12c, 0x12b3cf25, 0x3182e51a, 0x3c89eb13, 0x2b94f908, 0x269ff701, 0xbd464de6, 0xb04d43ef, 0xa75051f4, 0xaa5b5ffd, 0x896a75c2, 0x84617bcb, 0x937c69d0, 0x9e7767d9, 0xd51e3dae, 0xd81533a7, 0xcf0821bc, 0xc2032fb5, 0xe132058a, 0xec390b83, 0xfb241998, 0xf62f1791, 0xd68d764d, 0xdb867844, 0xcc9b6a5f, 0xc1906456, 0xe2a14e69, 0xefaa4060, 0xf8b7527b, 0xf5bc5c72, 0xbed50605, 0xb3de080c, 0xa4c31a17, 0xa9c8141e, 0x8af93e21, 0x87f23028, 0x90ef2233, 0x9de42c3a, 0x063d96dd, 0x0b3698d4, 0x1c2b8acf, 0x112084c6, 0x3211aef9, 0x3f1aa0f0, 0x2807b2eb, 0x250cbce2, 0x6e65e695, 0x636ee89c, 0x7473fa87, 0x7978f48e, 0x5a49deb1, 0x5742d0b8, 0x405fc2a3, 0x4d54ccaa, 0xdaf741ec, 0xd7fc4fe5, 0xc0e15dfe, 0xcdea53f7, 0xeedb79c8, 0xe3d077c1, 0xf4cd65da, 0xf9c66bd3, 0xb2af31a4, 0xbfa43fad, 0xa8b92db6, 0xa5b223bf, 0x86830980, 0x8b880789, 0x9c951592, 0x919e1b9b, 0x0a47a17c, 0x074caf75, 0x1051bd6e, 0x1d5ab367, 0x3e6b9958, 0x33609751, 0x247d854a, 0x29768b43, 0x621fd134, 0x6f14df3d, 0x7809cd26, 0x7502c32f, 0x5633e910, 0x5b38e719, 0x4c25f502, 0x412efb0b, 0x618c9ad7, 0x6c8794de, 0x7b9a86c5, 0x769188cc, 0x55a0a2f3, 0x58abacfa, 0x4fb6bee1, 0x42bdb0e8, 0x09d4ea9f, 0x04dfe496, 0x13c2f68d, 0x1ec9f884, 0x3df8d2bb, 0x30f3dcb2, 0x27eecea9, 0x2ae5c0a0, 0xb13c7a47, 0xbc37744e, 0xab2a6655, 0xa621685c, 0x85104263, 0x881b4c6a, 0x9f065e71, 0x920d5078, 0xd9640a0f, 0xd46f0406, 0xc372161d, 0xce791814, 0xed48322b, 0xe0433c22, 0xf75e2e39, 0xfa552030, 0xb701ec9a, 0xba0ae293, 0xad17f088, 0xa01cfe81, 0x832dd4be, 0x8e26dab7, 0x993bc8ac, 0x9430c6a5, 0xdf599cd2, 0xd25292db, 0xc54f80c0, 0xc8448ec9, 0xeb75a4f6, 0xe67eaaff, 0xf163b8e4, 0xfc68b6ed, 0x67b10c0a, 0x6aba0203, 0x7da71018, 0x70ac1e11, 0x539d342e, 0x5e963a27, 0x498b283c, 0x44802635, 0x0fe97c42, 0x02e2724b, 0x15ff6050, 0x18f46e59, 0x3bc54466, 0x36ce4a6f, 0x21d35874, 0x2cd8567d, 0x0c7a37a1, 0x017139a8, 0x166c2bb3, 0x1b6725ba, 0x38560f85, 0x355d018c, 0x22401397, 0x2f4b1d9e, 0x642247e9, 0x692949e0, 0x7e345bfb, 0x733f55f2, 0x500e7fcd, 0x5d0571c4, 0x4a1863df, 0x47136dd6, 0xdccad731, 0xd1c1d938, 0xc6dccb23, 0xcbd7c52a, 0xe8e6ef15, 0xe5ede11c, 0xf2f0f307, 0xfffbfd0e, 0xb492a779, 0xb999a970, 0xae84bb6b, 0xa38fb562, 0x80be9f5d, 0x8db59154, 0x9aa8834f, 0x97a38d46];
    var U4 = [0x00000000, 0x090d0b0e, 0x121a161c, 0x1b171d12, 0x24342c38, 0x2d392736, 0x362e3a24, 0x3f23312a, 0x48685870, 0x4165537e, 0x5a724e6c, 0x537f4562, 0x6c5c7448, 0x65517f46, 0x7e466254, 0x774b695a, 0x90d0b0e0, 0x99ddbbee, 0x82caa6fc, 0x8bc7adf2, 0xb4e49cd8, 0xbde997d6, 0xa6fe8ac4, 0xaff381ca, 0xd8b8e890, 0xd1b5e39e, 0xcaa2fe8c, 0xc3aff582, 0xfc8cc4a8, 0xf581cfa6, 0xee96d2b4, 0xe79bd9ba, 0x3bbb7bdb, 0x32b670d5, 0x29a16dc7, 0x20ac66c9, 0x1f8f57e3, 0x16825ced, 0x0d9541ff, 0x04984af1, 0x73d323ab, 0x7ade28a5, 0x61c935b7, 0x68c43eb9, 0x57e70f93, 0x5eea049d, 0x45fd198f, 0x4cf01281, 0xab6bcb3b, 0xa266c035, 0xb971dd27, 0xb07cd629, 0x8f5fe703, 0x8652ec0d, 0x9d45f11f, 0x9448fa11, 0xe303934b, 0xea0e9845, 0xf1198557, 0xf8148e59, 0xc737bf73, 0xce3ab47d, 0xd52da96f, 0xdc20a261, 0x766df6ad, 0x7f60fda3, 0x6477e0b1, 0x6d7aebbf, 0x5259da95, 0x5b54d19b, 0x4043cc89, 0x494ec787, 0x3e05aedd, 0x3708a5d3, 0x2c1fb8c1, 0x2512b3cf, 0x1a3182e5, 0x133c89eb, 0x082b94f9, 0x01269ff7, 0xe6bd464d, 0xefb04d43, 0xf4a75051, 0xfdaa5b5f, 0xc2896a75, 0xcb84617b, 0xd0937c69, 0xd99e7767, 0xaed51e3d, 0xa7d81533, 0xbccf0821, 0xb5c2032f, 0x8ae13205, 0x83ec390b, 0x98fb2419, 0x91f62f17, 0x4dd68d76, 0x44db8678, 0x5fcc9b6a, 0x56c19064, 0x69e2a14e, 0x60efaa40, 0x7bf8b752, 0x72f5bc5c, 0x05bed506, 0x0cb3de08, 0x17a4c31a, 0x1ea9c814, 0x218af93e, 0x2887f230, 0x3390ef22, 0x3a9de42c, 0xdd063d96, 0xd40b3698, 0xcf1c2b8a, 0xc6112084, 0xf93211ae, 0xf03f1aa0, 0xeb2807b2, 0xe2250cbc, 0x956e65e6, 0x9c636ee8, 0x877473fa, 0x8e7978f4, 0xb15a49de, 0xb85742d0, 0xa3405fc2, 0xaa4d54cc, 0xecdaf741, 0xe5d7fc4f, 0xfec0e15d, 0xf7cdea53, 0xc8eedb79, 0xc1e3d077, 0xdaf4cd65, 0xd3f9c66b, 0xa4b2af31, 0xadbfa43f, 0xb6a8b92d, 0xbfa5b223, 0x80868309, 0x898b8807, 0x929c9515, 0x9b919e1b, 0x7c0a47a1, 0x75074caf, 0x6e1051bd, 0x671d5ab3, 0x583e6b99, 0x51336097, 0x4a247d85, 0x4329768b, 0x34621fd1, 0x3d6f14df, 0x267809cd, 0x2f7502c3, 0x105633e9, 0x195b38e7, 0x024c25f5, 0x0b412efb, 0xd7618c9a, 0xde6c8794, 0xc57b9a86, 0xcc769188, 0xf355a0a2, 0xfa58abac, 0xe14fb6be, 0xe842bdb0, 0x9f09d4ea, 0x9604dfe4, 0x8d13c2f6, 0x841ec9f8, 0xbb3df8d2, 0xb230f3dc, 0xa927eece, 0xa02ae5c0, 0x47b13c7a, 0x4ebc3774, 0x55ab2a66, 0x5ca62168, 0x63851042, 0x6a881b4c, 0x719f065e, 0x78920d50, 0x0fd9640a, 0x06d46f04, 0x1dc37216, 0x14ce7918, 0x2bed4832, 0x22e0433c, 0x39f75e2e, 0x30fa5520, 0x9ab701ec, 0x93ba0ae2, 0x88ad17f0, 0x81a01cfe, 0xbe832dd4, 0xb78e26da, 0xac993bc8, 0xa59430c6, 0xd2df599c, 0xdbd25292, 0xc0c54f80, 0xc9c8448e, 0xf6eb75a4, 0xffe67eaa, 0xe4f163b8, 0xedfc68b6, 0x0a67b10c, 0x036aba02, 0x187da710, 0x1170ac1e, 0x2e539d34, 0x275e963a, 0x3c498b28, 0x35448026, 0x420fe97c, 0x4b02e272, 0x5015ff60, 0x5918f46e, 0x663bc544, 0x6f36ce4a, 0x7421d358, 0x7d2cd856, 0xa10c7a37, 0xa8017139, 0xb3166c2b, 0xba1b6725, 0x8538560f, 0x8c355d01, 0x97224013, 0x9e2f4b1d, 0xe9642247, 0xe0692949, 0xfb7e345b, 0xf2733f55, 0xcd500e7f, 0xc45d0571, 0xdf4a1863, 0xd647136d, 0x31dccad7, 0x38d1c1d9, 0x23c6dccb, 0x2acbd7c5, 0x15e8e6ef, 0x1ce5ede1, 0x07f2f0f3, 0x0efffbfd, 0x79b492a7, 0x70b999a9, 0x6bae84bb, 0x62a38fb5, 0x5d80be9f, 0x548db591, 0x4f9aa883, 0x4697a38d];

    function convertToInt32(bytes) {
        var result = [];
        for (var i = 0; i < bytes.length; i += 4) {
            result.push(
                (bytes[i    ] << 24) |
                (bytes[i + 1] << 16) |
                (bytes[i + 2] <<  8) |
                 bytes[i + 3]
            );
        }
        return result;
    }

    var AES = function(key) {
        if (!(this instanceof AES)) {
            throw Error('AES must be instanitated with `new`');
        }

        Object.defineProperty(this, 'key', {
            value: coerceArray(key, true)
        });

        this._prepare();
    }


    AES.prototype._prepare = function() {

        var rounds = numberOfRounds[this.key.length];
        if (rounds == null) {
            throw new Error('invalid key size (must be 16, 24 or 32 bytes)');
        }

        // encryption round keys
        this._Ke = [];

        // decryption round keys
        this._Kd = [];

        for (var i = 0; i <= rounds; i++) {
            this._Ke.push([0, 0, 0, 0]);
            this._Kd.push([0, 0, 0, 0]);
        }

        var roundKeyCount = (rounds + 1) * 4;
        var KC = this.key.length / 4;

        // convert the key into ints
        var tk = convertToInt32(this.key);

        // copy values into round key arrays
        var index;
        for (var i = 0; i < KC; i++) {
            index = i >> 2;
            this._Ke[index][i % 4] = tk[i];
            this._Kd[rounds - index][i % 4] = tk[i];
        }

        // key expansion (fips-197 section 5.2)
        var rconpointer = 0;
        var t = KC, tt;
        while (t < roundKeyCount) {
            tt = tk[KC - 1];
            tk[0] ^= ((S[(tt >> 16) & 0xFF] << 24) ^
                      (S[(tt >>  8) & 0xFF] << 16) ^
                      (S[ tt        & 0xFF] <<  8) ^
                       S[(tt >> 24) & 0xFF]        ^
                      (rcon[rconpointer] << 24));
            rconpointer += 1;

            // key expansion (for non-256 bit)
            if (KC != 8) {
                for (var i = 1; i < KC; i++) {
                    tk[i] ^= tk[i - 1];
                }

            // key expansion for 256-bit keys is "slightly different" (fips-197)
            } else {
                for (var i = 1; i < (KC / 2); i++) {
                    tk[i] ^= tk[i - 1];
                }
                tt = tk[(KC / 2) - 1];

                tk[KC / 2] ^= (S[ tt        & 0xFF]        ^
                              (S[(tt >>  8) & 0xFF] <<  8) ^
                              (S[(tt >> 16) & 0xFF] << 16) ^
                              (S[(tt >> 24) & 0xFF] << 24));

                for (var i = (KC / 2) + 1; i < KC; i++) {
                    tk[i] ^= tk[i - 1];
                }
            }

            // copy values into round key arrays
            var i = 0, r, c;
            while (i < KC && t < roundKeyCount) {
                r = t >> 2;
                c = t % 4;
                this._Ke[r][c] = tk[i];
                this._Kd[rounds - r][c] = tk[i++];
                t++;
            }
        }

        // inverse-cipher-ify the decryption round key (fips-197 section 5.3)
        for (var r = 1; r < rounds; r++) {
            for (var c = 0; c < 4; c++) {
                tt = this._Kd[r][c];
                this._Kd[r][c] = (U1[(tt >> 24) & 0xFF] ^
                                  U2[(tt >> 16) & 0xFF] ^
                                  U3[(tt >>  8) & 0xFF] ^
                                  U4[ tt        & 0xFF]);
            }
        }
    }

    AES.prototype.encrypt = function(plaintext) {
        if (plaintext.length != 16) {
            throw new Error('invalid plaintext size (must be 16 bytes)');
        }

        var rounds = this._Ke.length - 1;
        var a = [0, 0, 0, 0];

        // convert plaintext to (ints ^ key)
        var t = convertToInt32(plaintext);
        for (var i = 0; i < 4; i++) {
            t[i] ^= this._Ke[0][i];
        }

        // apply round transforms
        for (var r = 1; r < rounds; r++) {
            for (var i = 0; i < 4; i++) {
                a[i] = (T1[(t[ i         ] >> 24) & 0xff] ^
                        T2[(t[(i + 1) % 4] >> 16) & 0xff] ^
                        T3[(t[(i + 2) % 4] >>  8) & 0xff] ^
                        T4[ t[(i + 3) % 4]        & 0xff] ^
                        this._Ke[r][i]);
            }
            t = a.slice();
        }

        // the last round is special
        var result = createArray(16), tt;
        for (var i = 0; i < 4; i++) {
            tt = this._Ke[rounds][i];
            result[4 * i    ] = (S[(t[ i         ] >> 24) & 0xff] ^ (tt >> 24)) & 0xff;
            result[4 * i + 1] = (S[(t[(i + 1) % 4] >> 16) & 0xff] ^ (tt >> 16)) & 0xff;
            result[4 * i + 2] = (S[(t[(i + 2) % 4] >>  8) & 0xff] ^ (tt >>  8)) & 0xff;
            result[4 * i + 3] = (S[ t[(i + 3) % 4]        & 0xff] ^  tt       ) & 0xff;
        }

        return result;
    }

    AES.prototype.decrypt = function(ciphertext) {
        if (ciphertext.length != 16) {
            throw new Error('invalid ciphertext size (must be 16 bytes)');
        }

        var rounds = this._Kd.length - 1;
        var a = [0, 0, 0, 0];

        // convert plaintext to (ints ^ key)
        var t = convertToInt32(ciphertext);
        for (var i = 0; i < 4; i++) {
            t[i] ^= this._Kd[0][i];
        }

        // apply round transforms
        for (var r = 1; r < rounds; r++) {
            for (var i = 0; i < 4; i++) {
                a[i] = (T5[(t[ i          ] >> 24) & 0xff] ^
                        T6[(t[(i + 3) % 4] >> 16) & 0xff] ^
                        T7[(t[(i + 2) % 4] >>  8) & 0xff] ^
                        T8[ t[(i + 1) % 4]        & 0xff] ^
                        this._Kd[r][i]);
            }
            t = a.slice();
        }

        // the last round is special
        var result = createArray(16), tt;
        for (var i = 0; i < 4; i++) {
            tt = this._Kd[rounds][i];
            result[4 * i    ] = (Si[(t[ i         ] >> 24) & 0xff] ^ (tt >> 24)) & 0xff;
            result[4 * i + 1] = (Si[(t[(i + 3) % 4] >> 16) & 0xff] ^ (tt >> 16)) & 0xff;
            result[4 * i + 2] = (Si[(t[(i + 2) % 4] >>  8) & 0xff] ^ (tt >>  8)) & 0xff;
            result[4 * i + 3] = (Si[ t[(i + 1) % 4]        & 0xff] ^  tt       ) & 0xff;
        }

        return result;
    }


    /**
     *  Mode Of Operation - Electonic Codebook (ECB)
     */
    var ModeOfOperationECB = function(key) {
        if (!(this instanceof ModeOfOperationECB)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Electronic Code Block";
        this.name = "ecb";

        this._aes = new AES(key);
    }

    ModeOfOperationECB.prototype.encrypt = function(plaintext) {
        plaintext = coerceArray(plaintext);

        if ((plaintext.length % 16) !== 0) {
            throw new Error('invalid plaintext size (must be multiple of 16 bytes)');
        }

        var ciphertext = createArray(plaintext.length);
        var block = createArray(16);

        for (var i = 0; i < plaintext.length; i += 16) {
            copyArray(plaintext, block, 0, i, i + 16);
            block = this._aes.encrypt(block);
            copyArray(block, ciphertext, i);
        }

        return ciphertext;
    }

    ModeOfOperationECB.prototype.decrypt = function(ciphertext) {
        ciphertext = coerceArray(ciphertext);

        if ((ciphertext.length % 16) !== 0) {
            throw new Error('invalid ciphertext size (must be multiple of 16 bytes)');
        }

        var plaintext = createArray(ciphertext.length);
        var block = createArray(16);

        for (var i = 0; i < ciphertext.length; i += 16) {
            copyArray(ciphertext, block, 0, i, i + 16);
            block = this._aes.decrypt(block);
            copyArray(block, plaintext, i);
        }

        return plaintext;
    }


    /**
     *  Mode Of Operation - Cipher Block Chaining (CBC)
     */
    var ModeOfOperationCBC = function(key, iv) {
        if (!(this instanceof ModeOfOperationCBC)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Cipher Block Chaining";
        this.name = "cbc";

        if (!iv) {
            iv = createArray(16);

        } else if (iv.length != 16) {
            throw new Error('invalid initialation vector size (must be 16 bytes)');
        }

        this._lastCipherblock = coerceArray(iv, true);

        this._aes = new AES(key);
    }

    ModeOfOperationCBC.prototype.encrypt = function(plaintext) {
        plaintext = coerceArray(plaintext);

        if ((plaintext.length % 16) !== 0) {
            throw new Error('invalid plaintext size (must be multiple of 16 bytes)');
        }

        var ciphertext = createArray(plaintext.length);
        var block = createArray(16);

        for (var i = 0; i < plaintext.length; i += 16) {
            copyArray(plaintext, block, 0, i, i + 16);

            for (var j = 0; j < 16; j++) {
                block[j] ^= this._lastCipherblock[j];
            }

            this._lastCipherblock = this._aes.encrypt(block);
            copyArray(this._lastCipherblock, ciphertext, i);
        }

        return ciphertext;
    }

    ModeOfOperationCBC.prototype.decrypt = function(ciphertext) {
        ciphertext = coerceArray(ciphertext);

        if ((ciphertext.length % 16) !== 0) {
            throw new Error('invalid ciphertext size (must be multiple of 16 bytes)');
        }

        var plaintext = createArray(ciphertext.length);
        var block = createArray(16);

        for (var i = 0; i < ciphertext.length; i += 16) {
            copyArray(ciphertext, block, 0, i, i + 16);
            block = this._aes.decrypt(block);

            for (var j = 0; j < 16; j++) {
                plaintext[i + j] = block[j] ^ this._lastCipherblock[j];
            }

            copyArray(ciphertext, this._lastCipherblock, 0, i, i + 16);
        }

        return plaintext;
    }


    /**
     *  Mode Of Operation - Cipher Feedback (CFB)
     */
    var ModeOfOperationCFB = function(key, iv, segmentSize) {
        if (!(this instanceof ModeOfOperationCFB)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Cipher Feedback";
        this.name = "cfb";

        if (!iv) {
            iv = createArray(16);

        } else if (iv.length != 16) {
            throw new Error('invalid initialation vector size (must be 16 size)');
        }

        if (!segmentSize) { segmentSize = 1; }

        this.segmentSize = segmentSize;

        this._shiftRegister = coerceArray(iv, true);

        this._aes = new AES(key);
    }

    ModeOfOperationCFB.prototype.encrypt = function(plaintext) {
        if ((plaintext.length % this.segmentSize) != 0) {
            throw new Error('invalid plaintext size (must be segmentSize bytes)');
        }

        var encrypted = coerceArray(plaintext, true);

        var xorSegment;
        for (var i = 0; i < encrypted.length; i += this.segmentSize) {
            xorSegment = this._aes.encrypt(this._shiftRegister);
            for (var j = 0; j < this.segmentSize; j++) {
                encrypted[i + j] ^= xorSegment[j];
            }

            // Shift the register
            copyArray(this._shiftRegister, this._shiftRegister, 0, this.segmentSize);
            copyArray(encrypted, this._shiftRegister, 16 - this.segmentSize, i, i + this.segmentSize);
        }

        return encrypted;
    }

    ModeOfOperationCFB.prototype.decrypt = function(ciphertext) {
        if ((ciphertext.length % this.segmentSize) != 0) {
            throw new Error('invalid ciphertext size (must be segmentSize bytes)');
        }

        var plaintext = coerceArray(ciphertext, true);

        var xorSegment;
        for (var i = 0; i < plaintext.length; i += this.segmentSize) {
            xorSegment = this._aes.encrypt(this._shiftRegister);

            for (var j = 0; j < this.segmentSize; j++) {
                plaintext[i + j] ^= xorSegment[j];
            }

            // Shift the register
            copyArray(this._shiftRegister, this._shiftRegister, 0, this.segmentSize);
            copyArray(ciphertext, this._shiftRegister, 16 - this.segmentSize, i, i + this.segmentSize);
        }

        return plaintext;
    }

    /**
     *  Mode Of Operation - Output Feedback (OFB)
     */
    var ModeOfOperationOFB = function(key, iv) {
        if (!(this instanceof ModeOfOperationOFB)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Output Feedback";
        this.name = "ofb";

        if (!iv) {
            iv = createArray(16);

        } else if (iv.length != 16) {
            throw new Error('invalid initialation vector size (must be 16 bytes)');
        }

        this._lastPrecipher = coerceArray(iv, true);
        this._lastPrecipherIndex = 16;

        this._aes = new AES(key);
    }

    ModeOfOperationOFB.prototype.encrypt = function(plaintext) {
        var encrypted = coerceArray(plaintext, true);

        for (var i = 0; i < encrypted.length; i++) {
            if (this._lastPrecipherIndex === 16) {
                this._lastPrecipher = this._aes.encrypt(this._lastPrecipher);
                this._lastPrecipherIndex = 0;
            }
            encrypted[i] ^= this._lastPrecipher[this._lastPrecipherIndex++];
        }

        return encrypted;
    }

    // Decryption is symetric
    ModeOfOperationOFB.prototype.decrypt = ModeOfOperationOFB.prototype.encrypt;


    /**
     *  Counter object for CTR common mode of operation
     */
    var Counter = function(initialValue) {
        if (!(this instanceof Counter)) {
            throw Error('Counter must be instanitated with `new`');
        }

        // We allow 0, but anything false-ish uses the default 1
        if (initialValue !== 0 && !initialValue) { initialValue = 1; }

        if (typeof(initialValue) === 'number') {
            this._counter = createArray(16);
            this.setValue(initialValue);

        } else {
            this.setBytes(initialValue);
        }
    }

    Counter.prototype.setValue = function(value) {
        if (typeof(value) !== 'number' || parseInt(value) != value) {
            throw new Error('invalid counter value (must be an integer)');
        }

        // We cannot safely handle numbers beyond the safe range for integers
        if (value > Number.MAX_SAFE_INTEGER) {
            throw new Error('integer value out of safe range');
        }

        for (var index = 15; index >= 0; --index) {
            this._counter[index] = value % 256;
            value = parseInt(value / 256);
        }
    }

    Counter.prototype.setBytes = function(bytes) {
        bytes = coerceArray(bytes, true);

        if (bytes.length != 16) {
            throw new Error('invalid counter bytes size (must be 16 bytes)');
        }

        this._counter = bytes;
    };

    Counter.prototype.increment = function() {
        for (var i = 15; i >= 0; i--) {
            if (this._counter[i] === 255) {
                this._counter[i] = 0;
            } else {
                this._counter[i]++;
                break;
            }
        }
    }


    /**
     *  Mode Of Operation - Counter (CTR)
     */
    var ModeOfOperationCTR = function(key, counter) {
        if (!(this instanceof ModeOfOperationCTR)) {
            throw Error('AES must be instanitated with `new`');
        }

        this.description = "Counter";
        this.name = "ctr";

        if (!(counter instanceof Counter)) {
            counter = new Counter(counter)
        }

        this._counter = counter;

        this._remainingCounter = null;
        this._remainingCounterIndex = 16;

        this._aes = new AES(key);
    }

    ModeOfOperationCTR.prototype.encrypt = function(plaintext) {
        var encrypted = coerceArray(plaintext, true);

        for (var i = 0; i < encrypted.length; i++) {
            if (this._remainingCounterIndex === 16) {
                this._remainingCounter = this._aes.encrypt(this._counter._counter);
                this._remainingCounterIndex = 0;
                this._counter.increment();
            }
            encrypted[i] ^= this._remainingCounter[this._remainingCounterIndex++];
        }

        return encrypted;
    }

    // Decryption is symetric
    ModeOfOperationCTR.prototype.decrypt = ModeOfOperationCTR.prototype.encrypt;


    ///////////////////////
    // Padding

    // See:https://tools.ietf.org/html/rfc2315
    function pkcs7pad(data) {
        data = coerceArray(data, true);
        var padder = 16 - (data.length % 16);
        var result = createArray(data.length + padder);
        copyArray(data, result);
        for (var i = data.length; i < result.length; i++) {
            result[i] = padder;
        }
        return result;
    }

    function pkcs7strip(data) {
        data = coerceArray(data, true);
        if (data.length < 16) { throw new Error('PKCS#7 invalid length'); }

        var padder = data[data.length - 1];
        if (padder > 16) { throw new Error('PKCS#7 padding byte out of range'); }

        var length = data.length - padder;
        for (var i = 0; i < padder; i++) {
            if (data[length + i] !== padder) {
                throw new Error('PKCS#7 invalid padding byte');
            }
        }

        var result = createArray(length);
        copyArray(data, result, 0, 0, length);
        return result;
    }

    ///////////////////////
    // Exporting


    // The block cipher
    var aesjs = {
        AES: AES,
        Counter: Counter,

        ModeOfOperation: {
            ecb: ModeOfOperationECB,
            cbc: ModeOfOperationCBC,
            cfb: ModeOfOperationCFB,
            ofb: ModeOfOperationOFB,
            ctr: ModeOfOperationCTR
        },

        utils: {
            hex: convertHex,
            utf8: convertUtf8
        },

        padding: {
            pkcs7: {
                pad: pkcs7pad,
                strip: pkcs7strip
            }
        },

        _arrayTest: {
            coerceArray: coerceArray,
            createArray: createArray,
            copyArray: copyArray,
        }
    };


    // node.js
    return aesjs;



})();

// ── OLE2 Parser ──
function parseOLE2(bytes){
  const SS=1<<r16(bytes,30);
  const fatL=[];
  for(let i=0;i<Math.min(r32(bytes,44),109);i++){const s=r32(bytes,76+i*4);if(s<0xFFFFFFFC)fatL.push(s);}
  const fat=new Uint32Array(fatL.length*SS/4);
  for(let i=0;i<fatL.length;i++){const o=(fatL[i]+1)*SS;for(let j=0;j<SS/4;j++)fat[i*SS/4+j]=r32(bytes,o+j*4);}
  function chain(s){
    const p=[];while(s<0xFFFFFFFC){p.push(bytes.slice((s+1)*SS,(s+1)*SS+SS));s=fat[s];}
    const o=new Uint8Array(p.reduce((a,c)=>a+c.length,0));let x=0;for(const c of p){o.set(c,x);x+=c.length;}return o;
  }
  let mf=null,ms=null;
  const nMF=r32(bytes,64),mfS=r32(bytes,60),miniCut=r32(bytes,56);
  if(nMF>0&&mfS<0xFFFFFFFC){const d=chain(mfS);mf=new Uint32Array(d.buffer,d.byteOffset,d.length/4);}
  const dir=chain(r32(bytes,48)),streams={};
  function ent(i){
    const b=i*128;if(b+128>dir.length)return null;
    const nl=r16(dir,b+64);if(!nl)return null;
    let nm='';for(let j=0;j<nl-2;j+=2)nm+=String.fromCharCode(dir[b+j]|dir[b+j+1]<<8);
    return{nm,type:dir[b+66],start:r32(dir,b+116),size:r32(dir,b+120),child:r32(dir,b+76),left:r32(dir,b+68),right:r32(dir,b+72)};
  }
  function scan(i){
    if(i>=0xFFFFFFFC)return;const e=ent(i);if(!e)return;
    if(e.type===5&&e.start<0xFFFFFFFC)ms=chain(e.start);
    if(e.type===2&&e.nm&&e.start<0xFFFFFFFC){
      if(e.size<miniCut&&mf&&ms){
        const MZ=64,p=[];let s=e.start;
        while(s<0xFFFFFFFC){p.push(ms.slice(s*MZ,(s+1)*MZ));s=mf[s];}
        const o=new Uint8Array(p.reduce((a,c)=>a+c.length,0));let x=0;for(const c of p){o.set(c,x);x+=c.length;}
        streams[e.nm]=o.slice(0,e.size);
      }else streams[e.nm]=chain(e.start).slice(0,e.size);
    }
    scan(e.child);scan(e.left);scan(e.right);
  }
  scan(0);return streams;
}

// ── ECMA-376 Standard Encryption: AES-ECB + SHA-1 ──
async function decryptECMA376Standard(bytes, password) {
  const st = parseOLE2(bytes);
  const ei = st['EncryptionInfo'], ep = st['EncryptedPackage'];
  if (!ei || !ep) return null;

  const hSize   = r32(ei, 8);
  const hBase   = 12;
  const keySize = r32(ei, hBase+16);
  const keyLen  = keySize / 8;
  const vBase   = hBase + hSize;
  const saltSize= r32(ei, vBase);
  const salt    = ei.slice(vBase+4, vBase+4+saltSize);

  const key = await deriveKey(password, salt, keyLen);
  if (!key) return null;

  const totalSize = r32(ep, 0) + r32(ep, 4) * 4294967296;
  const encData   = ep.slice(8);

  // AES-ECB decrypt using aesjs
  const ecbCipher = new aesjs.ModeOfOperation.ecb(key);
  const padLen = Math.ceil(encData.length / 16) * 16;
  const padded = new Uint8Array(padLen);
  padded.set(encData);
  const decrypted = ecbCipher.decrypt(padded);
  const result = new Uint8Array(decrypted).slice(0, totalSize);

  if (result[0] !== 0x50 || result[1] !== 0x4B) return null;
  return result.buffer;
}

// ── Key Derivation (ECMA-376 Standard §6.3.2.1, XOR method) ──
async function deriveKey(password, salt, keyLen) {
  const pw = new Uint8Array(password.length * 2);
  for (let i = 0; i < password.length; i++) {
    pw[i*2]   = password.charCodeAt(i) & 0xFF;
    pw[i*2+1] = (password.charCodeAt(i) >> 8) & 0xFF;
  }
  const h0 = new Uint8Array(salt.length + pw.length);
  h0.set(salt); h0.set(pw, salt.length);
  let h = new Uint8Array(await crypto.subtle.digest('SHA-1', h0));
  for (let i = 0; i < 50000; i++) {
    const it = new Uint8Array(4 + h.length);
    it[0]=i&0xFF;it[1]=(i>>8)&0xFF;it[2]=(i>>16)&0xFF;it[3]=(i>>24)&0xFF;
    it.set(h, 4);
    h = new Uint8Array(await crypto.subtle.digest('SHA-1', it));
  }
  const fin = new Uint8Array(h.length + 4); fin.set(h);
  const hf  = new Uint8Array(await crypto.subtle.digest('SHA-1', fin));
  const buf1 = new Uint8Array(64); buf1.fill(0x36); for(let i=0;i<20;i++) buf1[i]^=hf[i];
  const buf2 = new Uint8Array(64); buf2.fill(0x5C); for(let i=0;i<20;i++) buf2[i]^=hf[i];
  const x1 = new Uint8Array(await crypto.subtle.digest('SHA-1', buf1));
  const x2 = new Uint8Array(await crypto.subtle.digest('SHA-1', buf2));
  const x3 = new Uint8Array(x1.length + x2.length);
  x3.set(x1); x3.set(x2, x1.length);
  return x3.slice(0, keyLen);
}
