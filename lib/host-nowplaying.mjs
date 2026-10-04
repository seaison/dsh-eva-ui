/**
 * 「正在播放」的纯函数部分（宿主半边）。
 *
 * ── 为什么需要宿主半边 ────────────────────────────────────────────────
 * 浏览器半边的 JS **读不到别的应用**在放什么：`navigator.mediaSession` 只描述
 * 当前文档自己的媒体，跨进程/跨标签一概看不见。而 macOS 上 Apple Music 与
 * Spotify 都支持 AppleScript，所以由宿主（Node）跑一段固定的 osascript 去问，
 * 再把结果交给界面显示 —— 这就是「用其它音乐平台播放时播放器能显示出来」的实现路径。
 *
 * ── 安全边界 ──────────────────────────────────────────────────────────
 *   · 脚本是**固定字符串**，不做任何插值；控制动作也只接受**白名单**里的
 *     app（Music / Spotify）与动作（playpause / next / previous），
 *     插值前再校验一次 —— 从根上避免命令注入；
 *   · 只在本机跑，不联网、不写文件、不碰任何用户数据；
 *   · 路由沿用余额那条的同一道栅栏（isTrustedRequest）。
 *
 * ── 已知边界 ──────────────────────────────────────────────────────────
 *   只认识**支持 AppleScript 的播放器**（macOS 上主要是 Music 与 Spotify）。
 *   其它平台（如各类国产客户端）系统层面没有可脚本化的接口，读不到 ——
 *   这时播放器会安静地回落到「本地文件」模式，不会显示假数据。
 */

export const NOWPLAYING_PATH = "/dsh-eva-magi/nowplaying.json";
export const CONTROL_PATH = "/dsh-eva-magi/nowplaying";
export const NP_CACHE_MS = 1500;

/** 支持的平台白名单。控制动作只允许这些名字，绝不接受外部传入的任意 app 名。 */
export const NP_APPS = ["Music", "Spotify"];

/**
 * 只读脚本：先看哪个播放器在跑，优先 Music，其次 Spotify；都没有就返回空串。
 * 输出用制表符分隔，便于 parseNowPlaying 解析。
 */
export const READ_SCRIPT = [
	'set out to ""',
	'tell application "System Events" to set runningApps to name of every process',
	'if runningApps contains "Music" then',
	'  tell application "Music"',
	'    if player state is not stopped then',
	'      set t to current track',
	'      set out to "Music" & tab & (player state as text) & tab & (name of t) & tab & (artist of t) & tab & (album of t) & tab & ((duration of t) as text) & tab & ((player position) as text)',
	'    end if',
	'  end tell',
	'end if',
	'if out is "" and runningApps contains "Spotify" then',
	'  tell application "Spotify"',
	'    if player state is not stopped then',
	'      set t to current track',
	'      set out to "Spotify" & tab & (player state as text) & tab & (name of t) & tab & (artist of t) & tab & (album of t) & tab & (((duration of t) / 1000) as text) & tab & ((player position) as text)',
	'    end if',
	'  end tell',
	'end if',
	'return out',
].join("\n");

/** 控制动作白名单 → AppleScript 模板（%APP% 只会被白名单里的名字替换）。 */
export const CONTROL_SCRIPTS = {
	playpause: 'tell application "%APP%" to playpause',
	next: 'tell application "%APP%" to next track',
	previous: 'tell application "%APP%" to previous track',
};

/**
 * 生成控制脚本。app 必须在白名单里、action 必须在白名单里，否则返回 null ——
 * 调用方据此拒绝请求，而不是把外部字符串拼进脚本。
 *
 * @param app - 播放器名（只允许 NP_APPS 里的值）。
 * @param action - 动作名（只允许 CONTROL_SCRIPTS 的键）。
 */
export function controlScript(app, action) {
	if (!NP_APPS.includes(app)) return null;
	const template = CONTROL_SCRIPTS[action];
	if (!template) return null;
	return template.replace("%APP%", app);
}

/**
 * 解析 osascript 的输出。空串表示「没有支持的播放器在放」。
 *
 * @param raw - osascript 的 stdout。
 */
export function parseNowPlaying(raw) {
	const text = String(raw === undefined || raw === null ? "" : raw).trim();
	if (!text) return { app: null, playing: false, state: "" };
	const parts = text.split("\t");
	const num = (value) => {
		const n = Number(value);
		return Number.isFinite(n) && n >= 0 ? n : 0;
	};
	const state = parts[1] || "";
	return {
		app: parts[0] || null,
		state,
		playing: /playing/i.test(state),
		title: parts[2] || "",
		artist: parts[3] || "",
		album: parts[4] || "",
		duration: num(parts[5]),
		position: num(parts[6]),
	};
}
