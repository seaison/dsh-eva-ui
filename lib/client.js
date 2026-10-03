/*!
 * dsh-eva-magi-theme v0.1.0 —— 浏览器半边（browser half）
 * MIT License
 *
 * 把 NERV 中央教条区的界面语言装进 DSH Web GUI。
 *
 * 三条设计原则，按重要性排序：
 *
 *   1) 令牌优先于选择器。
 *      DSH 的配色由 `ctx.theme` 组合成主题快照，再由 ui-layout 以 inline style
 *      写到 <body> 上（`body.style.setProperty(name, value)`）。inline style 压过
 *      任何样式表规则，所以「用 CSS 覆盖 --dsw-alias-*」是不会生效的。本插件因此
 *      走官方通道 `ctx.theme.overrideTokens(source, tokens)`：令牌层叠在用户当前
 *      的 light/dark 主题之上，随主题切换自动解析，卸载时精确移除。
 *
 *   2) 只用语义别名，不碰静态调色板。
 *      `--dsw-alias-*` 是组件真正消费的那一层（107 个）。覆盖 `--dsw-static-*`
 *      会连带改掉语义无关的地方，属于过度侵入。
 *
 *   3) 装饰层与令牌层分离。
 *      扫描线 / 暗角 / 网格 / 硬边 / 明朝体这些令牌表达不了的东西，放在插件自有的
 *      样式表与覆盖层里，和插件同生共死；令牌层负责颜色与状态语义。
 *
 * 命名：值一律写成 [light, dark] 两套，这样用户切到浅色主题时皮肤不会崩成
 * 「黑底 + 深色文字」的混合体——浅色走 EVA 技术资料（暖白图纸）那一套。
 */
