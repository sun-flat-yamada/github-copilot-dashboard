import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

test('Layout Responsive Width Tests', async (t) => {
  const projectRoot = process.cwd();

  await t.test('verifies App.tsx main container has no max-w-7xl restriction and allows full width expansion', () => {
    const appFile = path.resolve(projectRoot, 'dashboard/src/App.tsx');
    assert.ok(fs.existsSync(appFile), 'App.tsx must exist');
    const content = fs.readFileSync(appFile, 'utf-8');

    // Ensure max-w-7xl is not restricting the main element
    assert.doesNotMatch(
      content,
      /<main[^>]*max-w-7xl/,
      'App.tsx <main> must not be constrained by max-w-7xl'
    );

    // Ensure main element has w-full and appropriate horizontal padding
    assert.match(
      content,
      /<main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col space-y-6"/,
      'App.tsx <main> must use full width responsive styling with proper padding'
    );
  });

  await t.test('verifies DashboardHeader.tsx container has no max-w-[1600px] restriction and matches main width', () => {
    const headerFile = path.resolve(projectRoot, 'dashboard/src/components/layout/DashboardHeader.tsx');
    assert.ok(fs.existsSync(headerFile), 'DashboardHeader.tsx must exist');
    const content = fs.readFileSync(headerFile, 'utf-8');

    assert.doesNotMatch(
      content,
      /max-w-\[1600px\]/,
      'DashboardHeader must not be restricted by max-w-[1600px]'
    );

    assert.match(
      content,
      /className="w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6"/,
      'DashboardHeader must use full width responsive container matching main padding'
    );
  });

  await t.test('verifies ViewNavigation.tsx container has no max-w-[1600px] restriction and matches main width', () => {
    const navFile = path.resolve(projectRoot, 'dashboard/src/components/layout/ViewNavigation.tsx');
    assert.ok(fs.existsSync(navFile), 'ViewNavigation.tsx must exist');
    const content = fs.readFileSync(navFile, 'utf-8');

    assert.doesNotMatch(
      content,
      /max-w-\[1600px\]/,
      'ViewNavigation must not be restricted by max-w-[1600px]'
    );

    assert.match(
      content,
      /className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto no-scrollbar"/,
      'ViewNavigation must use full width responsive container matching main padding'
    );
  });
});
