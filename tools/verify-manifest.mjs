#!/usr/bin/env node
/**
 * 打包不变量校验。
 *
 *   node tools/verify-manifest.mjs
 *
 * DSH 加载一个客户端插件要同时对上四个名字/路径。错一个的表现是「插件装上了但
 * 什么都不发生」，而且**不会报错**——所以这里把它们钉死成测试：
 *
 *   1) package.json 的 name  ===  client.js 里 __ModuleLoader__.load({ id })
 *      （模块加载器用 id 匹配 `./client` 导出，不一致就解析不到）
 *   2) package.json 的 name  ===  cordis.patch.yml 里 insert 的 name
 *      （宿主用这个名字从 node_modules 解析宿主半边）
 *   3) exports["./client"]   → 文件真实存在，且 dsh.client.platform 已声明
 *      （client-modules 靠这个字段把浏览器半边放进启动清单）
 *   4) dsh.bundle.patch + main + files[] 指向的东西都存在
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const failures = [];

const pkg = JSON.parse(read("package.json"));

// ---- 1. 包名 === 模块 id ----
const clientSource = read("lib/client.js");
const idMatch = clientSource.match(/__ModuleLoader__\.load\(\{[\s\S]*?\bid:\s*"([^"]+)"/);
if (!idMatch) failures.push("lib/client.js 里找不到 __ModuleLoader__.load({ id })");
else if (idMatch[1] !== pkg.name) {
	failures.push(`模块 id (${idMatch[1]}) 与 package.json name (${pkg.name}) 不一致`);
}

// ---- 2. 包名 === patch 里的 insert name ----
const patchSource = read("cordis.patch.yml");
const nameMatches = [...patchSource.matchAll(/^\s*name:\s*['"]?([^'"\s]+)['"]?\s*$/gm)].map((m) => m[1]);
if (!nameMatches.length) failures.push("cordis.patch.yml 里找不到 insert 的 name");
else if (!nameMatches.includes(pkg.name)) {
	failures.push(`cordis.patch.yml 的 name (${nameMatches.join(", ")}) 与包名 ${pkg.name} 不一致`);
}

// ---- 3. 客户端声明 ----
if (!pkg.dsh?.client) failures.push("package.json 缺少 dsh.client 声明（浏览器半边不会被加载）");
else {
	if (pkg.dsh.client.platform !== "web") {
		failures.push(`dsh.client.platform 应为 "web"，实际是 ${JSON.stringify(pkg.dsh.client.platform)}`);
	}
	const clientExport = pkg.exports?.["./client"];
	const clientPath = typeof clientExport === "string" ? clientExport : clientExport?.default;
	if (!clientPath) failures.push('package.json 缺少 exports["./client"]');
	else if (!existsSync(join(root, clientPath))) failures.push(`exports["./client"] 指向的文件不存在：${clientPath}`);
}

// ---- 4. 路径都存在 ----
const patchPath = pkg.dsh?.bundle?.patch;
if (!patchPath) failures.push("package.json 缺少 dsh.bundle.patch");
else if (!existsSync(join(root, patchPath))) failures.push(`dsh.bundle.patch 指向的文件不存在：${patchPath}`);

if (!pkg.main) failures.push("package.json 缺少 main（宿主半边入口）");
else if (!existsSync(join(root, pkg.main))) failures.push(`main 指向的文件不存在：${pkg.main}`);

for (const entry of pkg.files ?? []) {
	if (!existsSync(join(root, entry))) failures.push(`files[] 列出的路径不存在：${entry}`);
}

// ---- 4b. patch 是「一个数组，且含 insert」----
const trimmed = patchSource.replace(/^\s*#.*$/gm, "").trim();
if (!trimmed.startsWith("-")) failures.push("cordis.patch.yml 的顶层不是 YAML 数组");
if (!/^\s*-?\s*insert:/m.test(patchSource)) failures.push("cordis.patch.yml 里没有 insert 段");

// ---- 5. 包名与官方命名空间的关系 ----
if (pkg.name.startsWith("@deepseek-ai/")) {
	failures.push("包名落在官方命名空间 @deepseek-ai/ 下，第三方插件不应占用它");
}

// ---- 6. 零安装依赖 ----
// 这是一个「纯皮肤」插件：浏览器半边不 require 任何模块，宿主半边是空实现。
// 因此它不该有 dependencies（装了插件却需要联网拉包是荒谬的），也不该有
// peerDependencies —— 它依赖的 `theme` 是 Cordis 服务，由宿主提供，走 inject 声明，
// 不是包依赖。把这条钉成测试，防止以后被无意改回去。
const deps = Object.keys(pkg.dependencies ?? {});
if (deps.length) failures.push(`不应有 dependencies（安装插件不该需要联网）：${deps.join(", ")}`);
const peers = Object.keys(pkg.peerDependencies ?? {});
if (peers.length) {
	failures.push(`不应有 peerDependencies（宿主服务走 Cordis inject）：${peers.join(", ")}`);
}

if (failures.length) {
	console.error("打包不变量校验失败：");
	for (const line of failures) console.error("  ✗ " + line);
	process.exit(1);
}
console.log(`✓ 打包不变量校验通过（包名 ${pkg.name}，模块 id / patch name / exports 三处一致）`);
