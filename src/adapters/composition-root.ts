import { PipelineOrchestrator } from '../application/pipeline/PipelineOrchestrator.js';
import { ICopilotDataSource } from '../domain/ports/ICopilotDataSource.js';
import { IAttributeResolver } from '../domain/ports/IAttributeResolver.js';
import { GitHubApiCopilotDataSource } from './github-api/GitHubApiCopilotDataSource.js';
import { MockCopilotDataSource } from './github-api/MockCopilotDataSource.js';
import { AttributeResolverAdapter } from './storage/AttributeResolverAdapter.js';
import { DemoAttributeResolver } from './storage/DemoAttributeResolver.js';
import { ForkSafeStorageWriter } from './storage/ForkSafeStorageWriter.js';
import { RawApiFetcher } from './github-api/RawApiFetcher.js';
import { RawLandingStore } from './raw-landing/RawLandingStore.js';
import { RecordingFetcher } from './raw-landing/RecordingFetcher.js';
import { ReplayFetcher } from './raw-landing/ReplayFetcher.js';

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

  // 匿名化 (仮名化): 明示指定が無ければ環境変数 ANONYMIZE_USERS=true に従う。
  // 資格情報の解決・ワークフローからの結線はここ (Composition Root) に集約する。
  const anonymize = config.anonymize ?? process.env.ANONYMIZE_USERS === 'true';

  const storage = new ForkSafeStorageWriter({ isDemo: isMock });

  // Raw Landing (P1-2): ライブ収集の応答を Run Manifest 付きで不変保存し、再処理できるようにする。
  // 匿名化モードでは保存しない (Raw には実名のログイン名・氏名が含まれ、仮名化できないため)。
  let recorder: RecordingFetcher | undefined;
  let dataSource: ICopilotDataSource;
  let liveSource: GitHubApiCopilotDataSource | undefined;
  if (isMock) {
    dataSource = new MockCopilotDataSource();
  } else {
    let fetcher: RawApiFetcher | RecordingFetcher = new RawApiFetcher();
    if (anonymize) {
      console.log('🕶️  Raw landing is skipped in anonymization mode (raw API responses contain real logins and names).');
    } else {
      recorder = new RecordingFetcher(
        fetcher,
        new RawLandingStore(storage.getBaseDir()),
        RawLandingStore.newRunId()
      );
      fetcher = recorder;
    }
    liveSource = new GitHubApiCopilotDataSource({ fetcher, enterprise: config.enterprise, orgs: config.orgs });
    dataSource = liveSource;
  }

  const resolver: IAttributeResolver =
    isMock && !config.mappingConfig && !process.env.COPILOT_USER_MAPPING
      ? new DemoAttributeResolver()
      : new AttributeResolverAdapter(config.mappingConfig, anonymize);

  return new PipelineOrchestrator({
    dataSource,
    resolver,
    storage,
    isMock,
    anonymize,
    run:
      recorder && liveSource
        ? {
            runId: recorder.runId,
            finishLanding: () => recorder!.finish(liveSource!.getCollectionConfig()) !== null,
          }
        : undefined,
  });
}

export interface ReprocessAppConfig {
  /** 再生する run。省略時は最新の run */
  runId?: string;
  mappingConfig?: string;
  anonymize?: boolean;
}

/**
 * Raw Landing の記録から成果物を作り直す (`npm run pipeline:reprocess`)。
 * 通信はせず、収集時と同じ入力 (応答・スコープ・レポート日・API バージョン) で同じ取得処理と集計を通す。
 */
export function createReprocessApp(config: ReprocessAppConfig = {}): { orchestrator: PipelineOrchestrator; runId: string } {
  const storage = new ForkSafeStorageWriter({ isDemo: false });
  const store = new RawLandingStore(storage.getBaseDir());
  const runId = config.runId ?? store.latestRunId();
  if (!runId) {
    throw new Error(
      `No raw landing run found under ${store.root}. Run \`npm run pipeline:run\` first (raw landing is skipped in anonymization and mock modes).`
    );
  }
  const manifest = store.readManifest(runId);

  const anonymize = config.anonymize ?? process.env.ANONYMIZE_USERS === 'true';
  const dataSource = new GitHubApiCopilotDataSource({
    fetcher: new ReplayFetcher(manifest, store),
    enterprise: manifest.config.enterprise,
    orgs: manifest.config.orgs,
    reportDays: manifest.config.report_days,
  });
  const resolver: IAttributeResolver = new AttributeResolverAdapter(config.mappingConfig, anonymize);

  const orchestrator = new PipelineOrchestrator({
    dataSource,
    resolver,
    storage,
    isMock: false,
    anonymize,
    run: { runId, reprocessed: true, finishLanding: () => true },
  });
  return { orchestrator, runId };
}
