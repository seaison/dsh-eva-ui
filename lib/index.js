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
						send(200, await readBalance(refresh));
					},
				}),
			"eva-magi: balance route",
		);
	});
}