window.__ModuleLoader__.load({
	id: "dsh-eva-magi-theme",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const PACKAGE_NAME = "dsh-eva-magi-theme";
		const STYLE_TAG_ID = PACKAGE_NAME + ":skin";
		const OVERLAY_CLASS = "eva-magi-layer";
		const OPTIONS_STORAGE_KEY = PACKAGE_NAME + ":options";

		// ============================================================
		// 1. 调色板：设计令牌表
		// ------------------------------------------------------------
		// 键名 → `--dsw-alias-<键名>`；值 → [浅色, 深色]。
		//
		// 深色是本体（MAGI / 中央教条区），浅色是配套的 EVA 技术资料纸质版。
		// 颜色取自 nerv-hud 设计稿：橙 #ff6a00 主色、绿 #7cff4f 数据色、
		// 红 #ff1e1e 警戒色、暖白 #e8e4dc 正文（刻意不用纯白，留 CRT 余晖感）、
		// 底色 #08090a（刻意不用纯黑）。
		// ============================================================
		const PALETTE = {
			// —— 画布与表面：分三层，越靠前越亮，靠发丝线而不是阴影分隔 ——
			"bg-base": ["#f2efe8", "#08090a"],
			"bg-layer-1": ["#faf8f4", "#0c0e10"],
			"bg-layer-2": ["#ffffff", "#101315"],
			"bg-layer-3": ["#ece7dc", "#161a1d"],
			"bg-overlay": ["#ffffff", "#14181b"],
			"bg-module-platform": ["#f0ece3", "#0e1113"],
			"bg-multi-select": ["#d9530a1f", "#ff6a001a"],
			"bg-skeleton": ["#0000000a", "#ffffff0f"],
			"bg-document-preview": ["#faf8f4", "#0c0e10"],
			"label-document-preview": ["#4a4f57", "#cfc9bd"],
			"bg-document-selection": ["#d9530a52", "#ff6a0059"],

			// 遮罩保持黑/白中性，不染橙
			"bg-mask-1": ["#0000003d", "#0000005c"],
			"bg-mask-2": ["#0000001f", "#00000033"],
			"bg-mask-3": ["#0000007a", "#0000008a"],
			"bg-mask-drop": ["#ffffffb3", "#0a0a0acc"],
			"bg-mask-photo": ["#000000e0", "#000000e6"],

			// —— 边框：橙色发丝线，四级递进 ——
			"border-l1": ["#b2450017", "#ff7a1a24"],
			"border-l2": ["#b2450029", "#ff7a1a3d"],
			"border-l3": ["#b2450040", "#ff7a1a57"],
			"border-l4": ["#b2450059", "#ff7a1a7a"],
			"border-l2-darkmode-thin": ["#b2450029", "#ff7a1a1f"],
			"border-inverted": ["#0000", "#0000"],
			"border-inverted2": ["#0000", "#0000"],

			// —— 文本：暖白阶梯。明朝/哥特都靠这四级拉开层级 ——
			"label-primary": ["#16181c", "#e8e4dc"],
			"label-secondary": ["#4a4f57", "#b8b3a8"],
			"label-tertiary": ["#6b7178", "#8d887e"],
			"label-caption": ["#949aa1", "#6b675f"],
			"label-primary-dimmed": ["#2c3036", "#cfc9bd"],
			// 官方定义是 blue-900 / neutral-bluish-50；这里收成暖中性，只为保留
			// 「它和 label-primary 有细微差别」这一层语义，不再往蓝偏。
			"label-primary-bluish": ["#1f242a", "#eceae4"],
			"label-dimmed": ["#c9c3b8", "#57544d"],
			"label-primary-inverted": ["#ffffff", "#0a0a0a"],
			"label-primary-foreground": ["#ffffff", "#0a0a0a"],
			"label-shimmer": ["#0000004d", "#ffffff73"],
			"label-deep-diving": ["#b24500", "#ffb066"],
			"label-deep-diving-shimmer": ["#d9530a", "#ffd9b3"],

			// —— 品牌色＝主色：这是「橙色按钮 + 黑字」的来源 ——
			"brand-primary": ["#c94f08", "#ff6a00"],
			"brand-primary-invert": ["#ffffff", "#0a0a0a"],
			"brand-primary-new-colorprimary-new-color": ["#c94f08", "#ff6a00"],
			"brand-text": ["#b24500", "#ff8a2b"],

			// —— 按钮 ——
			"button-primary-fill": ["#c94f08", "#ff6a00"],
			"button-primary-hover": ["#a8400a", "#ff8f3d"],
			"button-primary-dimmed": ["#c94f0833", "#ff6a0047"],
			"button-contrast-fill": ["#2c3036", "#e8e4dc"],
			"button-elevated-fill": ["#ffffff", "#1b2024"],
			"button-floating-fill": ["#ffffff", "#12161a"],
			"button-floating-hover": ["#f0ece3", "#1b2024"],
			"button-ghost-active-fill": ["#d9530a1f", "#ff6a001f"],
			"button-ghost-active-border": ["#d9530a59", "#ff6a0059"],
			"button-ghost-active-hover": ["#d9530a2e", "#ff6a002e"],
			"button-info-fill": ["#1f8f3a1f", "#7cff4f1f"],
			"button-info-hover": ["#1f8f3a33", "#7cff4f33"],
			"button-tool-bar-fill": ["#faf8f4", "#12161a"],
			"button-tool-bar-fill-invisible": ["#0000", "#0000"],
			"button-tool-bar-hover": ["#d9530a1f", "#ff6a001f"],

			// —— 交互反馈：一律带橙 ——
			"interactive-bg-hover": ["#d9530a14", "#ff6a0014"],
			"interactive-bg-hover-accent": ["#d9530a24", "#ff6a0024"],
			"interactive-bg-hover-danger": ["#c4241c1f", "#ff1e1e24"],
			"interactive-bg-hover-solid": ["#00000014", "#ffffff1a"],
			"interactive-bg-active": ["#d9530a24", "#ff6a0024"],

			// —— 状态语义：这套皮肤里「业务色」就是橙，焦点环也吃它 ——
			"state-business-primary": ["#c94f08", "#ff6a00"],
			"state-business-tertiary": ["#c94f0859", "#ff6a0066"],
			"state-success-primary": ["#1f8f3a", "#7cff4f"],
			"state-success-secondary": ["#1f8f3acc", "#7cff4fcc"],
			"state-success-tertiary": ["#1f8f3a59", "#7cff4f66"],
			"state-warn-primary": ["#b87500", "#ffcc00"],
			"state-warn-secondary": ["#b87500cc", "#ffcc00cc"],
			"state-warn-tertiary": ["#b8750059", "#ffcc0066"],
			"state-warn-label": ["#8a5800", "#ffcc00"],
			"state-error-primary": ["#c4241c", "#ff3b30"],
			"state-error-secondary": ["#c4241ccc", "#ff3b30cc"],
			"state-idle-primary": ["#a8a49b", "#5a6166"],
			"link": ["#b24500", "#ff9a4d"],

			// —— 滚动条：细橙条，像仪表刻度 ——
			"scrollbar-bg-l1": ["#b245002e", "#ff7a1a2e"],
			"scrollbar-bg-l2": ["#b2450024", "#ff7a1a24"],
			"scrollbar-hover-l1": ["#b2450059", "#ff7a1a5c"],
			"scrollbar-hover-l2": ["#b2450047", "#ff7a1a47"],

			// —— 浮层 ——
			"menu-icon": ["#2c3036", "#cfc9bd"],
			"menu-group-header-fill": ["#faf8f4f0", "#0c0e10f0"],
			"tooltip-bg": ["#1b1f23f2", "#161a1df2"],
			"tooltip-key-bg": ["#3a4046", "#262c31"],
			"toast-bg": ["#1b1f23f7", "#161a1df7"],
			"toast-label": ["#f2efe8", "#e8e4dc"],

			// —— 开关 / 设置卡片 ——
			"switch-thumb": ["#ffffff", "#ffd9b3"],
			"settings-card-fill": ["#faf8f4", "#0c0e10"],
			"settings-card-stroke": ["#b2450029", "#ff7a1a33"],

			// —— Markdown / 代码 ——
			"markdown-code-block": ["#f0ece3", "#0b0e10"],
			"markdown-code-block-banner": ["#ece7dc", "#101315"],
			"markdown-inline-code": ["#d9530a1a", "#ff6a001f"],
			"markdown-citation": ["#d9530a24", "#ff6a0024"],
			"markdown-tag": ["#1f8f3a1f", "#7cff4f1f"],
			"markdown-placeholder": ["#949aa1", "#6b675f"],
			"markdown-code-segment-selected": ["#d9530a33", "#ff6a0033"],
			"markdown-code-segment-unselected": ["#0000000f", "#ffffff14"],
			"code-diff-added": ["#1f8f3a1f", "#7cff4f1f"],
			"code-diff-deleted": ["#c4241c1f", "#ff1e1e1f"],

			// —— 文件差异（对齐 code-diff 的语义） ——
			"file-diff-added-bg": ["#1f8f3a14", "#7cff4f14"],
			"file-diff-added-gutter": ["#1f8f3a24", "#7cff4f24"],
			"file-diff-added-marker": ["#1f8f3a", "#7cff4f"],
			"file-diff-deleted-bg": ["#c4241c14", "#ff1e1e14"],
			"file-diff-deleted-gutter": ["#c4241c24", "#ff1e1e24"],
			"file-diff-deleted-marker": ["#c4241c", "#ff1e1e"],

			// —— 引导页 ——
			"onboarding-accent": ["#c94f08", "#ff6a00"],
			"onboarding-card-fill": ["#faf8f4", "#0c0e10"],
			"onboarding-checkbox-border": ["#b2450059", "#ff7a1a59"],
			"onboarding-secondary-fill": ["#f0ece3", "#161a1d"],

			// —— 回合触发器 ——
			"turn-trigger-bg": ["#d9530a12", "#ff6a0012"],
			"turn-trigger-bg-hover": ["#d9530a1f", "#ff6a001f"],
		};

		// ============================================================
		// 2. 皮肤样式表（令牌表达不了的东西）
		// ------------------------------------------------------------
		// 全部规则都挂在 html[data-eva-*] 上：选项关掉即失效，插件卸载即整表移除。
		// 圆角令牌不在主题快照里（快照只含 107 个 --dsw-alias-*），所以它可以用
		// 普通 CSS 覆盖；但默认圆角是 panel 28px，压到 0 是本皮肤最激进的一刀，
		// 因此单独做成可关的开关。
		// ============================================================
		const SKIN_CSS = [
			// —— 硬边：EVA 的世界里没有圆角 ——
			'html[data-eva-edges="hard"]{',
			"--dsw-radius-xs:0px;--dsw-radius-sm:0px;--dsw-radius-md:0px;",
			"--dsw-radius-lg:0px;--dsw-radius-xl:0px;--dsw-radius-panel:0px;",
			"}",

			// —— HUD 数字：等宽对齐，读数不会随内容跳动 ——
			'html[data-eva-nums="on"] body{font-variant-numeric:tabular-nums}',

			// —— 选区用主色 ——
			"html[data-eva-magi] ::selection{",
			"background:var(--dsw-alias-bg-document-selection);",
			"color:var(--dsw-alias-label-primary)",
			"}",

			// —— 标题走明朝体：拉丁仍吃系统无衬线，只有汉字落到明朝 ——
			// 这是 font-family 的逐字符回退：列表里前两个都不含 CJK，汉字自然落到
			// Hiragino Mincho ProN；拉丁在 -apple-system 就被接住了。
			// 只作用于 h1~h3，因为明朝体的横画很细，小字号会糊（这是上一版 nerv-hud
			// 实测到的教训）。
			'html[data-eva-mincho="on"] :is(h1,h2,h3){',
			'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Helvetica,Arial,',
			'"Hiragino Mincho ProN","Hiragino Mincho Pro",YuMincho,"Yu Mincho","Songti SC",serif;',
			"letter-spacing:.01em}",
			'html[data-eva-mincho="on"] :is(h1,h2,h3,strong){-webkit-text-stroke:.2px currentColor}',

			// —— 覆盖层：CRT 质感。z-index 取最大但 pointer-events:none，只影响像素 ——
			"." + OVERLAY_CLASS + "{position:fixed;inset:0;pointer-events:none;z-index:2147483000}",
			"." + OVERLAY_CLASS + ">i{position:absolute;inset:0;display:block}",
			'html[data-eva-scan="off"] .eva-magi-scan,',
			'html[data-eva-grid="off"] .eva-magi-grid,',
			'html[data-eva-vig="off"] .eva-magi-vig,',
			'html[data-eva-top="off"] .eva-magi-top{display:none}',

			// 扫描线：3px 周期、1px 暗线。深色下是 CRT 余晖，浅色下减半免得脏
			".eva-magi-scan{",
			"background:repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0 2px,rgba(0,0,0,.30) 2px 3px);",
			"opacity:var(--eva-scan-strength,.5);mix-blend-mode:multiply}",
			'body:not([data-ds-dark-theme]) .eva-magi-scan{opacity:calc(var(--eva-scan-strength,.5) * .45)}',

			// 网格：默认关闭，开起来像中央教条区的测绘图
			".eva-magi-grid{",
			"background-image:",
			"linear-gradient(var(--dsw-alias-border-l1) 1px,rgba(0,0,0,0) 1px),",
			"linear-gradient(90deg,var(--dsw-alias-border-l1) 1px,rgba(0,0,0,0) 1px);",
			"background-size:48px 48px;opacity:.7}",

			// 暗角：把注意力压回中间
			".eva-magi-vig{",
			"background:radial-gradient(130% 100% at 50% 42%,rgba(0,0,0,0) 46%,rgba(0,0,0,.52) 100%);",
			"opacity:.7}",
			'body:not([data-ds-dark-theme]) .eva-magi-vig{opacity:.22}',

			// 顶边压力线：nerv-hud 里那条 2px 主色渐变
			".eva-magi-top{inset:0 0 auto 0;height:2px;",
			"background:linear-gradient(90deg,var(--dsw-alias-brand-primary),rgba(0,0,0,0) 62%);",
			"opacity:.85}",
		].join("");

		// ============================================================
		// 3. 选项
		// ------------------------------------------------------------
		// 没有设置界面（Appearance 那一行由官方的 light/dark/system 三个方块占据，
		// 第三方主题没有 UI 插槽），所以用 localStorage + 一个全局钩子代替：
		//   __EVA_MAGI_THEME__.set("scanlines", false)
		// ============================================================
		const DEFAULT_OPTIONS = Object.freeze({
			scanlines: true,
			scanlineStrength: 0.5,
			vignette: true,
			grid: false,
			topLine: true,
			hardEdges: true,
			tabularNumbers: true,
			minchoHeadings: true,
		});

		const OPTION_ATTRS = {
			scanlines: "data-eva-scan",
			vignette: "data-eva-vig",
			grid: "data-eva-grid",
			topLine: "data-eva-top",
			hardEdges: "data-eva-edges",
			tabularNumbers: "data-eva-nums",
			minchoHeadings: "data-eva-mincho",
		};

		/** 读回用户上次的选择；localStorage 不可用时静默退回默认值。 */
		function loadOptions() {
			const merged = Object.assign({}, DEFAULT_OPTIONS);
			try {
				const raw = globalThis.localStorage?.getItem(OPTIONS_STORAGE_KEY);
				if (raw) {
					const saved = JSON.parse(raw);
					for (const key of Object.keys(DEFAULT_OPTIONS)) {
						if (typeof saved[key] === typeof DEFAULT_OPTIONS[key]) merged[key] = saved[key];
					}
				}
			} catch (error) {
				/* 无痕模式 / 存储被禁用：皮肤照常工作，只是不记忆 */
			}
			return merged;
		}

		function saveOptions(options) {
			try {
				globalThis.localStorage?.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(options));
			} catch (error) {
				/* 同上 */
			}
		}

		/** 把选项写进 <html> 的 data-* / 自定义属性，CSS 只认这些标记。 */
		function paintOptions(options) {
			const root = document.documentElement;
			root.setAttribute("data-eva-magi", "");
			for (const [key, attr] of Object.entries(OPTION_ATTRS)) {
				const value = options[key];
				if (attr === "data-eva-edges") root.setAttribute(attr, value ? "hard" : "soft");
				else if (attr === "data-eva-nums" || attr === "data-eva-mincho") {
					root.setAttribute(attr, value ? "on" : "off");
				} else root.setAttribute(attr, value ? "on" : "off");
			}
			root.style.setProperty("--eva-scan-strength", String(options.scanlineStrength));
		}

		/**
		 * 在 <body> 存在时立刻执行，否则等 DOMContentLoaded。
		 * 客户端插件正常应在 body 脚本之后物化，但这条保护让「过早物化」这一种
		 * 失败模式变成不可能——皮肤宁可不挂，也不能把宿主页面搞崩。
		 */
		function whenBodyReady(run) {
			if (document.body) return run();
			let dispose = null;
			let cancelled = false;
			const onReady = () => {
				if (!cancelled) dispose = run();
			};
			document.addEventListener("DOMContentLoaded", onReady, { once: true });
			return () => {
				cancelled = true;
				if (typeof dispose === "function") dispose();
			};
		}

		/** 造覆盖层。返回移除函数。 */
		function mountOverlay(options) {
			const layer = document.createElement("div");
			layer.className = OVERLAY_CLASS;
			layer.setAttribute("aria-hidden", "true");
			layer.innerHTML =
				'<i class="eva-magi-grid"></i>' +
				'<i class="eva-magi-vig"></i>' +
				'<i class="eva-magi-scan"></i>' +
				'<i class="eva-magi-top"></i>';
			document.body.appendChild(layer);
			paintOptions(options);
			return () => {
				layer.remove();
				const root = document.documentElement;
				root.removeAttribute("data-eva-magi");
				for (const attr of Object.values(OPTION_ATTRS)) root.removeAttribute(attr);
				root.style.removeProperty("--eva-scan-strength");
			};
		}

		/** 注入插件自有样式表。返回移除函数。 */
		function mountStyles() {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = STYLE_TAG_ID;
			tag.textContent = SKIN_CSS;
			document.head.appendChild(tag);
			return () => tag.remove();
		}

		/** 令牌表 → `overrideTokens` 要的 { light, dark } 形状。 */
		function tokenLayer() {
			const layer = {};
			for (const [alias, [light, dark]] of Object.entries(PALETTE)) {
				layer["--dsw-alias-" + alias] = { light, dark };
			}
			return layer;
		}

		// ============================================================
		// 4. 插件体
		// ============================================================
		/** 服务依赖：theme 由 @deepseek-ai/dsh-client-ui-theme 提供。 */
		const inject = ["theme"];

		/**
		 * @param ctx - 浏览器侧 Cordis 上下文。
		 */
		function apply(ctx) {
			const options = loadOptions();
			let mounted = null;

			// 皮肤样式表 + 覆盖层 + 令牌层，三者的生命周期都挂在 ctx.effect 上，
			// 因此 HMR 重载和插件卸载都不会留下残留。
			ctx.effect(() => mountStyles(), "eva-magi: skin stylesheet");
			ctx.effect(() => whenBodyReady(() => mountOverlay(options)), "eva-magi: crt overlay");
			ctx.effect(
				() => ctx.theme.overrideTokens(PACKAGE_NAME, tokenLayer()),
				"eva-magi: alias token layer",
			);

			// 给用户一个不需要设置界面的开关：
			//   __EVA_MAGI_THEME__.set("grid", true)
			mounted = {
				version: "0.1.0",
				source: PACKAGE_NAME,
				options,
				palette: PALETTE,
				tokens: tokenLayer(),
				set(key, value) {
					if (!(key in DEFAULT_OPTIONS)) {
						throw new Error(
							"[dsh-eva-magi-theme] 未知选项 " + key + "；可用：" + Object.keys(DEFAULT_OPTIONS).join(", "),
						);
					}
					options[key] = value;
					saveOptions(options);
					paintOptions(options);
					return options[key];
				},
				reset() {
					Object.assign(options, DEFAULT_OPTIONS);
					saveOptions(options);
					paintOptions(options);
					return options;
				},
			};
			globalThis.__EVA_MAGI_THEME__ = mounted;
		}

		exports.name = PACKAGE_NAME;
		exports.inject = inject;
		exports.apply = apply;
		exports.PALETTE = PALETTE;
		exports.DEFAULT_OPTIONS = DEFAULT_OPTIONS;
		return module.exports;
	},
});
