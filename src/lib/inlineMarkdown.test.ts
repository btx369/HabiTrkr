import { describe, expect, it } from 'vitest';
import { inlineToHtml } from './inlineMarkdown';
import { markdownToHtml, htmlToMarkdown } from './markdownConverter';

describe('inlineToHtml', () => {
  it('handles bold, italic and underline together', () => {
    expect(inlineToHtml('***__w__***')).toBe('<strong><em><u>w</u></em></strong>');
    expect(inlineToHtml('**a *b***')).toBe('<strong>a <em>b</em></strong>');
    expect(inlineToHtml('*a **b***')).toBe('<em>a <strong>b</strong></em>');
  });
  it('keeps lone delimiters as text', () => {
    expect(inlineToHtml('2 * 3 * 4')).toBe('2 * 3 * 4');
    expect(inlineToHtml('**open')).toBe('**open');
  });
  it('round-trips through the editor converters', () => {
    const md = 'x ***__w__*** y **b** *i* __u__';
    expect(htmlToMarkdown(markdownToHtml(md))).toContain('w');
    expect(markdownToHtml('## **t**')).toBe('<h2><strong>t</strong></h2>');
  });
});
