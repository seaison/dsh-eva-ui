#!/usr/bin/env node
/**
 * 在无头浏览器里跑 tools/client-harness.html，把结果变成退出码。
 *
 *   node tools/run-client-harness.mjs
 *
 * 找不到 Chrome 时**跳过而不是失败**：这台机器上有没有浏览器不是这个仓库的
 * 契约，CI 上也不该因此变红。
 */
import { existsSync, openSync, closeSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const harness = join(root, "tools/client-harness.html");

const CANDIDATES = [
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/Applications/Chromium.app/Contents/MacOS/Chromium",
	"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
	"/usr/bin/google-chrome",
	"/usr/bin/chromium",
	"/usr/bin/chromium-browser",
	"/snap/bin/chromium",
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
	process.env.CHROME_PATH,
].filter(Boolean);

const chrome = CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
	console.log("未找到 Chrome / Chromium，跳过浏览器半边测试（这不是失败）");
	process.exit(0);
}

// 注意两件事：
//
// 1) 不能用 execFileSync / stdio:'pipe'。Chrome 会派生子进程，它们继承 stdout
//    管道，父进程永远等不到 EOF —— 命令会挂住不返回。把子进程的 stdout 直接接到
//    一个文件描述符上，父进程就只等主进程退出。
// 2) 不要加 --user-data-dir。无头 + --dump-dom 本来就用临时 profile；显式指定
//    一个固定目录会在上一次异常退出后留下锁，Chrome 于是一直等锁而不退出。
const outFile = join(tmpdir(), `dsh-eva-magi-harness-${process.pid}.html`);
const outFd = openSync(outFile, "w");
let status = 0;
try {
	const result = spawnSync(
		chrome,
		[
			"--headless=new",
			"--disable-gpu",
			"--virtual-time-budget=4000",
			"--dump-dom",
			"file://" + harness,
		],
		{ stdio: ["ignore", outFd, "ignore"], timeout: 60_000 },
	);
	status = result.status ?? 1;
	if (result.error) {
		console.error("启动无头浏览器失败：", result.error.message);
		process.exit(1);
	}
} finally {
	closeSync(outFd);
}

const dom = readFileSync(outFile, "utf8");
rmSync(outFile, { force: true });

if (!dom.trim()) {
	console.error("无头浏览器没有输出 DOM（退出码 " + status + "）");
	process.exit(1);
}

const match = dom.match(/<pre id="RESULT">([\s\S]*?)<\/pre>/);
if (!match) {
	console.error("测试台没有输出结果，页面可能根本没跑起来");
	process.exit(1);
}

const decoded = match[1]
	.replace(/&lt;/g, "<")
	.replace(/&gt;/g, ">")
	.replace(/&quot;/g, '"')
	.replace(/&#39;/g, "'")
	.replace(/&amp;/g, "&");

let report;
try {
	report = JSON.parse(decoded);
} catch (error) {
	console.error("结果不是合法 JSON：", decoded.slice(0, 400));
	process.exit(1);
}

if (report.failures?.length) {
	for (const failure of report.failures) {
		console.error(`  ✗ ${failure.name}${failure.detail ? " —— " + failure.detail : ""}`);
	}
	console.error(`\n浏览器半边测试失败：${report.failed}/${report.total}`);
	process.exit(1);
}

console.log(`✓ 浏览器半边测试通过（${report.total} 项断言）`);
