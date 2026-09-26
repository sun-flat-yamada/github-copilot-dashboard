import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { UserAttributeMappingV2, UserAttributeMappingDocumentV2 } from '../src/domain/entities/user-mapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export const DEFAULT_DEMO_MAPPING_PASSPHRASE = 'copilot-demo-secret-passphrase-2026';
export const DEMO_MAPPING_GPG_RELATIVE_PATH = 'fixtures/demo/copilot-user-mapping.demo.json.gpg';

/**
 * 2026 LTS DEMO データセット専用のユーザーマッピング一覧を生成 (v2.0 Schema)
 * (Live Metrics 85名 + Monthly Usage Report ユーザーを完全網羅)
 */
export function buildDemoUserMappings(): UserAttributeMappingV2[] {
  const mappings: UserAttributeMappingV2[] = [
    // Live Metrics 主要コアメンバー
    {
      github_user: 'taro-tanaka',
      display_name: '田中 太郎',
      department: 'コア決済基盤チーム',
      cost_center_override: 'FinTech-Division',
      teams: ['FinTech-Core', 'Backend-Guild'],
      projects: ['Payments-Gateway-V2', 'Settlement-Engine'],
      role: 'Staff Engineer',
      ai_credits_limit_monthly: 500,
      target_adoption_phase: 'multi_agent',
      target_acceptance_rate: 0.38,
      notes: 'リードエンジニア / 正社員',
      tags: ['正社員', 'リード', '決済'],
    },
    {
      github_user: 'hanako-suzuki',
      display_name: '鈴木 花子',
      department: 'LLM応用プロダクトG',
      cost_center_override: 'Research-and-AI',
      teams: ['AI-Research', 'LLM-Product'],
      projects: ['Autonomous-Agent-Platform'],
      role: 'Senior AI Researcher',
      ai_credits_limit_monthly: 1000,
      target_adoption_phase: 'multi_agent',
      target_acceptance_rate: 0.42,
      notes: 'AIリサーチャー / 正社員',
      tags: ['正社員', 'AI推進'],
    },
    {
      github_user: 'kenji-sato',
      display_name: '佐藤 健二',
      department: 'SRE & クラウド基盤部',
      cost_center_override: 'Cloud-Platform',
      teams: ['Cloud-SRE', 'Infra-Core'],
      projects: ['Global-K8s-Mesh'],
      role: 'Principal SRE',
      ai_credits_limit_monthly: 400,
      target_adoption_phase: 'agent_first',
      target_acceptance_rate: 0.32,
      notes: 'インフラSRE / 正社員',
      tags: ['正社員', 'SRE', 'インフラ'],
    },
    {
      github_user: 'yuki-takahashi',
      display_name: '高橋 悠希',
      department: 'モバイルアプリ開発部',
      cost_center_override: 'FinTech-Division',
      teams: ['Mobile-Core', 'iOS-Team'],
      projects: ['FinTech-App-Next'],
      role: 'Mobile Tech Lead',
      ai_credits_limit_monthly: 300,
      target_adoption_phase: 'code_first',
      target_acceptance_rate: 0.30,
      notes: 'iOS / Android Lead / 正社員',
      tags: ['正社員', 'モバイル'],
    },
    {
      github_user: 'mika-ito',
      display_name: '伊藤 美香',
      department: '業務システム改革推進室',
      cost_center_override: 'Enterprise-IT',
      teams: ['Internal-DX', 'Workflow-Automation'],
      projects: ['ERP-Modernization'],
      role: 'Senior DX Specialist',
      ai_credits_limit_monthly: 200,
      target_adoption_phase: 'agent_first',
      target_acceptance_rate: 0.28,
      notes: '社内DX担当 / 正社員',
      tags: ['正社員', '社内DX'],
    },
    {
      github_user: 'alex-partner',
      display_name: 'Alex Rivera (Partner)',
      department: 'コア決済基盤チーム',
      cost_center_override: 'FinTech-Division',
      teams: ['FinTech-Core'],
      projects: ['Payments-Gateway-V2'],
      role: 'External Specialist',
      ai_credits_limit_monthly: 150,
      target_adoption_phase: 'code_first',
      target_acceptance_rate: 0.35,
      notes: '業務委託パートナー / フルリモート',
      tags: ['業務委託', 'リモート', '決済'],
    },
    {
      github_user: 'daiki-yamada',
      display_name: '山田 大樹',
      department: 'SRE & クラウド基盤部',
      cost_center_override: 'Cloud-Platform',
      teams: ['Cloud-SRE'],
      projects: ['Global-K8s-Mesh'],
      role: 'Platform Engineer',
      ai_credits_limit_monthly: 350,
      target_adoption_phase: 'agent_first',
      target_acceptance_rate: 0.33,
      notes: 'Kubernetes Platformer / 正社員',
      tags: ['正社員', 'SRE', 'Kubernetes'],
    },

    // Monthly Usage Report 専用・重複ユーザー
    {
      github_user: 'yuki-tanaka',
      display_name: '田中 幸雄',
      department: 'コア決済基盤チーム',
      cost_center_override: 'FinTech-Division',
      notes: '決済APIエンジニア / 正社員',
      tags: ['正社員', '決済'],
    },
    {
      github_user: 'daiki-suzuki',
      display_name: '鈴木 大樹',
      department: 'クラウドインフラ統括部',
      cost_center_override: 'IT-Infrastructure',
      notes: 'クラウド基盤設計 / 正社員',
      tags: ['正社員', 'インフラ'],
    },
    {
      github_user: 'sakura-watanabe',
      display_name: '渡辺 さくら',
      department: 'IT運用管理部',
      cost_center_override: 'IT-Infrastructure',
      notes: '社内ITサービスデスク / 正社員',
      tags: ['正社員', '社内DX'],
    },
    {
      github_user: 'ren-takahashi',
      display_name: '高橋 蓮',
      department: 'マーケティングDX推進部',
      cost_center_override: 'Data-AI-Lab',
      notes: 'マーケティングアナリスト / 正社員',
      tags: ['正社員', 'AI推進'],
    },
    {
      github_user: 'mei-ito',
      display_name: '伊藤 芽依',
      department: 'データAI推進室',
      cost_center_override: 'Data-AI-Lab',
      notes: 'データサイエンティスト / 正社員',
      tags: ['正社員', 'AI推進'],
    },
    {
      github_user: 'kaito-nakamura',
      display_name: '中村 海斗',
      department: 'APIプラットフォーム部',
      cost_center_override: 'IT-Infrastructure',
      notes: 'バックエンドエンジニア / 正社員',
      tags: ['正社員', 'API'],
    },
    {
      github_user: 'aoi-kobayashi',
      display_name: '小林 葵',
      department: 'セキュリティ基盤部',
      cost_center_override: 'IT-Infrastructure',
      notes: 'セキュリティエンジニア / 正社員',
      tags: ['正社員', 'セキュリティ'],
    },
    {
      github_user: 'external-contractor-01',
      display_name: '外部パートナー 01',
      department: 'コア決済基盤チーム',
      cost_center_override: 'FinTech-Division',
      notes: '外部ベンダー委託 / リモート',
      tags: ['業務委託', 'リモート'],
    },
    {
      github_user: 'external-contractor-02',
      display_name: '外部パートナー 02',
      department: 'クラウドインフラ統括部',
      cost_center_override: 'FinTech-Division',
      notes: '外部ベンダー委託 / オンサイト',
      tags: ['業務委託'],
    },
  ];

  // developer-8 〜 developer-85 のマッピングを部署・CostCenterごとに体系的生成
  const deptTemplates = [
    {
      dept: 'コア決済基盤チーム',
      cc: 'FinTech-Division',
      tags: ['正社員', '決済'],
      role: '決済バックエンド',
    },
    {
      dept: 'SRE & クラウド基盤部',
      cc: 'Cloud-Platform',
      tags: ['正社員', 'SRE'],
      role: 'SREエンジニア',
    },
    {
      dept: 'LLM応用プロダクトG',
      cc: 'Research-and-AI',
      tags: ['正社員', 'AI推進'],
      role: 'AIエンジニア',
    },
    {
      dept: 'モバイルアプリ開発部',
      cc: 'FinTech-Division',
      tags: ['正社員', 'モバイル'],
      role: 'クライアント開発',
    },
    {
      dept: '業務システム改革推進室',
      cc: 'Enterprise-IT',
      tags: ['正社員', '社内DX'],
      role: '社内業務システム',
    },
    {
      dept: 'フロントエンド基盤G',
      cc: 'FinTech-Division',
      tags: ['正社員', 'リモート'],
      role: 'Webフロントエンド',
    },
    {
      dept: 'データエンジニアリング部',
      cc: 'Research-and-AI',
      tags: ['正社員', 'データ基盤'],
      role: 'データパイプライン',
    },
  ];

  const firstNames = ['健太', '拓也', '翔太', '大輔', '直樹', '陽介', '真一', '剛', '修', '亮'];
  const lastNames = ['加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水', '山崎', '森', '池田', '橋本'];

  for (let i = 8; i <= 85; i++) {
    const isContractor = i % 5 === 0;
    const tpl = deptTemplates[(i - 8) % deptTemplates.length];
    const lastName = lastNames[(i * 3) % lastNames.length];
    const firstName = firstNames[(i * 7) % firstNames.length];
    const phaseOptions: ('code_first' | 'agent_first' | 'multi_agent' | 'no_cohort')[] = [
      'code_first',
      'code_first',
      'agent_first',
      'multi_agent',
    ];
    const targetPhase = phaseOptions[i % phaseOptions.length];

    mappings.push({
      github_user: `developer-${i}`,
      display_name: isContractor ? `${lastName} ${firstName} (Partner)` : `${lastName} ${firstName}`,
      department: tpl.dept,
      cost_center_override: tpl.cc,
      teams: [tpl.dept.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'Dev-Team'],
      projects: [`Project-${(i % 5) + 1}`],
      role: tpl.role,
      ai_credits_limit_monthly: isContractor ? 100 : 250,
      target_adoption_phase: targetPhase,
      target_acceptance_rate: 0.32,
      notes: isContractor ? `業務委託パートナー / ${tpl.role}` : `${tpl.role} / 正社員`,
      tags: isContractor ? ['業務委託', ...tpl.tags.filter((t) => t !== '正社員')] : tpl.tags,
    });
  }

  return mappings;
}

