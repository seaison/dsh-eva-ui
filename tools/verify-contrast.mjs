#!/usr/bin/env node
/**
 * 颜色关系核对。
 *
 *   node tools/verify-contrast.mjs            # 判定，不合格则退出码 1
 *   node tools/verify-contrast.mjs --report   # 只打印全表，不判定
 *
 * 两项检查：
 *
 * A. **对比度**（WCAG 2.1）。EVA 那套配色（暗底 + 低饱和暖白 + 橙）很容易做出
 *    「看着对、读起来糊」的组合，而且暗底会让文字显得比实际更清楚，肉眼判断尤其
 *    不可靠。阈值：正文 4.5:1，大字与 UI 元件 3:1，说明文字 3:1。
 *
 * B. **极性**。官方色板里每个令牌在浅/深两套各有一个值，谁更亮是设计意图的一部分
 *    （底色、表面层级、边框、文字倒置……）。如果覆盖把某个令牌在浅色方案里弄得比
 *    深色方案还暗，就是把主题搞反了——这种错误截图上极其显眼、代码里却很难看出来。
 *    本机装了 DSH 时会逐条比对；没装则跳过 B。
 *
 *    只比对**不透明**令牌：半透明色的实际观感取决于它叠在什么底色上，拿它的原始
 *    RGB 通道去比亮度没有意义（皮肤里大量存在的那些 8 位十六进制"淡色底"就属于这类）。
 *    官方两侧等值的令牌（例如状态色）也跳过——等值就无所谓极性。
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "lib/client.js"), "utf8");

function readPalette() {
	const start = source.indexOf("const PALETTE = {");
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
	return new Function("return " + source.slice(source.indexOf("{", start), end))();
}

const PALETTE = readPalette();

// ---- 颜色换算。只处理本表与官方色阶实际用到的写法：3/4/6/8 位十六进制与 transparent。----
function toRgb(value) {
	const text = String(value).trim();
	if (text === "transparent" || text === "#0000") return null;
	const hex = text.startsWith("#") ? text.slice(1) : null;
	if (!hex || !/^[0-9a-fA-F]+$/.test(hex)) return null;
	// 3 位 → 6 位；4 位 → 8 位（RGBA 简写）
	const full = hex.length === 3 || hex.length === 4 ? hex.split("").map((c) => c + c).join("") : hex;
	if (full.length !== 6 && full.length !== 8) return null;
	const n = parseInt(full.slice(0, 6), 16);
	const alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

/** alpha 合成：把前景按 alpha 叠到背景上，得到实际显示色。 */
function over(fg, bg) {
	if (!fg) return bg;
	const a = fg[3];
	return [
		Math.round(fg[0] * a + bg[0] * (1 - a)),
		Math.round(fg[1] * a + bg[1] * (1 - a)),
		Math.round(fg[2] * a + bg[2] * (1 - a)),
		1,
	];
}

