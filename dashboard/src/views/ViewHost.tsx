import React from 'react';
import { ViewSkeleton } from '../components/common/ViewSkeleton';
import type { ViewRegistry } from './viewRegistry';
import type { ViewContext } from './types';

interface ViewHostProps {
  registry: ViewRegistry;
  activeView: string;
  ctx: ViewContext;
}

/** アクティブなビューを Registry から解決して描画する唯一の入口 (遅延ロードは Suspense で吸収) */
export const ViewHost: React.FC<ViewHostProps> = ({ registry, activeView, ctx }) => {
  const manifest = registry.getVisible(ctx).find((m) => m.id === activeView);
  if (!manifest) return null;
  const Component = manifest.component;
  return (
    <React.Suspense fallback={<ViewSkeleton />}>
      <Component ctx={ctx} />
    </React.Suspense>
  );
};
