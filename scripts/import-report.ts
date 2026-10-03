#!/usr/bin/env tsx
import { formatCsvImportReport } from '../src/processor/csv-import-report-format.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ReportParser } from '../src/processor/report-parser.js';
import { AttributeResolver } from '../src/collector/attribute-resolver.js';
import { ForkSafeStorage } from '../src/storage/fork-safe-storage.js';

async function importReport() {
  console.log('=====================================================');
  console.log('📦 GitHub Copilot Monthly Usage Report Importer');
  console.log('=====================================================');

  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (args.length === 0) {
    console.error('❌ Usage: npm run report:import -- <path-to-csv> [YYYY-MM]');
    console.error('   Example: npm run report:import -- ./downloads/copilot-usage-2026-08.csv 2026-08');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), args[0]);
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: File not found at ${inputPath}`);
    process.exit(1);
  }

  // 匿名化モード (ANONYMIZE_USERS=true) では、実ユーザー名を含む元の CSV を保存・push しない。
  // 集計結果 (user_details のログイン名・表示名・部署は仮名化される) だけを保存する。
  const anonymizing = process.env.ANONYMIZE_USERS === 'true';

  const csvContent = fs.readFileSync(inputPath, 'utf-8');
  // new AttributeResolver() は ANONYMIZE_USERS=true のとき秘密鍵 (ANONYMIZE_SECRET) を必須とし、無ければ例外で停止する
  const parser = new ReportParser(new AttributeResolver());
  const { records, report: csvReport } = parser.parseRecordsWithReport(csvContent, path.basename(inputPath));
  for (const line of formatCsvImportReport(csvReport)) console.log(line);

  if (records.length === 0) {
    console.error(`❌ Error: ${csvReport.stop_reason ?? 'No valid usage records found in the provided CSV file.'}`);
    process.exit(1);
  }

  // 月の決定 (第2引数、またはファイル名、またはレコード内の最新日付から判定)
  let targetMonth = args[1];
  if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
    // レコードの日付から最頻値または最新を抽出
    const dates = records.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (dates.length > 0) {
      targetMonth = dates.sort().reverse()[0].substring(0, 7);
    } else {
      targetMonth = new Date().toISOString().substring(0, 7);
    }
  }

  const fileName = path.basename(inputPath);
  console.log(`📄 Target File: ${fileName} (${records.length} records parsed)`);
  console.log(`📅 Target Report Month: ${targetMonth}`);

  const storage = new ForkSafeStorage();

  // 1. ローカルリポジトリへの保存 (匿名化モードでは元の CSV を保存しない)
  if (anonymizing) {
    console.log(
      '🕶️  ANONYMIZE_USERS is enabled: the original CSV (real user names) is NOT saved. Only the pseudonymized aggregate is stored.'
    );
  } else {
    const savedPath = storage.saveRawReportFile(targetMonth, fileName, csvContent);
    console.log(`💾 Saved to local partition: ${savedPath}`);
  }

  // 2. 集計処理の実行
  const aggregated = parser.aggregate(records, targetMonth, fileName, 'persisted', {
    source_files: [fileName],
    records_total: records.length,
    duplicates_skipped: 0,
    csv_reports: [csvReport],
  });
  storage.saveProcessedReport(aggregated);
  console.log(`✅ Aggregated report generated: $${aggregated.overview.total_net_spend_usd} net spend.`);

  // 3. Git リモートの確認と copilot-data への反映オプション
  const pushToRemote = process.argv.includes('--push');
  if (pushToRemote && anonymizing) {
    console.warn(
      "⚠️ --push is ignored in anonymization mode: the original CSV (real user names) must not be committed to the 'copilot-data' branch."
    );
  } else if (pushToRemote) {
    try {
      console.log("🚀 Syncing to 'copilot-data' branch (Fork-Safe Protocol)...");
      const tempDir = fs.mkdtempSync(path.join(process.cwd(), '.tmp-import-'));
      const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();

      // copilot-data ブランチの取得または作成
      try {
        execSync(`git clone --branch copilot-data --single-branch --depth 1 "${remoteUrl}" "${tempDir}"`, {
          stdio: 'pipe',
        });
      } catch {
        execSync(`git init "${tempDir}"`, { stdio: 'pipe' });
        execSync(`git -C "${tempDir}" checkout --orphan copilot-data`, { stdio: 'pipe' });
        execSync(`git -C "${tempDir}" remote add origin "${remoteUrl}"`, { stdio: 'pipe' });
      }

      const destDir = path.join(tempDir, 'data', 'reports', 'monthly', targetMonth);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(inputPath, path.join(destDir, fileName));

      execSync(`git -C "${tempDir}" add data/`, { stdio: 'inherit' });
      execSync(
        `git -C "${tempDir}" commit -m "chore(report): import monthly usage report for ${targetMonth} [skip ci]"`,
        { stdio: 'inherit' }
      );
      execSync(`git -C "${tempDir}" push origin copilot-data`, { stdio: 'inherit' });

      // 一時ディレクトリのクリーンアップ
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`🎉 Successfully pushed monthly report to 'copilot-data' branch!`);
    } catch (e: any) {
      console.warn('⚠️ Notice: Could not automatically push to remote copilot-data branch:', e.message);
      console.log("ℹ️ The report has been saved locally. Run 'npm run pipeline:run' to update all scopes.");
    }
  } else {
    console.log("💡 Tip: To automatically commit & push to the 'copilot-data' branch, append '--push'.");
    console.log("ℹ️ Run 'npm run pipeline:run' to update index.json and build the dashboard.");
  }
  if (pushToRemote && anonymizing) {
    console.log("ℹ️ The pseudonymized aggregate was saved locally. Run 'npm run pipeline:run' to update all scopes.");
  }

  console.log('=====================================================');
}

importReport().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
