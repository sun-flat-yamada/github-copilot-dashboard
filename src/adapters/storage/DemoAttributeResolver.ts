import { AttributeResolverAdapter } from './AttributeResolverAdapter.js';
import { loadDemoUserMapping } from './DemoMappingLoader.js';

export class DemoAttributeResolver extends AttributeResolverAdapter {
  constructor() {
    const demoMappingStr = loadDemoUserMapping();
    super(demoMappingStr, false);
  }
}
