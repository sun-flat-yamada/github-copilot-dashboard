import { JSDOM } from 'jsdom';

/**
 * React Testing Library 用の jsdom 環境を node:test 上に用意する (P2-6)。
 *
 * このファイルは React / @testing-library を import するどのモジュールよりも先に import すること
 * (RTL は import 時に document を参照するため)。ES Module の import は記述順に評価される。
 */
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
for (const key of [
  'HTMLElement',
  'HTMLInputElement',
  'Element',
  'Node',
  'MouseEvent',
  'KeyboardEvent',
  'Event',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
]) {
  g[key] = (dom.window as unknown as Record<string, unknown>)[key];
}
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true });
g.IS_REACT_ACT_ENVIRONMENT = true;

// recharts / レイアウト系が参照する。jsdom には無い
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
g.ResizeObserver = ResizeObserverStub;
(dom.window as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
if (!dom.window.matchMedia) {
  (dom.window as unknown as Record<string, unknown>).matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
}

export { dom };

// React が非同期の状態更新に出す act() 警告は、waitFor / findBy で待っているこれらのテストでは雑音になる
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) return;
  originalConsoleError(...args);
};
