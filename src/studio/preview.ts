import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: false
});

const purifyConfig = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'script'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick']
};

export function renderSafeMarkdown(source?: string) {
  const raw = source?.trim()
    ? marked.parse(source)
    : '<p>Start typing to preview your post.</p>';
  return DOMPurify.sanitize(String(raw), purifyConfig);
}
