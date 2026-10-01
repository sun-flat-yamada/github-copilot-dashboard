import type * as NodeCrypto from 'node:crypto';
import { AssigningTeam, CopilotSeatAssignment, EnterpriseCostCenter } from '../types/copilot.js';

/**
 * 匿名化 (仮名化) モードで使う、秘密鍵付きの決定的な仮名生成 (HMAC-SHA256)。
 *
 * 旧実装は 32 ビットの非暗号学的ハッシュ (秘密鍵なし) で、GitHub のログイン名を辞書照合すれば
 * 全員分を復元できた。秘密鍵 (ANONYMIZE_SECRET) を知らない第三者は、仮名から元の値を復元できない。
 *
 * - 同じ入力 (と同じ鍵) からは常に同じ仮名になる (月をまたいだ推移・突合のため)
 * - 鍵を変更すると仮名はすべて変わる (過去に公開した仮名との対応が切れる)
 * - 種別 (login / name / department ...) ごとにドメイン分離し、別種別の仮名同士から関連を推測できない
 * - 鍵の値は例外メッセージ・ログに出さない
 */

export const ANONYMIZE_SECRET_ENV = 'ANONYMIZE_SECRET';

/** 鍵の最小長。短い鍵は総当たりで推測されうる */
export const MIN_ANONYMIZE_SECRET_LENGTH = 16;

export type PseudonymKind = 'login' | 'name' | 'department' | 'team' | 'project';

/**
 * node:crypto はブラウザ向けバンドルに静的 import で含めない (このモジュールは CSV 取り込み用の ReportParser →
 * AttributeResolver 経由でブラウザにも入るが、仮名化はパイプライン (Node) でしか使わない)。
 * process.getBuiltinModule は Node 22.3 以降で同期的に組み込みモジュールを取得できる。
 */
function loadNodeCrypto(): typeof NodeCrypto {
  const loaded =
    typeof process !== 'undefined' && typeof process.getBuiltinModule === 'function'
      ? process.getBuiltinModule('node:crypto')
      : undefined;
  if (!loaded) {
    throw new PseudonymizationConfigError('Pseudonymization requires a Node.js runtime (node:crypto is not available here).');
  }
  return loaded;
}

export class PseudonymizationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PseudonymizationConfigError';
  }
}

export class Pseudonymizer {
  private readonly secret: string;

  /**
   * @param secret 秘密鍵 (ANONYMIZE_SECRET)。未設定・短すぎる場合は例外 (匿名化を名乗りながら
   *               復元可能な出力を発行しない = fail closed)
   */
  constructor(secret: string | undefined) {
    const trimmed = (secret ?? '').trim();
    if (trimmed.length < MIN_ANONYMIZE_SECRET_LENGTH) {
      throw new PseudonymizationConfigError(
        `ANONYMIZE_USERS is enabled but ${ANONYMIZE_SECRET_ENV} is ${trimmed.length === 0 ? 'not set' : 'too short'}. ` +
          `Set ${ANONYMIZE_SECRET_ENV} to a random secret of at least ${MIN_ANONYMIZE_SECRET_LENGTH} characters ` +
          `(e.g. \`openssl rand -hex 32\`) as a secret / environment variable. ` +
          'Without a secret key, pseudonyms can be reversed by a dictionary of GitHub logins, so nothing is published.'
      );
    }
    this.secret = trimmed;
  }

  /** 環境変数 ANONYMIZE_SECRET から生成する (未設定・短すぎる場合は例外) */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): Pseudonymizer {
    return new Pseudonymizer(env[ANONYMIZE_SECRET_ENV]);
  }

  /** HMAC-SHA256(secret, `${kind}\0${正規化した値}`) の先頭 hexLength 文字 (hex) */
  private digest(kind: PseudonymKind, value: string, hexLength: number): string {
    return loadNodeCrypto()
      .createHmac('sha256', this.secret)
      .update(`${kind}\u0000${value.trim().toLowerCase()}`)
      .digest('hex')
      .slice(0, hexLength);
  }

  /** GitHub ログイン名の仮名 (64 ビット分。衝突は実用上起こらない) */
  login(login: string): string {
    return `dev_${this.digest('login', login, 16)}`;
  }

  /** 表示名の仮名 (表示用。ログイン名と同じ鍵から導出するが、別のドメイン) */
  displayName(login: string): string {
    return `User-${this.digest('name', login, 8)}`;
  }

  department(department: string): string {
    return `Group-${this.digest('department', department, 8)}`;
  }

  team(team: string): string {
    return `Team-${this.digest('team', team, 8)}`;
  }

  project(project: string): string {
    return `Project-${this.digest('project', project, 8)}`;
  }

  /**
   * シート割り当て (Raw 保存用) から個人を特定できる識別子を除去する。
   * login は仮名に置き換え、数値ユーザー ID・アバター URL・プロフィール URL は除去 (固定値) する。
   * 数値の GitHub ユーザー ID は avatar_url にも含まれ、公開 API で本人に直接解決できる。
   */
  redactSeat(seat: CopilotSeatAssignment): CopilotSeatAssignment {
    const redactTeam = (team: AssigningTeam): AssigningTeam => ({
      id: 0,
      name: this.team(team.name),
      slug: this.team(team.slug),
    });
    return {
      ...seat,
      assignee: {
        login: this.login(seat.assignee.login),
        id: 0,
        avatar_url: '',
        html_url: '',
        type: seat.assignee.type,
      },
      ...(seat.assigning_team ? { assigning_team: redactTeam(seat.assigning_team) } : {}),
      ...(seat.assigning_teams ? { assigning_teams: seat.assigning_teams.map(redactTeam) } : {}),
    };
  }

  /** Cost Center のリソース (種別 User の login) を仮名に置き換える (Raw 保存用) */
  redactCostCenter(costCenter: EnterpriseCostCenter): EnterpriseCostCenter {
    return {
      ...costCenter,
      resources: costCenter.resources.map((r) =>
        r.type === 'User' ? { ...r, name: this.login(r.name) } : r
      ),
    };
  }
}
