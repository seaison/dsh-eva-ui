#!/usr/bin/env node
/**
 * 从 lib/client.js 的 PALETTE 表生成 docs/TOKENS.md。
 *
 * 文档与实现同源：令牌表只有一份（client.js），这张表是导出物，
 * 所以不会出现「README 说的颜色和皮肤实际颜色不一致」这种漂移。
 *
 *   node tools/gen-tokens-doc.mjs          # 写 docs/TOKENS.md
 *   node tools/gen-tokens-doc.mjs --check  # 只校验，不写（CI 用）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "lib/client.js"), "utf8");

// 取出 PALETTE 对象字面量：从 `const PALETTE = {` 起，按大括号配平收尾。
const start = source.indexOf("const PALETTE = {");
if (start < 0) throw new Error("找不到 PALETTE 定义");
let depth = 0;
let end = -1;
for (let i = source.indexOf("{", start); i < source.length; i += 1) {
	if (source[i] === "{") depth += 1;
	else if (source[i] === "}") {
		depth -= 1;
		if (depth === 0) {
			end = i + 1;
			break;
		}
	}
}
if (end < 0) throw new Error("PALETTE 大括号不配平");

// 字面量里只有字符串和第二层 [light, dark] 数组，直接求值即可。
const PALETTE = new Function("return " + source.slice(source.indexOf("{", start), end))();

/** 家族名 = 别名去掉首段。用于分组，读起来更像设计规范。 */
const FAMILY_LABELS = {
	bg: "底色 / 表面层",
	border: "边框（橙色发丝线）",
	label: "文本层级",
	brand: "品牌色 = 主色",
	button: "按钮",
	interactive: "交互反馈",
	state: "状态语义",
	link: "链接",
	scrollbar: "滚动条",
	menu: "菜单",
	tooltip: "气泡提示",
	toast: "系统提示",
	switch: "开关",
	settings: "设置卡片",
	markdown: "Markdown / 代码",
	code: "代码差异",
	file: "文件差异",
	onboarding: "引导页",
	turn: "回合触发器",
};

const families = new Map();
for (const [alias, [light, dark]] of Object.entries(PALETTE)) {
	const family = alias.includes("-") ? alias.slice(0, alias.indexOf("-")) : alias;
	if (!families.has(family)) families.set(family, []);
	families.get(family).push([alias, light, dark]);
}

const lines = [
	"# 令牌对照表",
	"",
	"> 本文件由 `node tools/gen-tokens-doc.mjs` 从 [`lib/client.js`](../lib/client.js) 的 `PALETTE` 表生成，请勿手工编辑。",
	"",
	`插件共覆盖 **${Object.keys(PALETTE).length}** 个 \`--dsw-alias-*\` 令牌（DSH 客户端主题层共暴露 107 个别名令牌）。`,
	"未被覆盖的令牌保持 DSH 原值——原值通常已经足够中性，皮肤只在「语义需要换色」的地方下手。",
	"",
	"## 为什么是别名层",
	"",
	"`ctx.theme` 组合出的主题快照由 ui-layout 以 **inline style** 写到 `<body>` 上：",
	"",
	"```js",
	"body.style.setProperty(name, value)   // name = --dsw-alias-*，value = 当前色板解析值",
	"```",
	"",
	"inline style 的优先级高于任何样式表规则，所以第三方皮肤**不能**靠 CSS 覆盖 `--dsw-alias-*`，",
	"必须走 `ctx.theme.overrideTokens(source, tokens)` 让覆盖进入快照本身。本插件即按此实现。",
	"",
	"相应的，不在快照里的令牌（例如 `--dsw-radius-*`、`--dsw-focus-ring-width`）可以用普通 CSS 覆盖，",
	"它们由 `lib/client.js` 的 `SKIN_CSS` 处理。",
	"",
];

for (const [family, rows] of families) {
	lines.push(`## ${FAMILY_LABELS[family] ?? family}`, "");
	lines.push("| 令牌 | 浅色 | 深色 |", "| --- | --- | --- |");
	for (const [alias, light, dark] of rows) {
		lines.push(`| \`--dsw-alias-${alias}\` | \`${light}\` | \`${dark}\` |`);
	}
	lines.push("");
}

