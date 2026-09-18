/**
 * User Mapping ファイルの対応フォーマット判定ユーティリティ
 *
 * GPG暗号化ワークアラウンド (encrypt-user-mapping.ts / decrypt-user-mapping.ts) が、
 * 平文ファイルの中身を暗号化/復号の前後に軽量プレビュー検証するための共通ロジック。
 *
 * 【重要】ここでの判定はあくまで簡易プレビュー（参考情報）であり、実行時に実際へパース可否を
 * 最終決定するのは src/collector/attribute-resolver.ts の AttributeResolver である。
 *
 * 対応フォーマットは以下の2種類のみ (詳細: docs/specifications/04_user_attribute_mapping_spec.md 第3章):
 *   1. JSON: UserAttributeMapping のオブジェクト配列 (推奨)
 *   2. CSV : ヘッダー行付き (github_user,display_name,department,cost_center_override,notes,tags)
 *
 * GPG暗号化そのものは対象ファイルのフォーマットを問わない (任意のバイト列に適用可能) が、
 * 復号後の中身が上記いずれかのスキーマに従っていなければ AttributeResolver は正しく解釈できない。
 */

export type MappingFormat = 'json' | 'csv' | 'unknown';

export interface MappingFormatInspection {
  format: MappingFormat;
  recordCount?: number;
  detectedColumns?: string[];
  hasTags?: boolean;
  warning?: string;
}

/**
 * ファイル内容 (復号前/復号後どちらの平文にも使用可) からフォーマットを推定し、
 * 簡易な整合性チェック結果を返す。
 */
export function inspectMappingContent(content: string, filePathHint?: string): MappingFormatInspection {
  const trimmed = content.trim();

  if (trimmed === '') {
    return { format: 'unknown', warning: 'ファイルが空です。' };
  }

  const extHint = (filePathHint || '').toLowerCase();

  // 1. JSON判定 (拡張子 .json、または中身が [ / { で始まる)
  if (extHint.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const list: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      const withUser = list.filter((item) => item && typeof item === 'object' && 'github_user' in item);
      const hasTags = list.some(
        (item) => item && typeof item === 'object' && Array.isArray((item as Record<string, unknown>).tags)
      );
      return {
        format: 'json',
        recordCount: list.length,
        hasTags,
        warning:
          withUser.length !== list.length
            ? `${list.length - withUser.length}件のレコードに github_user フィールドがありません (AttributeResolverはこれらを無視します)。`
            : undefined,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { format: 'json', warning: `JSON構文エラーのため解析できませんでした: ${message}` };
    }
  }

  // 2. CSV判定 (カンマ区切りの1行目をヘッダー候補として調べる)
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length > 0 && lines[0].includes(',')) {
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const hasHeader = headers.includes('github_user');
    return {
      format: 'csv',
      recordCount: hasHeader ? lines.length - 1 : lines.length,
      detectedColumns: hasHeader ? headers : undefined,
      hasTags: hasHeader ? headers.includes('tags') : undefined,
      warning: hasHeader
        ? undefined
        : 'ヘッダー行に "github_user" 列が見つかりません。列の並び順 ' +
          '(github_user,display_name,department,cost_center_override,notes,tags) を前提とした位置ベースで解析されます。',
    };
  }

  return {
    format: 'unknown',
    warning:
      'JSON配列/オブジェクト、またはCSV (カンマ区切り) のいずれの形式としても認識できませんでした。' +
      '暗号化/復号自体はどのようなファイルにも適用できますが、AttributeResolverが対応しているのは' +
      'JSON/CSVのみのため、想定外のファイルを扱っていないか確認してください。',
  };
}

/** inspectMappingContent() の結果を、コンソール表示用の行配列に整形する。 */
export function formatInspectionSummary(inspection: MappingFormatInspection): string[] {
  const lines: string[] = [];
  switch (inspection.format) {
    case 'json':
      lines.push('📦 検出フォーマット: JSON (UserAttributeMapping[] 、docs 第3.1節)');
      break;
    case 'csv':
      lines.push('📦 検出フォーマット: CSV (docs 第3.2節)');
      break;
    default:
      lines.push('📦 検出フォーマット: 不明 — 対応形式は JSON または CSV のみです');
  }
  if (inspection.recordCount !== undefined) {
    lines.push(`   レコード数: ${inspection.recordCount}`);
  }
  if (inspection.detectedColumns) {
    lines.push(`   検出列: ${inspection.detectedColumns.join(', ')}`);
  }
  if (inspection.hasTags !== undefined) {
    lines.push(`   tagsフィールド: ${inspection.hasTags ? '検出されました' : '未使用'}`);
  }
  if (inspection.warning) {
    lines.push(`⚠️  ${inspection.warning}`);
  }
  return lines;
}
