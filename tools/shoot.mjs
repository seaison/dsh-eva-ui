#!/usr/bin/env node
/**
 * 给一个正在运行的 DSH Web 界面截图。
 *
 *   node tools/shoot.mjs <url> <out.png> [waitMs] [width] [height]
 *
 * 为什么不用 `chrome --screenshot`：那个改不了等待时机。DSH 的界面开着
 * WebSocket 与定时器，`--virtual-time-budget` 的虚拟时钟永远推不到尽头
 * （浏览器会一直等网络静默），命令于是挂死。这里改成用 CDP：
 * 真实等待一段时间，再显式调 Page.captureScreenshot。
 *
 * 这是开发期的取景工具，不参与 npm package 的运行时。
 */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

const [url, out, waitMsArg, widthArg, heightArg] = process.argv.slice(2);
if (!url || !out) {
	console.error("用法：node tools/shoot.mjs <url> <out.png> [waitMs] [width] [height]");
	process.exit(2);
}
const waitMs = Number(waitMsArg ?? 9000);
const width = Number(widthArg ?? 1600);
const height = Number(heightArg ?? 1000);
const PORT = 9333 + (process.pid % 500);

const CHROME_CANDIDATES = [
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/Applications/Chromium.app/Contents/MacOS/Chromium",
	"/usr/bin/google-chrome",
	"/usr/bin/chromium",
	process.env.CHROME_PATH,
].filter(Boolean);
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
	console.error("找不到 Chrome / Chromium");
	process.exit(1);
}

// WebSocket 客户端：优先用 DSH 自带的 ws（Electron 里一定有），否则退回 node 内置
// （Node 22+ 的全局 WebSocket 足够覆盖本脚本的需要）。
const require_ = createRequire(import.meta.url);
let WebSocketImpl = globalThis.WebSocket;
for (const candidate of [
	"/Applications/DSH Desktop.app/Contents/Resources/app/node_modules/ws",
	"ws",
]) {
	try {
		WebSocketImpl = require_(candidate);
		break;
	} catch {}
}
if (!WebSocketImpl) {
	console.error("找不到 WebSocket 实现");
	process.exit(1);
}

const profileDir = mkdtempSync(join(tmpdir(), "dsh-shoot-"));
const child = spawn(
	chrome,
	[
		"--headless=new",
		"--disable-gpu",
		"--hide-scrollbars",
		"--no-first-run",
		"--force-device-scale-factor=1",
		`--window-size=${width},${height}`,
		`--user-data-dir=${profileDir}`,
		`--remote-debugging-port=${PORT}`,
		"about:blank",
	],
	{ stdio: "ignore", detached: true },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
	for (let i = 0; i < 60; i += 1) {
		try {
			const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
			const list = await res.json();
			const page = list.find((t) => t.type === "page");
			if (page?.webSocketDebuggerUrl) return page;
		} catch {}
		await sleep(250);
	}
	throw new Error("等不到调试端口");
}

try {
	const target = await targets();
	const ws = new WebSocketImpl(target.webSocketDebuggerUrl);
	let id = 0;
	const pending = new Map();
	const send = (method, params) =>
		new Promise((resolve, reject) => {
			const messageId = ++id;
			pending.set(messageId, { resolve, reject });
			ws.send(JSON.stringify({ id: messageId, method, params }));
		});
	ws.on("message", (raw) => {
		const data = JSON.parse(String(raw));
		if (data.id && pending.has(data.id)) {
			const { resolve, reject } = pending.get(data.id);
			pending.delete(data.id);
			if (data.error) reject(new Error(JSON.stringify(data.error)));
			else resolve(data.result);
		}
	});
	await new Promise((resolve, reject) => {
		ws.on("open", resolve);
		ws.on("error", reject);
	});

	await send("Page.enable");
	await send("Page.navigate", { url });
	// 真实等待：DSH 的界面要先连上宿主、取到会话、再渲染。
	await sleep(waitMs);
	const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
	writeFileSync(out, Buffer.from(shot.data, "base64"));
	console.log(`✓ 已截图 ${out}（${width}x${height}，等待 ${waitMs}ms）`);
	ws.close();
} catch (error) {
	console.error("截图失败：", error.message);
	process.exitCode = 1;
} finally {
	try { process.kill(-child.pid, "SIGKILL"); } catch {}
	try { child.kill("SIGKILL"); } catch {}
	await sleep(300);
	rmSync(profileDir, { recursive: true, force: true });
}
