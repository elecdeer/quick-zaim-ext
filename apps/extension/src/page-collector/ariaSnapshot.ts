/**
 * Playwright の packages/injected/src/ariaSnapshot.ts を参考にした簡易版の
 * アクセシビリティツリー生成モジュール。LLM へのページ内容入力を目的としているため
 * Name Computation や ARIA 仕様の細部までは網羅していない。
 */

export type AriaState = {
  checked?: boolean | "mixed";
  expanded?: boolean;
  pressed?: boolean | "mixed";
  selected?: boolean;
  disabled?: boolean;
  level?: number;
};

export interface AriaNode {
  role: string;
  name?: string;
  value?: string;
  state?: AriaState;
  children: AriaNode[];
}

export interface SnapshotOptions {
  /** 走査するノード総数の上限。デフォルト 5000。 */
  maxNodes?: number;
}

const DEFAULT_MAX_NODES = 5000;
const NAME_MAX_LENGTH = 200;

const IMPLICIT_ROLE_MAP: Record<string, string> = {
  A: "link",
  ARTICLE: "article",
  ASIDE: "complementary",
  BUTTON: "button",
  DIALOG: "dialog",
  FIGURE: "figure",
  FOOTER: "contentinfo",
  FORM: "form",
  H1: "heading",
  H2: "heading",
  H3: "heading",
  H4: "heading",
  H5: "heading",
  H6: "heading",
  HEADER: "banner",
  HR: "separator",
  IMG: "img",
  LI: "listitem",
  MAIN: "main",
  NAV: "navigation",
  OL: "list",
  P: "paragraph",
  SECTION: "region",
  SELECT: "combobox",
  TABLE: "table",
  TBODY: "rowgroup",
  TD: "cell",
  TEXTAREA: "textbox",
  TFOOT: "rowgroup",
  TH: "columnheader",
  THEAD: "rowgroup",
  TR: "row",
  UL: "list",
};

const INPUT_TYPE_ROLE_MAP: Record<string, string> = {
  button: "button",
  checkbox: "checkbox",
  email: "textbox",
  number: "spinbutton",
  password: "textbox",
  radio: "radio",
  range: "slider",
  reset: "button",
  search: "searchbox",
  submit: "button",
  tel: "textbox",
  text: "textbox",
  url: "textbox",
};

const HEADING_LEVELS: Record<string, number> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6,
};

const BUTTON_LIKE_INPUT_TYPES = ["submit", "button", "reset"] as const;
const NAME_FROM_CONTENT_ROLES = [
  "button",
  "link",
  "heading",
  "listitem",
  "cell",
  "columnheader",
  "rowheader",
] as const;
const NO_VALUE_INPUT_TYPES = ["submit", "button", "reset", "checkbox", "radio", "file"] as const;

/**
 * 空白を 1 個に正規化し、両端をトリムする。
 */
const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, " ").trim();

/**
 * 名前を最大長で打ち切る。
 */
const truncateName = (text: string): string => {
  if (text.length <= NAME_MAX_LENGTH) return text;
  return `${text.slice(0, NAME_MAX_LENGTH)}…`;
};

/**
 * 要素が a11y 上スキップされるかを判定する。
 * 属性ベースで安価に判定し、必要な場合のみ getComputedStyle を呼ぶ。
 */
const isHidden = (element: Element): boolean => {
  if (element.hasAttribute("hidden")) return true;
  if (element.getAttribute("aria-hidden") === "true") return true;
  const inline = (element as HTMLElement).style;
  if (inline) {
    if (inline.display === "none") return true;
    if (inline.visibility === "hidden") return true;
  }
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style) return false;
  if (style.display === "none") return true;
  if (style.visibility === "hidden" || style.visibility === "collapse") return true;
  return false;
};

/**
 * 要素の ARIA ロールを解決する。明示 role が無ければ暗黙ロールを返す。
 */
const resolveRole = (element: Element): string => {
  const explicit = element.getAttribute("role");
  if (explicit) {
    const first = explicit.trim().split(/\s+/)[0];
    if (first) return first;
  }
  const tag = element.tagName;
  if (tag === "INPUT") {
    const type = ((element as HTMLInputElement).type || "text").toLowerCase();
    return INPUT_TYPE_ROLE_MAP[type] ?? "textbox";
  }
  if (tag === "A" && !element.hasAttribute("href")) {
    return "generic";
  }
  return IMPLICIT_ROLE_MAP[tag] ?? "generic";
};

