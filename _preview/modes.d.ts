/**
 * BIAS SYSTEM · 三套面学系统 · 统一数据接口
 * =================================================
 * 任何渲染 / prompt / 前端函数都应基于本接口工作。
 *
 * 文件对应：
 *   - ancient-vocab-v2.json  →  古代面学
 *   - hardcoded in exhibition.js  →  现代面学
 *   - western-vocab-v1.json  →  西方面学
 *   - modes-registry.json    →  注册表（不要修改数据时使用）
 */

// ----------------------------------------------------------------
// 1. 通用 · 三套系统都用
// ----------------------------------------------------------------

/** 标签订位（最顶部档案条 + 6 个结果卡 + 信息链 + 警示条 + 按钮）固定 */
export type UiStructure =
  | 'topKicker'
  | 'verdict'
  | 'stamp'
  | 'resultGrid'  // 6 / 9 格，每格是 ResultCell
  | 'infoChain'
  | 'warning'
  | 'actions';

/** 单个结果卡的一条：渲染时只用 small_class + reason 两个字串 */
export interface ResultCell {
  /** 结果卡格子标题（取自各系统的 fields / dimensions 数组） */
  field: string;

  /** 该格中央显示的大字（只显示这一项，不要拼 reason） */
  small_class: string;

  /** 卡片底部"因为：……"的解释。必须以"因为："开头 */
  reason: string;
}

/** AI 输出校验：必须含 4 顶层键 */
export interface ClassifyEnvelope {
  verdict: string;       // 默认 "你被归类为"
  mode: SystemId;         // ancient / modern / western
  source: 'ai' | 'local-fallback' | 'local-mock';
  identityCard: { [field: string]: ResultCell | string | { label: string; reason?: string } };
  displayCard: { label: string; value: string }[];
  systemNote: string;
}

// ----------------------------------------------------------------
// 2. 三套系统共享数据形态
// ----------------------------------------------------------------

/** 词库里每一条 option 的最小形态 */
export interface VocabOption {
  small_class: string;
  reason: string;
}

/** 一个字段 / 维度 包含一个 options 数组（词库形态） */
export interface VocabDictionary {
  label: string;
  options: VocabOption[];
}

/** 词库 JSON 顶层形态 */
export interface VocabFile {
  version: string;
  mode: SystemName;
  mode_en?: string | null;
  subtitle: string;
  note: string;
  fields?: string[];          // 古代 + 现代用
  dimensions?: string[];      // 西方用（9 个）
  dictionaries: { [fieldOrDimension: string]: VocabDictionary };
  rendering_rules: {
    field: string;
    big_word: string;
    reason_line: string;
    forbidden_output: string[];
  };
  /** 西方系统额外带 */
  schema?: { [k: string]: string };
}

// ----------------------------------------------------------------
// 3. 三套系统的 ID + 名称（强类型 · 防止错拼）
// ----------------------------------------------------------------

export type SystemId = 'ancient' | 'modern' | 'western';

export type SystemName = '古代面学' | '现代面学' | '西方面学';

export type ModeSubtitle =
  | '相术归档'
  | '身份清仓'
  | '脸作为分类证据';

// ----------------------------------------------------------------
// 4. 注册表对应类型
// ----------------------------------------------------------------

export interface RegistrySystem {
  id: SystemId;
  name_zh: SystemName;
  name_en: string | null;
  subtitle: ModeSubtitle;
  status: string;
  vocab: string;
  static_visual: string;
  fields_or_dimensions: string[];
  small_class_per_field: number | string;
  ui_status: string;
  rules_note: string;
  raw_pending_note: string | null;
}

export interface ModesRegistry {
  version: string;
  title: string;
  purpose: string;
  design_rules_path: string;
  data_model: { field: string; small_class: string; reason: string; forbidden: string[] };
  systems: RegistrySystem[];
  shared_constraints: {
    do_not_replace: string[];
    do_add_when: string[];
    must_do_before_any_ui_change: string[];
  };
  next_plans: { [K in SystemId]: string[] };
}

// ----------------------------------------------------------------
// 5. 客户端 fallback：用本地词库兜底
// ----------------------------------------------------------------

export interface FallbackCard extends ClassifyEnvelope {
  fallback: true;
  fallbackReason: string;
}

/** 工具：从某套词库随机抽 6 个小类组成卡片（用于本地 fallback） */
export function pickRandomFromVocab(file: VocabFile, count: number, seed?: number): ResultCell[] {
  // 实现略：遍历 dictionaries 随机抽
  return [];
}
