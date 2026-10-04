/**
 * 宿主半边的单测：请求栅栏 + 余额解析。
 *
 * 为什么单独一个文件：宿主侧跑在 DSH 进程里，浏览器测试台（client-harness.html）
 * 够不着它。但这两块恰好是最需要断言的 ——
 *   · isTrustedRequest 写松了 = 任意网页都能把你的余额读走；
 *   · parseBalance 写错了 = 界面显示一个错的金额（比不显示更糟）。
 * 所以它们是纯函数，可以被直接 import 出来断言。
 *
 * 用法：node tools/verify-host.mjs
 */

import {
	NP_APPS,
	NOWPLAYING_PATH,
	CONTROL_PATH,
	READ_SCRIPT,
	controlScript,
	parseNowPlaying,
} from "../lib/host-nowplaying.mjs";

import {
	BALANCE_PATH,
	BALANCE_URL,
	CREDENTIAL_ID,
	formatBalance,
	isTrustedRequest,
	parseBalance,
	secretOf,
} from "../lib/host-balance.mjs";

let passed = 0;
const failures = [];

const check = (label, ok, detail) => {
	if (ok) {
		passed += 1;
		return;
	}
	failures.push({ label, detail: detail === undefined ? "" : String(detail) });
};

const eq = (label, actual, expected) => {
	check(label, Object.is(actual, expected), `得到 ${JSON.stringify(actual)}，期望 ${JSON.stringify(expected)}`);
};

// ============================================================
// 1. 请求栅栏 —— 放行与拦截
// ============================================================
const ok = (headers) => isTrustedRequest(headers);
const no = (headers) => isTrustedRequest(headers) === false;

eq("常量：路由路径", BALANCE_PATH, "/dsh-eva-magi/balance.json");
eq("常量：出网地址只有官方余额接口", BALANCE_URL, "https://api.deepseek.com/user/balance");
eq("常量：凭据 id", CREDENTIAL_ID, "DEEPSEEK_API_KEY");

// —— 该放行的 ——
check("放行：回环 IPv4 + 端口", ok({ host: "127.0.0.1:43120" }) === true);
check("放行：localhost + 端口", ok({ host: "localhost:43120" }) === true);
check("放行：IPv6 回环 [::1]", ok({ host: "[::1]:43120" }) === true);
check("放行：带同源 Origin", ok({ host: "127.0.0.1:43120", origin: "http://127.0.0.1:43120" }) === true);
check("放行：同源 https Origin", ok({ host: "127.0.0.1:43120", origin: "https://127.0.0.1:43120" }) === true);
check("放行：same-origin 的 Sec-Fetch-Site", ok({ host: "127.0.0.1:43120", "sec-fetch-site": "same-origin" }) === true);

// —— 该拦截的（每条都对应一种真实攻击面）——
check("拦截：DNS 重绑定（Host 是攻击者域名）", no({ host: "evil.example:43120" }));
check("拦截：伪造同源 Origin 也拦（Host 非回环）", no({ host: "evil.example", origin: "http://evil.example" }));
check("拦截：后缀混淆 127.0.0.1.evil.example", no({ host: "127.0.0.1.evil.example" }));
check("拦截：userinfo 混淆 127.0.0.1:1@evil.example", no({ host: "127.0.0.1:1@evil.example" }));
check("拦截：跨站请求（Sec-Fetch-Site: cross-site）",
	no({ host: "127.0.0.1:43120", "sec-fetch-site": "cross-site" }));
check("拦截：Origin 与本机不同端口", no({ host: "127.0.0.1:43120", origin: "http://127.0.0.1:9999" }));
check("拦截：Origin 指向外部站点", no({ host: "127.0.0.1:43120", origin: "http://evil.example" }));
check("拦截：Origin 畸形", no({ host: "127.0.0.1:43120", origin: "not a url" }));
check("拦截：没有任何 Host", no({}));
check("拦截：headers 缺失", isTrustedRequest(undefined) === false);
check("拦截：headers 不是对象", isTrustedRequest("127.0.0.1") === false);

// —— 密钥取值：resolve 返回 { value }，实机踩过的坑 ——
eq("密钥：从 { value } 里取（这是真实形态）", secretOf({ value: "sk-abc" }), "sk-abc");
eq("密钥：裸字符串也收", secretOf("sk-abc"), "sk-abc");
eq("密钥：null → 空串", secretOf(null), "");
eq("密钥：undefined → 空串", secretOf(undefined), "");
eq("密钥：空对象 → 空串", secretOf({}), "");
eq("密钥：value 不是字符串 → 空串", secretOf({ value: 123 }), "");
check("密钥：绝不要把对象直接拼进请求头",
	secretOf({ value: "sk-x" }) !== String({ value: "sk-x" }));

// ============================================================
// 2. 余额解析 —— 只认能确定的数字
// ============================================================
const cny = parseBalance({
	is_available: true,
	balance_infos: [{ currency: "CNY", total_balance: "110.00", granted_balance: "10.00", topped_up_balance: "100.00" }],
});
check("解析：人民币钱包", Boolean(cny) && cny.currency === "CNY" && cny.balance === 110, JSON.stringify(cny));
eq("解析：赠送额度", cny.granted, 10);
eq("解析：充值额度", cny.toppedUp, 100);
eq("解析：可用标记", cny.available, true);
eq("解析：格式化", formatBalance(cny), "¥110.00");