/**
 * aria-labelledby が参照する要素群のテキストを連結する。
 */
const resolveLabelledBy = (element: Element): string | undefined => {
  const ids = element.getAttribute("aria-labelledby");
  if (!ids) return undefined;
  const doc = element.ownerDocument;
  const parts: string[] = [];
  for (const id of ids.trim().split(/\s+/)) {
    const ref = doc.getElementById(id);
    if (ref?.textContent) parts.push(ref.textContent);
  }
  if (parts.length === 0) return undefined;
  return normalizeWhitespace(parts.join(" "));
};

/**
 * フォームコントロールに紐づく label のテキストを取得する。
 */
const resolveLabelFor = (element: Element): string | undefined => {
  const id = element.getAttribute("id");
  if (id) {
    const escaped = (element.ownerDocument.defaultView?.CSS?.escape ?? ((v: string) => v))(id);
    const label = element.ownerDocument.querySelector(`label[for="${escaped}"]`);
    if (label?.textContent) return normalizeWhitespace(label.textContent);
  }
  const wrapping = element.closest("label");
  if (wrapping?.textContent) return normalizeWhitespace(wrapping.textContent);
  return undefined;
};

/**
 * 要素のアクセシブルネームを解決する（簡易版）。
 */
const resolveAccessibleName = (element: Element, role: string): string | undefined => {
  const labelledBy = resolveLabelledBy(element);
  if (labelledBy) return truncateName(labelledBy);

  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    const normalized = normalizeWhitespace(ariaLabel);
    if (normalized) return truncateName(normalized);
  }

  if (element.tagName === "IMG") {
    const alt = element.getAttribute("alt");
    if (alt !== null) return truncateName(normalizeWhitespace(alt));
  }

  if (element instanceof HTMLInputElement) {
    const type = (element.type || "text").toLowerCase();
    if ((BUTTON_LIKE_INPUT_TYPES as readonly string[]).includes(type) && element.value) {
      return truncateName(normalizeWhitespace(element.value));
    }
    const fromLabel = resolveLabelFor(element);
    if (fromLabel) return truncateName(fromLabel);
    const placeholder = element.getAttribute("placeholder");
    if (placeholder) return truncateName(normalizeWhitespace(placeholder));
    return undefined;
  }

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    const fromLabel = resolveLabelFor(element);
    if (fromLabel) return truncateName(fromLabel);
    return undefined;
  }

  if ((NAME_FROM_CONTENT_ROLES as readonly string[]).includes(role)) {
    const text = element.textContent;
    if (text) {
      const normalized = normalizeWhitespace(text);
      if (normalized) return truncateName(normalized);
    }
  }

  return undefined;
};

/**
 * 要素から状態属性を抽出する。
 */
const resolveState = (element: Element, role: string): AriaState | undefined => {
  const state: AriaState = {};

  const ariaChecked = element.getAttribute("aria-checked");
  if (ariaChecked === "true") state.checked = true;
  else if (ariaChecked === "false") state.checked = false;
  else if (ariaChecked === "mixed") state.checked = "mixed";
  else if (element instanceof HTMLInputElement) {
    const type = (element.type || "text").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      state.checked = element.checked;
    }
  }

  const ariaExpanded = element.getAttribute("aria-expanded");
  if (ariaExpanded === "true") state.expanded = true;
  else if (ariaExpanded === "false") state.expanded = false;

  const ariaPressed = element.getAttribute("aria-pressed");
  if (ariaPressed === "true") state.pressed = true;
  else if (ariaPressed === "false") state.pressed = false;
  else if (ariaPressed === "mixed") state.pressed = "mixed";

  const ariaSelected = element.getAttribute("aria-selected");
  if (ariaSelected === "true") state.selected = true;
  else if (ariaSelected === "false") state.selected = false;

  const ariaDisabled = element.getAttribute("aria-disabled");
  if (ariaDisabled === "true") {
    state.disabled = true;
  } else if (
    (element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement) &&
    element.disabled
  ) {
    state.disabled = true;
  }

  if (role === "heading") {
    const ariaLevel = element.getAttribute("aria-level");
    if (ariaLevel) {
      const n = Number.parseInt(ariaLevel, 10);
      if (Number.isFinite(n)) state.level = n;
    } else {
      const fromTag = HEADING_LEVELS[element.tagName];
      if (fromTag) state.level = fromTag;
    }
  }

  return Object.keys(state).length === 0 ? undefined : state;
};

