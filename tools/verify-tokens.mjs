#!/usr/bin/env node
/**
 * 令牌核对。
 *
 * 皮肤最容易出现的失败模式是「静默失效」：令牌名拼错、或者 DSH 升级后改了名，
 * 覆盖不生效，但页面不报任何错。这个脚本把那种失败变成一条明确的测试结果。
 *
 *   node tools/verify-tokens.mjs
 *
 * 检查三件事：
 *   1) PALETTE 的形状合法（每个值都是 [浅色, 深色] 两个字符串）；
 *   2) 别名名不重复（对象字面量里重复的键会静默覆盖）；
 *   3) 如果本机能找到已安装的 DSH 客户端主题包，则逐条比对令牌名——
 *      报告「我们声明了但官方没有」与「官方有但我们没覆盖」。
 *      找不到时不算失败（CI 上没有 DSH 安装），只跳过并说明。
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "lib/client.js"), "utf8");

/** 从 client.js 里取出 PALETTE 字面量。 */
function readPalette() {
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
	return new Function("return " + source.slice(source.indexOf("{", start), end))();
}

const PALETTE = readPalette();
const failures = [];

// ---- 1. 形状 ----
let checked = 0;
for (const [alias, value] of Object.entries(PALETTE)) {
	checked += 1;
	if (!Array.isArray(value) || value.length !== 2) {
		failures.push(`--dsw-alias-${alias}: 值必须是 [浅色, 深色] 两元数组`);
		continue;
	}
	for (const [i, entry] of value.entries()) {
		if (typeof entry !== "string" || entry.trim() === "") {
			failures.push(`--dsw-alias-${alias}: ${i === 0 ? "浅色" : "深色"}必须是非空字符串`);
		}
	}
}

// ---- 2. 重复键（JS 对象字面量里后写的会静默覆盖前面的）----
const seen = new Set();
for (const match of source.matchAll(/^\s{3}"([a-z0-9-]+)":\s*\[/gm)) {
	if (seen.has(match[1])) failures.push(`--dsw-alias-${match[1]}: 在 PALETTE 里重复定义了`);
	seen.add(match[1]);
}

// ---- 3. 与已安装的 DSH 客户端主题包比对 ----
const DSH_THEME_CANDIDATES = [
	"/Applications/DSH Desktop.app/Contents/Resources/app/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js",
	join(process.env.DSH_HOME ?? "", "node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js"),
];

const themePath = DSH_THEME_CANDIDATES.find((p) => p && existsSync(p));
let official = null;
if (themePath) {
	const bundle = readFileSync(themePath, "utf8");
	// 官方把别名调色板定义在 body{...} 与 body[data-ds-dark-theme]{...} 两个块里。
	const names = new Set();
	const start = bundle.indexOf("body{--dsw-alias-bg-base");
	const end = bundle.indexOf("}", start);
	for (const match of bundle.slice(start, end).matchAll(/--dsw-alias-[a-z0-9-]+/g)) names.add(match[0]);
	official = names;
}

console.log(`令牌形状检查：${checked} 条`);
if (official) {
	console.log(`官方调色板块：${official.size} 条（${themePath.replace(/^.*dsh-client-ui-theme/, "…dsh-client-ui-theme")}）`);
	const mine = new Set(Object.keys(PALETTE).map((k) => "--dsw-alias-" + k));
	// 官方令牌可能定义在别的样式表里（onboarding.css、base.css），这些不算「不存在」，
	// 因此这里只报告，不判失败——真正的失败信号是形状与重复键。
	const extra = [...mine].filter((n) => !official.has(n));
	const missing = [...official].filter((n) => !mine.has(n));
	console.log(`  未出现在主调色板块的声明：${extra.length ? extra.join(", ") : "无"}`);
	console.log(`  未覆盖的官方令牌：${missing.length ? missing.join(", ") : "无"}`);
} else {
	console.log("未找到已安装的 DSH 客户端主题包，跳过比对（CI 上属正常）");
}

if (failures.length) {
	console.error("\n失败：");
	for (const line of failures) console.error("  ✗ " + line);
	process.exit(1);
}
console.log("\n✓ 令牌检查通过");
