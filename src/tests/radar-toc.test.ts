import test from 'node:test';
import assert from 'node:assert';
import { RADAR_SECTIONS } from '../../dashboard/src/components/RadarTableOfContents.js';

test('AI Model Radar Table of Contents Definition Tests', async (t) => {
  await t.test('defines all 6 page category sections with sequential numbering', () => {
    assert.strictEqual(RADAR_SECTIONS.length, 6);

    const expectedIds = [
      'radar-overview',
      'radar-chart',
      'radar-detail',
      'radar-table',
      'radar-sources',
      'radar-references',
    ];

    RADAR_SECTIONS.forEach((section, index) => {
      assert.strictEqual(section.id, expectedIds[index]);
      assert.strictEqual(section.number, `0${index + 1}`);
      assert.ok(section.title.length > 0, `Section ${section.id} must have a title`);
      assert.ok(section.shortTitle.length > 0, `Section ${section.id} must have a shortTitle`);
      assert.ok(section.description.length > 0, `Section ${section.id} must have a description`);
      assert.ok(typeof section.icon === 'function' || typeof section.icon === 'object');
    });
  });

  await t.test('category IDs are unique and formatted cleanly for anchor navigation', () => {
    const ids = RADAR_SECTIONS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, 'Category IDs must be unique');

    ids.forEach((id) => {
      assert.match(id, /^radar-[a-z0-9-]+$/, `ID ${id} must follow radar- kebab-case convention`);
    });
  });
});
