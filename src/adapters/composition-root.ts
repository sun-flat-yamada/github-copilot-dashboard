import { PipelineOrchestrator } from '../application/pipeline/PipelineOrchestrator.js';
import { ICopilotDataSource } from '../domain/ports/ICopilotDataSource.js';
import { IAttributeResolver } from '../domain/ports/IAttributeResolver.js';
import { IStorageWriter } from '../domain/ports/IStorageWriter.js';
import { GitHubApiCopilotDataSource } from './github-api/GitHubApiCopilotDataSource.js';
import { MockCopilotDataSource } from './github-api/MockCopilotDataSource.js';
import { AttributeResolverAdapter } from './storage/AttributeResolverAdapter.js';
import { DemoAttributeResolver } from './storage/DemoAttributeResolver.js';
import { ForkSafeStorageWriter } from './storage/ForkSafeStorageWriter.js';

export interface PipelineAppConfig {
  isMock?: boolean;
  enterprise?: string;
  orgs?: string[];
  mappingConfig?: string;
  anonymize?: boolean;
}

export function createPipelineApp(config: PipelineAppConfig = {}): PipelineOrchestrator {
  const isMock =
    config.isMock ??
    (process.argv.includes('--mock') || process.argv.includes('--demo') || process.env.MOCK_MODE === 'true');

  const dataSource: ICopilotDataSource = isMock
    ? new MockCopilotDataSource()
    : new GitHubApiCopilotDataSource({
        enterprise: config.enterprise,
        orgs: config.orgs,
      });

  const resolver: IAttributeResolver =
    isMock && !config.mappingConfig && !process.env.COPILOT_USER_MAPPING
      ? new DemoAttributeResolver()
      : new AttributeResolverAdapter(config.mappingConfig, config.anonymize);

  const storage: IStorageWriter = new ForkSafeStorageWriter({
    isDemo: isMock,
  });

  return new PipelineOrchestrator({
    dataSource,
    resolver,
    storage,
    isMock,
  });
}
