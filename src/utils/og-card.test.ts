import { describe, expect, it } from 'vitest';
import { buildOgCardSvg, wrapMixedText } from './og-card';

describe('wrapMixedText', () => {
  it('keeps latin words whole', () => {
    const lines = wrapMixedText('alpha beta gamma delta', 8, 5);
    expect(lines.every((line) => /^[a-z ]+$/.test(line))).toBe(true);
    expect(lines.join(' ').replace(/\s+/g, ' ')).toBe('alpha beta gamma delta');
  });

  it('wraps Chinese text without needing spaces', () => {
    const lines = wrapMixedText('为什么代码总在压缩一次会话复盘与源码核对', 8, 5);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('为什么代码总在压缩一次会话复盘与源码核对');
  });

  it('adds an ellipsis when text overflows maxLines', () => {
    const lines = wrapMixedText('字'.repeat(100), 10, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });
});

describe('buildOgCardSvg', () => {
  it('produces a 1200x630 SVG with escaped text', () => {
    const svg = buildOgCardSvg({
      eyebrow: 'Liuliming',
      title: 'A & B <tags>',
      subtitle: 'Subtitle',
      footer: 'Footer'
    });

    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain('A &amp; B &lt;tags&gt;');
    expect(svg).not.toContain('<tags>');
  });
});
