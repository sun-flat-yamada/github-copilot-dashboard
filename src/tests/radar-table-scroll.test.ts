import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_RADAR_MODEL_COL_WIDTH,
  MIN_RADAR_MODEL_COL_WIDTH,
  MAX_RADAR_MODEL_COL_WIDTH,
  RADAR_MODEL_PINNED_WIDTH_STORAGE_KEY,
} from '../../dashboard/src/components/ModelRadarView';

test('AI Model Radar Benchmark Table Horizontal Scroll and Pinned Column Tests', async (t) => {
  const viewFilePath = path.resolve(process.cwd(), 'dashboard/src/components/ModelRadarView.tsx');
  assert.ok(fs.existsSync(viewFilePath), 'ModelRadarView.tsx must exist');
  const content = fs.readFileSync(viewFilePath, 'utf-8');

  await t.test('verifies pinned column width constants', () => {
    assert.strictEqual(DEFAULT_RADAR_MODEL_COL_WIDTH, 220, 'Default pinned column width should be 220px');
    assert.strictEqual(MIN_RADAR_MODEL_COL_WIDTH, 120, 'Min pinned column width should be 120px');
    assert.strictEqual(MAX_RADAR_MODEL_COL_WIDTH, 500, 'Max pinned column width should be 500px');
    assert.strictEqual(
      RADAR_MODEL_PINNED_WIDTH_STORAGE_KEY,
      'copilot-dashboard:radar-model-pinned-width',
      'Storage key should match convention'
    );
  });

  await t.test('verifies scroll state management and handlers in ModelRadarView', () => {
    assert.ok(content.includes('tableContainerRef = useRef<HTMLDivElement>(null)'), 'Must define tableContainerRef');
    assert.ok(content.includes('scrollState, setScrollState'), 'Must manage scrollState');
    assert.ok(content.includes('updateScrollState = useCallback'), 'Must define updateScrollState callback');
    assert.ok(content.includes('scrollTable = (direction: \'left\' | \'right\')'), 'Must define scrollTable helper');
    assert.ok(content.includes('handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>)'), 'Must define handleSliderChange helper');
  });

  await t.test('verifies upper horizontal scroll navigation buttons', () => {
    assert.ok(content.includes("scrollTable('left')"), 'Must have scroll left handler call');
    assert.ok(content.includes("scrollTable('right')"), 'Must have scroll right handler call');
    assert.ok(content.includes('disabled={!scrollState.canScrollLeft}'), 'Must bind disabled state to canScrollLeft');
    assert.ok(content.includes('disabled={!scrollState.canScrollRight}'), 'Must bind disabled state to canScrollRight');
  });

  await t.test('verifies sticky model column implementation', () => {
    // Header (th) pinned to top and left
    assert.ok(
      content.includes('sticky top-0 left-0 z-30 bg-slate-950'),
      'Model column header must be sticky top and left with highest z-index (z-30)'
    );
    // Body (td) pinned to left
    assert.ok(
      content.includes('sticky left-0 z-10'),
      'Model column data cell must be sticky left (z-10)'
    );
    // Right border and shadow divider
    assert.ok(
      content.includes('border-r border-slate-700/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.5)]'),
      'Pinned column must have border and shadow divider'
    );
    // Non-transparent background for pinned column
    assert.ok(
      content.includes('bg-slate-900 group-hover:bg-slate-800/90'),
      'Pinned column data cell must have solid background to prevent transparency when scrolled'
    );
  });

  await t.test('verifies column resize handle and accessibility', () => {
    assert.ok(content.includes('handleResizeStart'), 'Must provide resize start handler');
    assert.ok(content.includes('handleResetWidth'), 'Must provide double-click reset handler');
    assert.ok(content.includes('handleResizeKeyDown'), 'Must provide keyboard accessibility for resizing');
    assert.ok(content.includes('cursor-col-resize'), 'Must have col-resize cursor class');
  });

  await t.test('verifies bottom sticky scroll progress controller', () => {
    assert.ok(content.includes('scrollState.scrollWidth > scrollState.clientWidth'), 'Must render bottom bar conditionally');
    assert.ok(content.includes('sticky bottom-0 z-20'), 'Bottom bar must be sticky bottom with z-20');
    assert.ok(content.includes('type="range"'), 'Must render range slider');
    assert.ok(content.includes('Math.round(scrollState.progress)'), 'Must render progress percentage');
  });
});
