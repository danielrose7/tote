import { describe, expect, it } from 'vitest';
import { parseJson } from './parseJson';

describe('parseJson', () => {
  describe('plain JSON', () => {
    it('parses a plain object', () => {
      expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    });

    it('parses a plain array', () => {
      expect(parseJson('[1,2,3]')).toEqual([1, 2, 3]);
    });

    it('handles leading/trailing whitespace', () => {
      expect(parseJson('  {"a":1}  ')).toEqual({ a: 1 });
    });

    it('parses nested objects', () => {
      expect(parseJson('{"a":{"b":2}}')).toEqual({ a: { b: 2 } });
    });
  });

  describe('code fence stripping', () => {
    it('strips ```json fence', () => {
      expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    it('strips plain ``` fence', () => {
      expect(parseJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    it('strips fence with text before it (Haiku preamble pattern)', () => {
      expect(parseJson('Here is the result:\n```json\n{"a":1}\n```')).toEqual({
        a: 1,
      });
    });

    it('strips fence with text after it', () => {
      expect(parseJson('```json\n{"a":1}\n```\nHope that helps!')).toEqual({
        a: 1,
      });
    });

    it('strips fence with text both before and after', () => {
      expect(
        parseJson(
          'Sure!\n```json\n{"a":1}\n```\nLet me know if you need more.',
        ),
      ).toEqual({ a: 1 });
    });

    it('handles uppercase JSON in fence tag', () => {
      expect(parseJson('```JSON\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    it('handles array inside fence', () => {
      expect(parseJson('```json\n[1,2,3]\n```')).toEqual([1, 2, 3]);
    });
  });

  describe('prose extraction fallback', () => {
    it('extracts object from preamble text (no fence)', () => {
      expect(parseJson('Here is your data:\n{"a":1}')).toEqual({ a: 1 });
    });

    it('extracts object when trailing text follows', () => {
      expect(parseJson('{"a":1}\nNote: this is the result.')).toEqual({ a: 1 });
    });

    it('extracts array from preamble text', () => {
      expect(parseJson('The questions are:\n[{"id":"q1"}]')).toEqual([
        { id: 'q1' },
      ]);
    });

    it('prefers object over array when object comes first', () => {
      const result = parseJson<{ urls: string[] }>('{"urls":["a","b"]}');
      expect(result?.urls).toEqual(['a', 'b']);
    });
  });

  describe('real LLM failure patterns', () => {
    it('handles classification response with preamble', () => {
      const text =
        'Based on the topic, I classify this as:\n```json\n{"type":"gift","signals":["for my mom"]}\n```';
      expect(parseJson(text)).toEqual({
        type: 'gift',
        signals: ['for my mom'],
      });
    });

    it('handles url discovery response with trailing explanation', () => {
      const text =
        '{ "urls": ["https://example.com/product"] }\n\nThese are the best matches I found.';
      expect(parseJson(text)).toEqual({
        urls: ['https://example.com/product'],
      });
    });

    it('handles multi-line JSON object', () => {
      const text = `{
  "type": "apparel",
  "signals": ["running clothes", "women's"]
}`;
      expect(parseJson(text)).toEqual({
        type: 'apparel',
        signals: ['running clothes', "women's"],
      });
    });
  });

  describe('null cases', () => {
    it('returns null for empty string', () => {
      expect(parseJson('')).toBeNull();
    });

    it('returns null for plain text with no JSON', () => {
      expect(parseJson('no json here')).toBeNull();
    });

    it('returns null for malformed JSON', () => {
      expect(parseJson('{bad json}')).toBeNull();
    });

    it('returns null for incomplete JSON', () => {
      expect(parseJson('{"a": 1')).toBeNull();
    });
  });
});