/**
 * GPG暗号化ファイル (AES256) を生成 (v2.0 Schema)
 */
export function generateDemoMappingGpg(
  outputPath?: string,
  passphrase: string = process.env.COPILOT_DEMO_MAPPING_PASSPHRASE || DEFAULT_DEMO_MAPPING_PASSPHRASE
): string {
  const targetPath = outputPath || path.resolve(projectRoot, DEMO_MAPPING_GPG_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  const tempJsonPath = path.join(os.tmpdir(), `copilot-user-mapping.demo-${Date.now()}.json`);
  const mappings = buildDemoUserMappings();

  try {
    const envelope: UserAttributeMappingDocumentV2 = {
      schema_version: '2.0',
      generated_at: new Date().toISOString(),
      description: 'GitHub Copilot Enterprise User Attribute Mapping (v2.0 Schema / 2026 LTS)',
      mappings,
    };
    fs.writeFileSync(tempJsonPath, JSON.stringify(envelope, null, 2), 'utf-8');

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }

    const gpgResult = spawnSync(
      'gpg',
      [
        '--batch',
        '--yes',
        '--pinentry-mode',
        'loopback',
        '--passphrase-fd',
        '0',
        '--symmetric',
        '--cipher-algo',
        'AES256',
        '-o',
        targetPath,
        tempJsonPath,
      ],
      {
        input: passphrase,
        stdio: ['pipe', 'inherit', 'inherit'],
      }
    );

    if (gpgResult.error || gpgResult.status !== 0 || !fs.existsSync(targetPath)) {
      throw new Error(`Failed to GPG-encrypt DEMO user mapping: ${gpgResult.error?.message || 'Exit code ' + gpgResult.status}`);
    }

    console.log(`🔐 Generated GPG-encrypted DEMO user mapping at: ${targetPath} (${mappings.length} users)`);
    return targetPath;
  } finally {
    if (fs.existsSync(tempJsonPath)) {
      fs.unlinkSync(tempJsonPath);
    }
  }
}

// CLI 直接実行時
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const out = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : undefined;
  generateDemoMappingGpg(out);
}