/**
 * input/textarea の現在値を取得する。
 */
const resolveValue = (element: Element): string | undefined => {
  if (element instanceof HTMLInputElement) {
    const type = (element.type || "text").toLowerCase();
    if ((NO_VALUE_INPUT_TYPES as readonly string[]).includes(type)) return undefined;
    if (element.value) return normalizeWhitespace(element.value);
  }
  if (element instanceof HTMLTextAreaElement && element.value) {
    return normalizeWhitespace(element.value);
  }
  return undefined;
};

type WalkState = {
  remaining: number;
};

const buildNode = (element: Element, state: WalkState): AriaNode | "skip" | "exhausted" => {
  if (state.remaining <= 0) return "exhausted";
  if (isHidden(element)) return "skip";
  state.remaining--;

  const role = resolveRole(element);
  const name = resolveAccessibleName(element, role);
  const value = resolveValue(element);
  const ariaState = resolveState(element, role);

  const node: AriaNode = { role, children: [] };
  if (name) node.name = name;
  if (value !== undefined) node.value = value;
  if (ariaState) node.state = ariaState;

  for (let child = element.firstChild; child; child = child.nextSibling) {
    if (state.remaining <= 0) break;
    if (child.nodeType === Node.ELEMENT_NODE) {
      const built = buildNode(child as Element, state);
      if (built === "exhausted") break;
      if (built === "skip") continue;
      if (built.role === "generic" && !built.name && !built.value && !built.state) {
        node.children.push(...built.children);
      } else {
        node.children.push(built);
      }
    } else if (child.nodeType === Node.TEXT_NODE) {
      const raw = child.nodeValue ?? "";
      const normalized = normalizeWhitespace(raw);
      if (normalized) {
        node.children.push({ role: "text", name: truncateName(normalized), children: [] });
      }
    }
  }

  // 子テキストが name と完全一致する場合は冗長なので畳む（Playwright と同じ挙動）。
  if (
    node.name &&
    node.children.length === 1 &&
    node.children[0]?.role === "text" &&
    node.children[0].name === node.name
  ) {
    node.children = [];
  }

  return node;
};

/**
 * DOM ルートからアクセシビリティツリーを生成する。
 */
export const generateAriaTree = (root: Element, options?: SnapshotOptions): AriaNode => {
  const state: WalkState = { remaining: options?.maxNodes ?? DEFAULT_MAX_NODES };
  const built = buildNode(root, state);
  if (built === "skip" || built === "exhausted") {
    return { role: "generic", children: [] };
  }
  return built;
};

const escapeYamlString = (text: string): string => text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const formatStateAttributes = (state: AriaState): string => {
  const parts: string[] = [];
  if (state.level !== undefined) parts.push(`level=${state.level}`);
  if (state.checked !== undefined) parts.push(`checked=${state.checked}`);
  if (state.expanded !== undefined) parts.push(`expanded=${state.expanded}`);
  if (state.pressed !== undefined) parts.push(`pressed=${state.pressed}`);
  if (state.selected !== undefined) parts.push(`selected=${state.selected}`);
  if (state.disabled !== undefined) parts.push(`disabled=${state.disabled}`);
  return parts.length === 0 ? "" : ` [${parts.join(" ")}]`;
};

const renderNode = (node: AriaNode, indent: string, lines: string[]): void => {
  if (node.role === "text") {
    lines.push(`${indent}- text: ${node.name ?? ""}`);
    return;
  }

  const namePart = node.name ? ` "${escapeYamlString(node.name)}"` : "";
  const valuePart = node.value ? ` (value: "${escapeYamlString(node.value)}")` : "";
  const statePart = node.state ? formatStateAttributes(node.state) : "";

  if (node.children.length === 0) {
    lines.push(`${indent}- ${node.role}${namePart}${valuePart}${statePart}`);
    return;
  }

  lines.push(`${indent}- ${node.role}${namePart}${valuePart}${statePart}:`);
  const nextIndent = `${indent}  `;
  for (const child of node.children) {
    renderNode(child, nextIndent, lines);
  }
};

/**
 * AriaNode ツリーを Playwright 風の YAML ライクな文字列に整形する。
 */
export const renderAriaTree = (node: AriaNode): string => {
  const lines: string[] = [];
  renderNode(node, "", lines);
  return lines.join("\n");
};
