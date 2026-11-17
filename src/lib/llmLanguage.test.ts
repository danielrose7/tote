import { describe, expect, it } from 'vitest';
import { outputLanguageDirective } from './llmLanguage';

describe('outputLanguageDirective', () => {
  it('leaves English, unknown and pseudo locales untouched', () => {
    for (const locale of ['en', 'xx', 'zz', '', null, undefined]) {
      expect(outputLanguageDirective(locale)).toBe('');
    }
  });
  it('asks for Spanish prose but protects schema fields', () => {
    const directive = outputLanguageDirective('es');
    expect(directive).toContain('Spanish');
    expect(directive).toContain('JSON keys');
  });
  it('asks for informal German', () => {
    expect(outputLanguageDirective('de')).toContain('German (informal "du")');
  });
});
