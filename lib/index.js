/**
 * dsh-eva-magi-theme —— 宿主半边（host half）
 *
 * 这个插件的主体是皮肤（浏览器半边，lib/client.js）。宿主半边只做一件事：
 * 给界面提供一条**只读的余额接口**，因为客户端按设计读不到 API Key。
 *
 * ── 隐私与安全边界（改动前先读这段）──────────────────────────────────
 *   · 只在用户**点击右下角标签翻面**时才请求，且带 60 秒缓存；
 *   · 密钥通过 DSH 官方凭据服务读取（`ctx.credentials.resolve`）；
 *     本插件不落盘、不打印、不转发它；
 *   · 出网只有一个地址：`https://api.deepseek.com/user/balance`；
 *   · 另外用 `session/event` 事件流记录**本机产生的 token 用量**（只记 token 数、
 *     模型名与时间戳，不记任何对话内容），供界面本地按价目表估算「今日已用」；
 *   · 本机路由是只读 GET，并做三道校验（Host 必须回环 / 拒 cross-site /
 *     Origin 必须同源），见 lib/host-balance.mjs 的 isTrustedRequest。
 *     没有这三道校验，任意网页都能把你的余额读走。
 * ────────────────────────────────────────────────────────────────────
 *
 * 宿主半边不注册设置项、不改会话、不写任何用户数据文件。
 */

import {
	BALANCE_PATH,
	BALANCE_URL,
	CACHE_MS,
	CREDENTIAL_ID,
	formatBalance,
	isTrustedRequest,
	parseBalance,
	secretOf,
} from "./host-balance.mjs";

export const name = "dsh-eva-magi-theme";

/**
 * @param ctx - 宿主侧 Cordis 上下文。
 */
export function apply(ctx) {
	let cache = null;
	let inflight = null;

	// ============================================================
	// 今日已用的**原始记录**（宿主只负责记，不负责算）
	// ------------------------------------------------------------
	// 为什么不在这里计价：价目表与峰谷规则只有浏览器半边有（那边的标签还要用峰谷
	// 规则显示状态）。在这里再抄一份，等于把同一套规则维护两遍，改一处忘一处就会
	// 算错钱。所以宿主只记「什么时候、哪个模型、多少 token」，交给浏览器半边用它
	// 自己那份规则去计价。
	//
	// 只记 token 数与模型名，**不记任何对话内容**。
	// ============================================================
	const USAGE_KEEP_MS = 36 * 3600 * 1000; // 留够一个北京日 + 余量
	const USAGE_MAX = 400; // 一次翻面回传的上限，避免 payload 过大
	const usageLog = [];

	/** `session/event` 里带用量的那条事件 → 精简成一条记录。 */
	const recordUsage = (event) => {
		try {
			if (!event || event.type !== "assistant/message") return;
			const data = event.data || {};
			const usage = data.usage;
			if (!usage || typeof usage !== "object") return;
			usageLog.push({
				time: Number(event.time) || Date.now(),
				turn: data.turn,
				step: data.step,
				usage: {
					inputTokens: usage.inputTokens,
					outputTokens: usage.outputTokens,
					cacheReadTokens: usage.cacheReadTokens,
					cacheWriteTokens: usage.cacheWriteTokens,
				},
				model: (data.message && data.message.model) || "",
			});
			const cutoff = Date.now() - USAGE_KEEP_MS;
			while (usageLog.length > 0 && usageLog[0].time < cutoff) usageLog.shift();
			if (usageLog.length > USAGE_MAX) usageLog.splice(0, usageLog.length - USAGE_MAX);
		} catch (error) {
			/* 记账失败绝不影响会话本身 */
		}
	};

	// 事件流不需要 inject：Cordis 事件挂在上下文上。
	// 用 effect 挂，插件卸载/热重载时自动摘掉。
	ctx.effect(() => {
		ctx.on("session/event", recordUsage);
		return () => ctx.off("session/event", recordUsage);
	}, "eva-magi: usage recorder");

	// 用子作用域 inject（与官方主题包、dsh-whale-widget 同款）：webServer 或
	// credentials 缺失时这段不执行，但插件本身照常加载 —— 皮肤是浏览器半边的事，
	// 不该被宿主服务拖住（写进 exports.inject 会让整个插件在没有这些服务的组合里
	// 永远等不到依赖，连皮肤都不出现）。
	ctx.inject(["webServer", "credentials"], (scope) => {
		// 注意：这里必须用 scope 而不是外层的 ctx ——
		// 外层 ctx 没声明过 credentials 注入，直接访问会抛
		// 「cannot get property "credentials" without inject」（实机踩到过）。
		/**
		 * 取余额（带缓存与并发合并）。
		 * 永远返回可 JSON 化的对象，绝不把异常抛给路由 —— 界面需要的是一个明确的
		 * ok:false 与原因，而不是 500。
		 *
		 * @param force - 忽略缓存（对应路由的 `?refresh=1`）。
		 */
		const readBalance = async (force) => {
			const now = Date.now();
			if (!force && cache && now - cache.at < CACHE_MS) return cache.body;
			if (inflight) return inflight;

			inflight = (async () => {
				try {
					// resolve 返回 { value } 而不是裸字符串（见 secretOf 注释）
					const key = secretOf(await scope.credentials.resolve(CREDENTIAL_ID));
					if (!key) {
						return { ok: false, code: "NO_KEY", error: "凭据服务里没有 " + CREDENTIAL_ID };
					}
					const response = await fetch(BALANCE_URL, {
						headers: { authorization: "Bearer " + key, accept: "application/json" },
					});
					if (!response.ok) {
						return { ok: false, code: "HTTP_" + response.status, error: "余额接口返回 " + response.status };
					}
					const info = parseBalance(await response.json());
					if (!info) {
						return { ok: false, code: "NO_BALANCE", error: "响应里没有可用的余额字段" };
					}
					return { ok: true, ...info, text: formatBalance(info) };
				} catch (error) {
					return {
						ok: false,
						code: "ERROR",
						error: String((error && error.message) || error).slice(0, 200),
					};
				} finally {
					inflight = null;
				}
			})();

			const body = await inflight;
			if (body && body.ok) cache = { at: Date.now(), body };
			return body;
			};

		scope.effect(
			() =>
				scope.webServer.register({
					kind: "exact",
					path: BALANCE_PATH,
					handler: async (req, res) => {
						const send = (status, body) => {
							res.writeHead(status, {
								"content-type": "application/json; charset=utf-8",
								"cache-control": "no-store",
							});
							res.end(JSON.stringify(body));
						};
						if (!isTrustedRequest(req.headers)) return send(403, { ok: false, code: "FORBIDDEN" });
						if (req.method && req.method !== "GET" && req.method !== "HEAD") {
							return send(405, { ok: false, code: "METHOD" });
						}
						const refresh = /[?&]refresh=1/.test(req.url || "");
						const body = await readBalance(refresh);
						// 用量原始记录一起回传：界面一次请求就能刷新两面
						send(200, { ...body, usage: usageLog });
					},
				}),
			"eva-magi: balance route",
		);
	});
}
