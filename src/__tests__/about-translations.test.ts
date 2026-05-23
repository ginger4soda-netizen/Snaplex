import { getTranslation } from '@/translations';
import { describe, expect, it } from 'vitest';

describe('translations.about.*', () => {
  for (const lang of ['English', 'Chinese']) {
    it(`${lang} has all about.* keys`, () => {
      const t = getTranslation(lang) as any;
      expect(t['about.section.feedback']).toBeTruthy();
      expect(t['about.section.website']).toBeTruthy();
      expect(t['about.section.guide']).toBeTruthy();
      expect(t['about.feedback.label']).toBeTruthy();
      expect(t['about.website.label']).toBeTruthy();
      expect(t['about.guide.label']).toBeTruthy();
      expect(t['about.author.label']).toBeTruthy();
      expect(t['about.author.x']).toBeTruthy();
      expect(t['about.license.value']).toBe('AGPL-3.0-or-later');
    });
  }
});
