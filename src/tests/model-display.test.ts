import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { MODEL_DISPLAY, getModelDisplay } from '../../dashboard/src/utils/modelDisplay.js';
import { MODEL_CATALOG } from '../processor/model-catalog.js';

describe('model display (#270)', () => {
  it('knows the latest models and keeps a readable name', () => {
    for (const id of ['gpt-6-astra', 'claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5', 'gpt-5-4-mini', 'gemini-3-8-flash']) {
      assert.ok(MODEL_DISPLAY[id], id);
      assert.ok(MODEL_CATALOG.some((m) => m.id === id), `${id} is in the model catalog`);
    }
  });

  it('gives an unknown model a stable fallback color and its id as the name', () => {
    const a = getModelDisplay('some-future-model');
    assert.equal(a.name, 'some-future-model');
    assert.match(a.color, /^#[0-9a-f]{6}$/);
    assert.equal(getModelDisplay('some-future-model').color, a.color);
  });
});