const mixed = parseBalance({
	balance_infos: [{ currency: "USD", total_balance: "1.00" }, { currency: "CNY", total_balance: "12.34" }],
});
check("解析：多钱包时优先人民币", Boolean(mixed) && mixed.currency === "CNY" && mixed.balance === 12.34, JSON.stringify(mixed));
eq("解析：人民币格式化", formatBalance(mixed), "¥12.34");

const usdOnly = parseBalance({ balance_infos: [{ currency: "USD", total_balance: "5" }] });
check("解析：只有美元时用美元", Boolean(usdOnly) && usdOnly.currency === "USD", JSON.stringify(usdOnly));
eq("解析：美元格式化", formatBalance(usdOnly), "$5.00");

const unavailable = parseBalance({ is_available: false, balance_infos: [{ currency: "CNY", total_balance: "0.00" }] });
check("解析：is_available=false 如实带出", Boolean(unavailable) && unavailable.available === false);
eq("解析：零余额照实显示", formatBalance(unavailable), "¥0.00");

// —— 拿不到确定数字时必须返回 null，绝不猜 ——
eq("拒绝：没有 balance_infos", parseBalance({}), null);
eq("拒绝：balance_infos 不是数组", parseBalance({ balance_infos: "110" }), null);
eq("拒绝：空钱包列表", parseBalance({ balance_infos: [] }), null);
eq("拒绝：余额不是数字", parseBalance({ balance_infos: [{ currency: "CNY", total_balance: "N/A" }] }), null);
eq("拒绝：余额字段缺失", parseBalance({ balance_infos: [{ currency: "CNY" }] }), null);
eq("拒绝：payload 是 null", parseBalance(null), null);
eq("拒绝：payload 是字符串", parseBalance("110"), null);
eq("格式化：null 显示破折号", formatBalance(null), "—");

// ============================================================
// 「正在播放」：解析 + 控制脚本白名单
// ============================================================
// 注意：eq 是 === 比较，对象必须逐字段断言（或 stringify），否则永远不等
const empty = parseNowPlaying("");
eq("空输出：没有 app", empty.app, null);
eq("空输出：playing 为假", empty.playing, false);
eq("空输出：state 为空", empty.state, "");
const blank = parseNowPlaying("   \n ");
eq("仅空白同样视为没在放", blank.app === null && blank.playing === false, true);

const music = parseNowPlaying("Music\tplaying\tSong A\tArtist B\tAlbum C\t215.5\t42.25");
eq("Music 播放中：app", music.app, "Music");
eq("Music 播放中：playing 为真", music.playing, true);
eq("Music 播放中：曲名", music.title, "Song A");
eq("Music 播放中：艺人", music.artist, "Artist B");
eq("Music 播放中：时长（秒）", music.duration, 215.5);
eq("Music 播放中：进度", music.position, 42.25);

const spotify = parseNowPlaying("Spotify\tpaused\tTrack\tBand\tAlbum\t300\t10");
eq("Spotify 暂停：playing 为假", spotify.playing, false);
eq("Spotify 暂停：app", spotify.app, "Spotify");

const broken = parseNowPlaying("Music\tplaying");
eq("字段缺失时不产生 NaN", Number.isNaN(broken.duration) || broken.duration === 0, true);
eq("字段缺失时 title 为空串", broken.title, "");
const weird = parseNowPlaying("Music\tplaying\tX\tY\tZ\tabc\t-5");
eq("非数字时长归零", weird.duration, 0);
eq("负数进度归零", weird.position, 0);

eq("控制脚本：Music playpause", /tell application "Music" to playpause/.test(controlScript("Music", "playpause")), true);
eq("控制脚本：Spotify next", /tell application "Spotify" to next track/.test(controlScript("Spotify", "next")), true);
eq("控制脚本：previous", /previous track/.test(controlScript("Music", "previous")), true);

// —— 注入防护：这是这块最要紧的断言 ——
eq("拒绝：不在白名单的 app", controlScript("Music; rm -rf /", "playpause"), null);
eq("拒绝：不在白名单的 app（Spotify 拼串）", controlScript("Spotify\" & (do shell script \"x\")", "next"), null);
eq("拒绝：不在白名单的 action", controlScript("Music", "playpause; do shell script \"rm -rf /\""), null);
eq("拒绝：action 为空", controlScript("Music", ""), null);
eq("拒绝：action 为 undefined", controlScript("Music", undefined), null);
eq("白名单只有两个 app", NP_APPS.length === 2 && NP_APPS.includes("Music") && NP_APPS.includes("Spotify"), true);
eq("只读脚本里不含任何插值占位", READ_SCRIPT.includes("%APP%"), false);
eq("路由路径就位", NOWPLAYING_PATH === "/dsh-eva-magi/nowplaying.json" && CONTROL_PATH === "/dsh-eva-magi/nowplaying", true);

// ============================================================
// 结果
// ============================================================
if (failures.length > 0) {
	console.error(`✗ 宿主半边测试失败（${failures.length}/${passed + failures.length}）`);
	for (const item of failures) console.error(`   ✗ ${item.label}${item.detail ? " —— " + item.detail : ""}`);
	process.exit(1);
}
console.log(`✓ 宿主半边测试通过（${passed} 项断言：请求栅栏 / 余额解析）`);