function luminance([r, g, b]) {
	const lin = (c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fgValue, bgValue) {
	const bg = toRgb(bgValue);
	const fg = over(toRgb(fgValue), bg);
	const l1 = luminance(fg);
	const l2 = luminance(bg);
	const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
	return (hi + 0.05) / (lo + 0.05);
}

// ---- 需要核对的组合： [前景令牌, 背景令牌, 阈值, 用途说明] ----
const PAIRS = [
	["label-primary", "bg-base", 4.5, "正文 / 画布"],
	["label-primary", "bg-layer-1", 4.5, "正文 / 一级表面"],
	["label-primary", "bg-layer-2", 4.5, "正文 / 二级表面"],
	["label-primary", "bg-layer-3", 4.5, "正文 / 三级表面"],
	["label-secondary", "bg-base", 4.5, "次级文本 / 画布"],
	["label-secondary", "bg-layer-2", 4.5, "次级文本 / 二级表面"],
	["label-tertiary", "bg-base", 4.5, "三级文本 / 画布"],
	["label-caption", "bg-base", 3.0, "说明文字（非正文 UI 文本）"],
	["label-primary-dimmed", "bg-base", 4.5, "弱化主文本 / 画布"],
	["label-primary-bluish", "bg-base", 4.5, "偏冷主文本 / 画布"],
	["label-primary-foreground", "brand-primary", 4.5, "主按钮上的文字"],
	["label-primary-foreground", "button-primary-hover", 4.5, "主按钮悬停态文字"],
	["link", "bg-base", 4.5, "链接 / 画布"],
	["state-success-primary", "bg-base", 3.0, "成功色 / 画布"],
	["state-warn-primary", "bg-base", 3.0, "警告色 / 画布"],
	["state-warn-label", "bg-base", 4.5, "警告文字 / 画布"],
	["state-error-primary", "bg-base", 4.5, "错误色 / 画布"],
	["state-business-primary", "bg-base", 3.0, "主色 / 画布（焦点环、强调）"],
	["menu-icon", "bg-base", 3.0, "菜单图标"],
	["label-primary", "settings-card-fill", 4.5, "设置卡片正文"],
	["label-primary", "markdown-code-block", 4.5, "代码块正文"],
	// 刻意不核对 tooltip：DSH 没有 tooltip-label 令牌，气泡里的文字颜色不由皮肤
	// 决定；而官方设计里 tooltip 是「两种色板都深底」，拿 label-primary 去配它在
	// 浅色方案下必然失败——那是假设错误，不是配色错误。工具提示的可读性由 B 项
	// 的极性检查兜底（保证我没把它反过来）。
	["toast-label", "toast-bg", 4.5, "系统提示正文"],
	["label-document-preview", "bg-document-preview", 4.5, "文档预览文字"],
];

const reportOnly = process.argv.includes("--report");
const failures = [];
const rows = [];

for (const [fgName, bgName, threshold, usage] of PAIRS) {
	const entry = PALETTE[fgName];
	if (!entry) {
		failures.push(`PALETTE 里没有 --dsw-alias-${fgName}（对比度表引用了它）`);
		continue;
	}
	const bgEntry = PALETTE[bgName];
	if (!bgEntry) {
		failures.push(`PALETTE 里没有 --dsw-alias-${bgName}（对比度表引用了它）`);
		continue;
	}
	for (const [i, scheme] of ["浅色", "深色"].entries()) {
		const ratio = contrast(entry[i], bgEntry[i]);
		const ok = ratio >= threshold;
		rows.push({ usage, scheme, fg: fgName, bg: bgName, ratio, threshold, ok });
		if (!ok) {
			failures.push(
				`${scheme}：${usage} —— ${fgName} on ${bgName} 只有 ${ratio.toFixed(2)}:1（要求 ≥ ${threshold}:1）`,
			);
		}
	}
}

// ============================================================
// B. 极性不变量：覆盖不能把任何令牌的「浅色比深色亮」关系反过来
// ============================================================
const DSH_THEME_CANDIDATES = [
	"/Applications/DSH Desktop.app/Contents/Resources/app/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js",
	join(process.env.DSH_HOME ?? "", "node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js"),
];
const themePath = DSH_THEME_CANDIDATES.find((p) => p && existsSync(p));

let polarity = { checked: 0, skipped: 0 };
if (!themePath) {
	console.log("未找到已安装的 DSH 客户端主题包，跳过极性检查（CI 上属正常）");
} else {
	const bundle = readFileSync(themePath, "utf8");

	// 官方把原始色阶定义成 --dsw-static-*，别名再 var() 引用它们。先把色阶解析成十六进制。
	const statics = new Map();
	for (const m of bundle.matchAll(/(--dsw-static-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) {
		if (!statics.has(m[1])) statics.set(m[1], m[2]);
	}
	/** 把官方别名值解析成 RGB；解析不了（color-mix 等）返回 null。 */
	const resolve = (value) => {
		const text = String(value).trim();
		if (text.startsWith("#")) return toRgb(text);
		const variable = text.match(/^var\((--dsw-static-[a-z0-9-]+)\)$/);
		return variable ? toRgb(statics.get(variable[1]) ?? "") : null;
	};
	/** 取出某个选择器后面的声明块。 */
	const blockOf = (selector) => {
		const i = bundle.indexOf(selector);
		if (i < 0) return new Map();
		const j = bundle.indexOf("{", i);
		const k = bundle.indexOf("}", j);
		const map = new Map();
		for (const m of bundle.slice(j + 1, k).matchAll(/(--dsw-alias-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
			map.set(m[1], m[2]);
		}
		return map;
	};

	const officialLight = blockOf("body{--dsw-alias-bg-base");
	const officialDark = blockOf("body[data-ds-dark-theme]{--dsw-alias-bg-base");
	const EPSILON = 0.02; // 亮度过分接近时不判极性（官方本身就有等值的情况）

	if (!officialLight.size || !officialDark.size) {
		console.log("官方别名调色板块没解析出来，跳过极性检查");
	} else {
		for (const [alias, [myLight, myDark]] of Object.entries(PALETTE)) {
			const name = "--dsw-alias-" + alias;
			const oLight = resolve(officialLight.get(name) ?? "");
			const oDark = resolve(officialDark.get(name) ?? "");
			const mLight = toRgb(myLight);
			const mDark = toRgb(myDark);
			// 半透明色的「亮度」不是它的通道值，跳过（见文件头 B 项说明）
			const opaque = (rgb) => rgb && rgb[3] === 1;
			if (!oLight || !oDark || !opaque(mLight) || !opaque(mDark)) {
				polarity.skipped += 1;
				continue;
			}
			const oL = luminance(oLight);
			const oD = luminance(oDark);
			if (Math.abs(oL - oD) < EPSILON) {
				polarity.skipped += 1; // 官方两侧等值（如状态色），无从谈极性
				continue;
			}
			const myL = luminance(mLight);
			const myD = luminance(mDark);
			const officialInverted = oL > oD; // 官方：浅色侧更亮？
			const mineInverted = myL > myD;
			polarity.checked += 1;
			if (officialInverted !== mineInverted) {
				failures.push(
					`极性反了：${name} —— 官方是「${officialInverted ? "浅色更亮" : "深色更亮"}」，` +
						`覆盖成了「${mineInverted ? "浅色更亮" : "深色更亮"}」（浅 ${mLight} / 深 ${mDark}）`,
				);
			}
		}
	}
}

if (reportOnly || failures.length) {
	console.log("用途".padEnd(24) + "色板".padEnd(6) + "对比度".padStart(9) + " 阈值");
	for (const row of rows) {
		console.log(
			row.usage.padEnd(24) +
				row.scheme.padEnd(6) +
				(row.ratio.toFixed(2) + ":1").padStart(9) +
				"  " + row.threshold + (row.ok ? "" : "  ✗"),
		);
	}
	console.log("");
}

if (reportOnly) process.exit(0);

if (failures.length) {
	console.error("颜色关系核对失败：");
	for (const line of failures) console.error("  ✗ " + line);
	process.exit(1);
}
console.log(
	`✓ 对比度核对通过（${rows.length} 个组合全部达标）` +
		(polarity.checked
			? `；极性核对通过（${polarity.checked} 个令牌，跳过 ${polarity.skipped} 个无法解析或官方等值的）`
			: ""),
);