const output = lines.join("\n");
const target = join(root, "docs/TOKENS.md");

// ---------------------------------------------------------------- 调色板预览
/**
 * 生成 docs/palette.html：把同一份令牌表渲染成可视色卡。
 *
 * 为什么需要它：皮肤的效果只在真实 GUI 里才完整（令牌会被 ui-layout 写成
 * inline style）。色卡是「令牌本身长什么样」的可核对快照——改一个颜色就能
 * 立刻看到浅色/深色两侧的结果，而不必反复装卸载。
 */
const swatch = (label, entries) => {
	const rows = entries
		.map(([alias, light, dark]) => {
			const cell = (value, scheme) => {
				const text = String(value);
				const style = text.startsWith("#") || text.startsWith("rgb") || text.startsWith("color-mix")
					? `background:${text};`
					: `background:#8883;background-image:linear-gradient(45deg,#8884 25%,transparent 25%,transparent 75%,#8884 75%),linear-gradient(45deg,#8884 25%,transparent 25%,transparent 75%,#8884 75%);background-size:8px 8px;background-position:0 0,4px 4px;`;
				return `<td class="cell"><span class="chip" style="${style}"></span><code>${text}</code></td>`;
			};
			return `<tr><th><code>--dsw-alias-${alias}</code></th>${cell(light, "light")}${cell(dark, "dark")}</tr>`;
		})
		.join("\n");
	return `<section><h2>${label}</h2><table><thead><tr><th>令牌</th><th>浅色</th><th>深色</th></tr></thead><tbody>${rows}</tbody></table></section>`;
};

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>dsh-eva-magi-theme —— 令牌色卡</title>
<style>
  /* 色卡自己就用皮肤的语言来排：硬边、橙发丝线、等宽读数 */
  :root{ --ink:#e8e4dc; --bg:#08090a; --line:#ff7a1a3d; --accent:#ff6a00; }
  body{margin:0;padding:32px;background:var(--bg);color:var(--ink);
       font:13px/1.5 ui-monospace,"SF Mono",Menlo,monospace;font-variant-numeric:tabular-nums}
  h1{font-size:20px;letter-spacing:.24em;color:var(--accent);text-transform:uppercase;margin:0 0 6px}
  h2{font-size:13px;letter-spacing:.18em;color:var(--accent);text-transform:uppercase;
     border-top:2px solid var(--accent);padding-top:8px;margin:34px 0 10px}
  p.lede{color:#8d887e;margin:0 0 8px;max-width:70ch}
  table{border-collapse:collapse;width:100%}
  th,td{text-align:left;padding:3px 10px 3px 0;border-bottom:1px solid var(--line);vertical-align:middle}
  thead th{color:#6b675f;font-weight:400;letter-spacing:.14em;font-size:11px}
  tbody th{font-weight:400;color:#b8b3a8}
  code{font-size:11.5px}
  .cell{width:30%;white-space:nowrap}
  .chip{display:inline-block;width:26px;height:12px;border:1px solid var(--line);
        vertical-align:-2px;margin-right:8px}
</style></head><body>
<h1>EVA / MAGI 令牌色卡</h1>
<p class="lede">由 <code>node tools/gen-tokens-doc.mjs</code> 从 <code>lib/client.js</code> 生成，请勿手工编辑。
共 ${Object.keys(PALETTE).length} 个 <code>--dsw-alias-*</code> 令牌，这是 DSH 客户端主题层暴露的全部别名令牌。</p>
${[...families].map(([family, rows]) => swatch(FAMILY_LABELS[family] ?? family, rows)).join("\n")}
</body></html>
`;

if (process.argv.includes("--check")) {
	const current = readFileSync(target, "utf8");
	if (current !== output) {
		console.error("docs/TOKENS.md 与 lib/client.js 不一致，请运行 node tools/gen-tokens-doc.mjs");
		process.exit(1);
	}
	console.log("docs/TOKENS.md 与实现一致");
} else {
	writeFileSync(target, output);
	writeFileSync(join(root, "docs/palette.html"), html);
	console.log(`已写入 docs/TOKENS.md 与 docs/palette.html（${Object.keys(PALETTE).length} 个令牌）`);
}
