import { createViewRegistry } from './viewRegistry';
import type { ViewManifest } from './types';

// views/<id>/manifest.ts を自動収集する (Vite)。新ビューはフォルダを足すだけで登録される。
const modules = import.meta.glob<{ default: ViewManifest }>('./*/manifest.ts', { eager: true });

export const defaultViewRegistry = createViewRegistry(Object.values(modules).map((m) => m.default));
