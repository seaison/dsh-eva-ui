/**
 * 宿主半边的纯逻辑：请求栅栏 + 余额解析。
 *
 * 单独成文件是为了可测：宿主侧跑在 DSH 进程里，浏览器测试台够不着它，
 * 但这两件事 —— 「这个请求该不该放行」和「这个响应怎么读」—— 恰好是
 * 最需要断言、也最容易写错的部分。tools/verify-host.mjs 直接 import 本文件。
 */

/** 客户端取余额的本机路由。 */
export const BALANCE_PATH = "/dsh-eva-magi/balance.json";

/** DeepSeek 官方的余额接口（与 dsh-whale-widget 用的是同一个）。 */
export const BALANCE_URL = "https://api.deepseek.com/user/balance";

/** DSH 凭据服务里 DeepSeek API Key 的标准 id。 */
export const CREDENTIAL_ID = "DEEPSEEK_API_KEY";

/** 余额缓存时长：避免连点标签把官方接口打爆。 */
export const CACHE_MS = 60_000;

/**
 * 这个请求该不该放行。
 *
 * 本机路由的威胁模型（参考 dsh-whale-widget 里踩过的坑）：
 *   ① **DNS 重绑定**：恶意页面把自己的域名解析到 127.0.0.1，然后请求本机服务。
 *      这种请求的 Host 是攻击者的域名而不是回环地址 —— 所以校验 Host 能挡住。
 *   ② **跨站请求**：任意网页都能往 localhost 发请求。`Sec-Fetch-Site: cross-site`
 *      是浏览器给的、页面无法伪造的标记。
 *   ③ **Origin 不匹配**：带了 Origin 就必须与本机同源，否则拒。
 *
 * 这条路由是只读的（只返回余额），所以没有 CSRF 写入风险；但余额属于隐私，
 * 泄露给任意网页同样不可接受 —— 三道校验都必须过。
 *
 * @param headers - Node 请求头（小写键）。
 * @returns 是否可信。
 */
export function isTrustedRequest(headers) {
	if (!headers || typeof headers !== "object") return false;
	const host = String(headers.host ?? "").toLowerCase();
	// 允许 127.0.0.1 / localhost / [::1]，可带端口
	const authority = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
	const loopback = authority === "127.0.0.1" || authority === "localhost" || authority === "::1";
	if (!loopback) return false;

	if (String(headers["sec-fetch-site"] ?? "").toLowerCase() === "cross-site") return false;

	const origin = headers.origin;
	if (origin) {
		let originHost;
		try {
			originHost = new URL(String(origin)).host.toLowerCase();
		} catch (error) {
			return false;
		}
		if (originHost !== host) return false;
	}
	return true;
}

/**
 * 解析 DeepSeek `/user/balance` 的响应。
 *
 * 官方形状：
 *   { is_available: true,
 *     balance_infos: [ { currency: "CNY", total_balance: "110.00",
 *                        granted_balance: "10.00", topped_up_balance: "100.00" } ] }
 *
 * @returns 归一化后的余额，或 null（拿不到有效数字时）。
 */
export function parseBalance(payload) {
	if (!payload || typeof payload !== "object") return null;
	const infos = Array.isArray(payload.balance_infos) ? payload.balance_infos : [];
	if (infos.length === 0) return null;
	// 有人民币钱包就优先用它
	const wallet = infos.find((item) => item && item.currency === "CNY") ?? infos[0];
	if (!wallet) return null;
	const amount = Number(wallet.total_balance);
	if (!Number.isFinite(amount)) return null;
	return {
		currency: typeof wallet.currency === "string" && wallet.currency ? wallet.currency : "CNY",
		balance: amount,
		granted: Number.isFinite(Number(wallet.granted_balance)) ? Number(wallet.granted_balance) : null,
		toppedUp: Number.isFinite(Number(wallet.topped_up_balance)) ? Number(wallet.topped_up_balance) : null,
		available: payload.is_available !== false,
		at: Date.now(),
	};
}

/**
 * 从 `credentials.resolve()` 的结果里取出密钥字符串。
 *
 * ⚠️ **绝不要把这个结果放进日志、错误信息或调试响应里**：它本身就是密钥。
 * 排查形态时只报类型与长度，不报值 —— 写这条是因为我调试时真的漏过一次，
 * 顺手把 JSON.stringify(resolved) 带进了输出，等于把密钥打进了会话记录。
 *
 * ⚠️ 它返回的是**对象 `{ value }`**，不是裸字符串 —— 实机踩过：
 * 写成 `"Bearer " + resolved` 会发出 `Bearer [object Object]`，
 * 官方接口回 401，而错误信息只说"认证失败"，很难看出是这里。
 * 两种形态都收，是为了对服务实现的变化有容错。
 *
 * @param resolved - resolve 的返回值。
 * @returns 密钥字符串；取不到时是空串（调用方据此报 NO_KEY）。
 */
export function secretOf(resolved) {
	if (typeof resolved === "string") return resolved;
	if (resolved && typeof resolved.value === "string") return resolved.value;
	return "";
}

/** 余额 → 界面文本。宿主侧也算一份，方便日志与排查。 */
export function formatBalance(info) {
	if (!info) return "—";
	const symbol = info.currency === "USD" ? "$" : "¥";
	return symbol + info.balance.toFixed(2);
}
