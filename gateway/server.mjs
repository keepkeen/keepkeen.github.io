import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 8788);
const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = process.env.NOTION_VERSION?.trim() || '2026-03-11';
const STUDIO_GATEWAY_TOKEN = process.env.STUDIO_GATEWAY_TOKEN?.trim() || '';
const STUDIO_SESSION_SECRET = process.env.STUDIO_SESSION_SECRET?.trim() || '';
const STUDIO_SESSION_TTL_SECONDS = Number(process.env.STUDIO_SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7);
const STUDIO_ALLOWED_ORIGINS = new Set(
  (process.env.STUDIO_ALLOWED_ORIGINS ?? 'http://localhost:4321,https://keepkeen.github.io')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
const NOTION_TOKEN = process.env.NOTION_TOKEN?.trim() || '';
const NOTION_PARENT_TYPE = process.env.NOTION_PARENT_TYPE?.trim() || 'page';
const NOTION_PARENT_ID = process.env.NOTION_PARENT_ID?.trim() || '';
const NOTION_PARENT_LABEL = process.env.NOTION_PARENT_LABEL?.trim() || '';

const PROPERTY_ENV_MAP = {
  title: process.env.NOTION_PROP_TITLE?.trim() ?? '',
  description: process.env.NOTION_PROP_DESCRIPTION?.trim() ?? '',
  slug: process.env.NOTION_PROP_SLUG?.trim() ?? '',
  tags: process.env.NOTION_PROP_TAGS?.trim() ?? '',
  date: process.env.NOTION_PROP_DATE?.trim() ?? '',
  updatedDate: process.env.NOTION_PROP_UPDATED?.trim() ?? '',
  draft: process.env.NOTION_PROP_DRAFT?.trim() ?? '',
  featured: process.env.NOTION_PROP_FEATURED?.trim() ?? ''
};

const dataSourceSchemaCache = new Map();

if (!STUDIO_GATEWAY_TOKEN || !STUDIO_SESSION_SECRET) {
  console.error('Missing STUDIO_GATEWAY_TOKEN or STUDIO_SESSION_SECRET.');
  process.exit(1);
}

const normalizeSearchText = (value) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const richText = (content) => [{ type: 'text', text: { content } }];

const createError = (status, message, details = undefined) => {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
};

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const parseCookies = (cookieHeader = '') =>
  cookieHeader
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce((cookies, segment) => {
      const [name, ...rest] = segment.split('=');
      cookies[name] = decodeURIComponent(rest.join('='));
      return cookies;
    }, {});

const serializeCookie = (name, value, options = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.path) parts.push(`Path=${options.path}`);

  return parts.join('; ');
};

const signValue = (value) =>
  createHmac('sha256', STUDIO_SESSION_SECRET).update(value).digest('base64url');

const issueSession = () => {
  const payload = JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + STUDIO_SESSION_TTL_SECONDS
  });
  const encoded = Buffer.from(payload).toString('base64url');
  return `${encoded}.${signValue(encoded)}`;
};

const readSession = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.studio_session;

  if (!token) {
    return null;
  }

  const [encoded, signature] = token.split('.');

  if (!encoded || !signature || !safeEqual(signValue(encoded), signature)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
};

const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin;

  if (origin && STUDIO_ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
};

const ensureAllowedOrigin = (req) => {
  const origin = req.headers.origin;

  if (!origin) {
    return;
  }

  if (!STUDIO_ALLOWED_ORIGINS.has(origin)) {
    throw createError(403, 'Origin is not allowed to access the Studio gateway.');
  }
};

const sendJson = (req, res, status, body, extraHeaders = {}) => {
  setCorsHeaders(req, res);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
};

const readJsonBody = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
};

const ensureAuthenticated = (req) => {
  const session = readSession(req);

  if (!session) {
    throw createError(401, 'Studio gateway authentication is required.');
  }

  return session;
};

const notionRequest = async (pathname, options = {}) => {
  if (!NOTION_TOKEN) {
    throw createError(503, 'NOTION_TOKEN is not configured on the gateway.');
  }

  const response = await fetch(`${NOTION_API_BASE}${pathname}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw createError(response.status, json?.message ?? 'Notion API request failed.', json);
  }

  return json;
};

const getTextFromRichText = (items = []) =>
  items
    .map((item) => item?.plain_text ?? item?.text?.content ?? '')
    .join('')
    .trim();

const getPageTitle = (page) => {
  const properties = Object.values(page.properties ?? {});
  const titleProperty = properties.find((property) => property?.type === 'title');

  return getTextFromRichText(titleProperty?.title) || 'Untitled page';
};

const summarizePage = (page) => ({
  id: page.id,
  title: getPageTitle(page),
  url: page.url,
  createdTime: page.created_time,
  lastEditedTime: page.last_edited_time,
  parentType: page.parent?.type ?? null,
  parentId:
    page.parent?.data_source_id ??
    page.parent?.page_id ??
    page.parent?.database_id ??
    page.parent?.block_id ??
    null
});

const findPropertyDefinition = (schema, configuredName, expectedType = '') => {
  const entries = Object.entries(schema ?? {});

  if (configuredName) {
    const direct = entries.find(
      ([name, property]) =>
        name === configuredName || property?.id === configuredName || property?.name === configuredName
    );

    if (direct) {
      return { key: direct[0], property: direct[1] };
    }
  }

  if (expectedType) {
    const fallback = entries.find(([, property]) => property?.type === expectedType);

    if (fallback) {
      return { key: fallback[0], property: fallback[1] };
    }
  }

  return null;
};

const getDataSourceSchema = async (dataSourceId) => {
  if (!dataSourceId) {
    return null;
  }

  if (dataSourceSchemaCache.has(dataSourceId)) {
    return dataSourceSchemaCache.get(dataSourceId);
  }

  const dataSource = await notionRequest(`/data_sources/${dataSourceId}`);
  const schema = dataSource.properties ?? {};
  dataSourceSchemaCache.set(dataSourceId, schema);
  return schema;
};

const toCheckbox = (value) => value === true || value === 'true' || value === '1';

const buildPropertyPayload = (definition, value) => {
  const propertyType = definition?.property?.type;

  if (!propertyType) {
    return null;
  }

  if ((value === undefined || value === null || value === '') && propertyType !== 'checkbox') {
    return null;
  }

  if (propertyType === 'title') {
    return { title: richText(String(value || 'Untitled Post')) };
  }

  if (propertyType === 'rich_text') {
    return { rich_text: value ? richText(String(value)) : [] };
  }

  if (propertyType === 'url') {
    return { url: value ? String(value) : null };
  }

  if (propertyType === 'checkbox') {
    return { checkbox: toCheckbox(value) };
  }

  if (propertyType === 'date') {
    return { date: value ? { start: String(value).slice(0, 10) } : null };
  }

  if (propertyType === 'multi_select') {
    const names = Array.isArray(value)
      ? value
      : String(value)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

    return { multi_select: names.map((name) => ({ name })) };
  }

  if (propertyType === 'select') {
    return { select: value ? { name: String(value) } : null };
  }

  return null;
};

const buildDataSourceProperties = async (state, dataSourceId) => {
  const schema = await getDataSourceSchema(dataSourceId);
  const properties = {};
  const fieldValues = {
    title: state.title || 'Untitled Post',
    description: state.description || '',
    slug: state.slug || '',
    tags: state.tags || '',
    date: state.date || '',
    updatedDate: state.updatedDate || '',
    draft: Boolean(state.draft),
    featured: Boolean(state.featured)
  };

  for (const [field, configuredName] of Object.entries(PROPERTY_ENV_MAP)) {
    if (!configuredName && field !== 'title') {
      continue;
    }

    const definition = findPropertyDefinition(schema, configuredName, field === 'title' ? 'title' : '');

    if (!definition) {
      continue;
    }

    const payload = buildPropertyPayload(definition, fieldValues[field]);

    if (payload) {
      properties[definition.key] = payload;
    }
  }

  return properties;
};

const getPropertyValue = (page, schema, field) => {
  const configuredName = PROPERTY_ENV_MAP[field];
  const definition = findPropertyDefinition(schema, configuredName, field === 'title' ? 'title' : '');

  if (!definition) {
    return '';
  }

  const property = page.properties?.[definition.key];
  const propertyType = property?.type;

  if (!propertyType) {
    return '';
  }

  if (propertyType === 'title') {
    return getTextFromRichText(property.title);
  }

  if (propertyType === 'rich_text') {
    return getTextFromRichText(property.rich_text);
  }

  if (propertyType === 'url') {
    return property.url ?? '';
  }

  if (propertyType === 'checkbox') {
    return Boolean(property.checkbox);
  }

  if (propertyType === 'date') {
    return property.date?.start?.slice(0, 10) ?? '';
  }

  if (propertyType === 'multi_select') {
    return (property.multi_select ?? []).map((item) => item.name).join(', ');
  }

  if (propertyType === 'select') {
    return property.select?.name ?? '';
  }

  return '';
};

const splitMarkdownTitle = (markdown, fallbackTitle = '') => {
  const normalized = String(markdown ?? '').replace(/\r/g, '').trim();
  const titleMatch = normalized.match(/^#\s+(.+)\n+/);

  if (!titleMatch) {
    return {
      title: fallbackTitle,
      body: normalized
    };
  }

  return {
    title: titleMatch[1].trim() || fallbackTitle,
    body: normalized.slice(titleMatch[0].length).trim()
  };
};

const inferDescription = (body) => {
  const paragraphs = String(body)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/^#+\s+/gm, '').trim())
    .filter(Boolean);

  return (
    paragraphs.find((paragraph) => paragraph.length >= 40) ??
    paragraphs[0] ??
    'Imported from Notion.'
  );
};

const notionPageToStudioState = async (page, markdown) => {
  const summary = summarizePage(page);
  const { title: markdownTitle, body } = splitMarkdownTitle(markdown, summary.title);
  const parentDataSourceId =
    page.parent?.data_source_id ?? page.parent?.database_id ?? (NOTION_PARENT_TYPE === 'data_source' ? NOTION_PARENT_ID : '');
  const schema = parentDataSourceId ? await getDataSourceSchema(parentDataSourceId) : null;

  const title = schema ? getPropertyValue(page, schema, 'title') || markdownTitle || summary.title : markdownTitle || summary.title;
  const description = schema ? getPropertyValue(page, schema, 'description') || inferDescription(body) : inferDescription(body);
  const slug = schema ? getPropertyValue(page, schema, 'slug') || '' : '';
  const tags = schema ? getPropertyValue(page, schema, 'tags') || '' : '';
  const date = schema ? getPropertyValue(page, schema, 'date') || '' : '';
  const updatedDate = schema ? getPropertyValue(page, schema, 'updatedDate') || '' : '';
  const draft = schema ? Boolean(getPropertyValue(page, schema, 'draft')) : false;
  const featured = schema ? Boolean(getPropertyValue(page, schema, 'featured')) : false;

  return {
    title,
    slug,
    date,
    updatedDate,
    format: 'md',
    tags,
    description,
    draft,
    featured,
    body,
    notionPageId: summary.id,
    notionPageUrl: summary.url
  };
};

const searchNotionPages = async (query) => {
  if (NOTION_PARENT_TYPE === 'data_source' && NOTION_PARENT_ID) {
    const response = await notionRequest(`/data_sources/${NOTION_PARENT_ID}/query`, {
      method: 'POST',
      body: {
        page_size: 20,
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }]
      }
    });

    const normalizedQuery = normalizeSearchText(query);

    return (response.results ?? [])
      .filter((page) => page.object === 'page')
      .map((page) => summarizePage(page))
      .filter((page) => {
        if (!normalizedQuery) {
          return true;
        }

        return (
          normalizeSearchText(page.title).includes(normalizedQuery) ||
          page.id.replace(/-/g, '').includes(normalizedQuery.replace(/\s+/g, ''))
        );
      });
  }

  const response = await notionRequest('/search', {
    method: 'POST',
    body: {
      query,
      page_size: 20,
      filter: {
        property: 'object',
        value: 'page'
      }
    }
  });

  return (response.results ?? [])
    .filter((page) => page.object === 'page')
    .map((page) => summarizePage(page));
};

const createNotionPage = async (state) => {
  if (!NOTION_PARENT_ID) {
    throw createError(400, 'NOTION_PARENT_ID is not configured. The gateway is currently import-only.');
  }

  const body = {
    parent:
      NOTION_PARENT_TYPE === 'data_source'
        ? { data_source_id: NOTION_PARENT_ID }
        : { page_id: NOTION_PARENT_ID },
    markdown: state.body ?? ''
  };

  if (NOTION_PARENT_TYPE === 'data_source') {
    body.properties = await buildDataSourceProperties(state, NOTION_PARENT_ID);
  } else {
    body.properties = {
      title: {
        title: richText(state.title || 'Untitled Post')
      }
    };
  }

  const page = await notionRequest('/pages', {
    method: 'POST',
    body
  });

  return summarizePage(page);
};

const updateNotionPage = async (pageId, state) => {
  const page = await notionRequest(`/pages/${pageId}`);
  const parentDataSourceId =
    page.parent?.data_source_id ?? page.parent?.database_id ?? (NOTION_PARENT_TYPE === 'data_source' ? NOTION_PARENT_ID : '');

  if (parentDataSourceId) {
    const properties = await buildDataSourceProperties(state, parentDataSourceId);

    if (Object.keys(properties).length > 0) {
      await notionRequest(`/pages/${pageId}`, {
        method: 'PATCH',
        body: { properties }
      });
    }
  } else if (state.title) {
    await notionRequest(`/pages/${pageId}`, {
      method: 'PATCH',
      body: {
        properties: {
          title: {
            title: richText(state.title)
          }
        }
      }
    });
  }

  const markdownResponse = await notionRequest(`/pages/${pageId}/markdown`, {
    method: 'PATCH',
    body: {
      type: 'replace_content',
      replace_content: {
        new_str: state.body ?? '',
        allow_deleting_content: true
      }
    }
  });

  return {
    page: summarizePage(await notionRequest(`/pages/${pageId}`)),
    markdown: markdownResponse
  };
};

const handleSessionCreate = async (req, res) => {
  ensureAllowedOrigin(req);
  const body = await readJsonBody(req);
  const providedToken =
    String(body.token ?? req.headers['x-studio-gateway-token'] ?? '').trim();

  if (!providedToken || !safeEqual(providedToken, STUDIO_GATEWAY_TOKEN)) {
    throw createError(401, 'Invalid gateway token.');
  }

  const sessionToken = issueSession();
  const session = readSession({
    headers: {
      cookie: `studio_session=${sessionToken}`
    }
  });

  sendJson(
    req,
    res,
    200,
    {
      authenticated: true,
      expiresAt: session?.exp ? new Date(session.exp * 1000).toISOString() : null,
      notionConfigured: Boolean(NOTION_TOKEN),
      parentConfigured: Boolean(NOTION_PARENT_ID),
      parentType: NOTION_PARENT_TYPE,
      parentLabel: NOTION_PARENT_LABEL || NOTION_PARENT_ID || null
    },
    {
      'Set-Cookie': serializeCookie('studio_session', sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        path: '/',
        maxAge: STUDIO_SESSION_TTL_SECONDS
      })
    }
  );
};

const handleSessionRead = (req, res) => {
  ensureAllowedOrigin(req);
  const session = readSession(req);

  sendJson(req, res, 200, {
    authenticated: Boolean(session),
    expiresAt: session?.exp ? new Date(session.exp * 1000).toISOString() : null,
    notionConfigured: Boolean(NOTION_TOKEN),
    parentConfigured: Boolean(NOTION_PARENT_ID),
    parentType: NOTION_PARENT_TYPE,
    parentLabel: NOTION_PARENT_LABEL || NOTION_PARENT_ID || null
  });
};

const handleSessionDelete = (req, res) => {
  ensureAllowedOrigin(req);
  sendJson(
    req,
    res,
    200,
    { authenticated: false },
    {
      'Set-Cookie': serializeCookie('studio_session', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        path: '/',
        maxAge: 0
      })
    }
  );
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'OPTIONS') {
      ensureAllowedOrigin(req);
      setCorsHeaders(req, res);
      res.writeHead(204, {
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Studio-Client, X-Studio-Gateway-Token',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return;
    }

    if (url.pathname === '/healthz') {
      sendJson(req, res, 200, {
        ok: true,
        notionConfigured: Boolean(NOTION_TOKEN),
        parentConfigured: Boolean(NOTION_PARENT_ID)
      });
      return;
    }

    if (url.pathname === '/api/studio/session' && req.method === 'GET') {
      handleSessionRead(req, res);
      return;
    }

    if (url.pathname === '/api/studio/session' && req.method === 'POST') {
      await handleSessionCreate(req, res);
      return;
    }

    if (url.pathname === '/api/studio/session' && req.method === 'DELETE') {
      handleSessionDelete(req, res);
      return;
    }

    if (url.pathname === '/api/notion/pages' && req.method === 'GET') {
      ensureAllowedOrigin(req);
      ensureAuthenticated(req);
      const query = url.searchParams.get('query')?.trim() ?? '';
      const results = await searchNotionPages(query);
      sendJson(req, res, 200, { results });
      return;
    }

    const pageMatch = url.pathname.match(/^\/api\/notion\/pages\/([0-9a-f-]+)$/i);

    if (pageMatch && req.method === 'GET') {
      ensureAllowedOrigin(req);
      ensureAuthenticated(req);
      const pageId = pageMatch[1];
      const [page, markdown] = await Promise.all([
        notionRequest(`/pages/${pageId}`),
        notionRequest(`/pages/${pageId}/markdown`)
      ]);
      const state = await notionPageToStudioState(page, markdown.markdown ?? '');

      sendJson(req, res, 200, {
        page: summarizePage(page),
        state,
        markdown: {
          truncated: Boolean(markdown.truncated),
          unknownBlockIds: markdown.unknown_block_ids ?? []
        }
      });
      return;
    }

    if (url.pathname === '/api/notion/pages' && req.method === 'POST') {
      ensureAllowedOrigin(req);
      ensureAuthenticated(req);
      const body = await readJsonBody(req);
      const page = await createNotionPage(body.state ?? {});
      sendJson(req, res, 200, { page });
      return;
    }

    if (pageMatch && req.method === 'PATCH') {
      ensureAllowedOrigin(req);
      ensureAuthenticated(req);
      const body = await readJsonBody(req);
      const result = await updateNotionPage(pageMatch[1], body.state ?? {});
      sendJson(req, res, 200, result);
      return;
    }

    throw createError(404, 'Route not found.');
  } catch (error) {
    const status = error?.status ?? 500;
    sendJson(req, res, status, {
      error: error?.message ?? 'Unexpected gateway error.',
      details: error?.details ?? null
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Studio gateway listening on http://${HOST}:${PORT}`);
});
