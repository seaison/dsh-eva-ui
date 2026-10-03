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
		const BOOT_FLAG = PACKAGE_NAME + ":booted";
		/** 宿主半边提供的只读余额路由（见 lib/index.js）。 */
		const BALANCE_ROUTE = "/dsh-eva-magi/balance.json";

		/**
		 * 设置面板的重绘钩子，由 mountChrome 装上。
		 * 存在的理由：setOption 定义在 apply 里，而面板构建在 mountChrome 里 ——
		 * 用这个工厂级变量把两边接起来，让 Console 改值也能同步到面板控件上。
		 */
		let refreshPanelRef = null;

		/** 标签块的重绘钩子（峰谷状态/倒计时）。同上：把 mountChrome 与 setOption 接起来。 */
		let refreshTagsRef = null;

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
			"label-tertiary": ["#626970", "#8d887e"],
			"label-caption": ["#7c828a", "#6b675f"],
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
			// 官方这一对是 浅色 #0f1115 / 深色 #f9fafb（浅色侧更暗）——它在官方 bundle 里
			// 找不到消费方，所以这里只做一件事：保持与官方同向的极性，别把任何潜在用途弄反。
			"brand-primary-invert": ["#0a0a0a", "#e8e4dc"],
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
			// 注意 tooltip-bg：官方设计里它「两种色板都是深底」，而 DSH 并没有
			// tooltip-label 令牌——气泡里的文字颜色不由皮肤决定。这里的覆盖只保证
			// 不改变它在浅/深两套里的极性（依然是深底），免得把官方组件的文字弄没。
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
		const SKIN_CSS = `
/* ============================================================================
   0. 令牌表达不了的部分：形状、数字、明朝体
   ============================================================================ */

/* 硬边：EVA 的世界里没有圆角 */
html[data-eva-edges="hard"]{
  --dsw-radius-xs:0px;--dsw-radius-sm:0px;--dsw-radius-md:0px;
  --dsw-radius-lg:0px;--dsw-radius-xl:0px;--dsw-radius-panel:0px;
}
/* HUD 数字：等宽对齐，读数不会随内容跳动 */
html[data-eva-nums="on"] body{font-variant-numeric:tabular-nums}
/* 选区用主色 */
html[data-eva-magi] ::selection{
  background:var(--dsw-alias-bg-document-selection);
  color:var(--dsw-alias-label-primary);
}
/* 标题走明朝体：拉丁仍吃系统无衬线，只有汉字落到明朝。
   靠 font-family 的逐字符回退实现，且只作用于 h1~h3 —— 明朝体横画很细，
   小字号在暗底会糊（这是 nerv-hud 实测到的教训）。 */
html[data-eva-mincho="on"] :is(h1,h2,h3){
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Helvetica,Arial,
    "Hiragino Mincho ProN","Hiragino Mincho Pro",YuMincho,"Yu Mincho","Songti SC",serif;
  letter-spacing:.01em;
}
html[data-eva-mincho="on"] :is(h1,h2,h3,strong){-webkit-text-stroke:.2px currentColor}

/* ============================================================================
   1. 覆盖层：CRT 质感 + 结构性装饰
   所有装饰都在 .eva-magi-layer 里，pointer-events:none，只影响像素。
   颜色一律用主题令牌，所以浅/深两套自动跟随。
   ============================================================================ */
.${OVERLAY_CLASS}{
  --eva-accent:var(--dsw-alias-brand-primary);
  --eva-hair:var(--dsw-alias-border-l2);
  --eva-line:var(--dsw-alias-border-l3);
  --eva-dim:var(--dsw-alias-label-caption);
  --eva-panel:color-mix(in srgb, var(--dsw-alias-bg-layer-1) 88%, transparent);
  position:fixed;inset:0;pointer-events:none;z-index:2147483000;
}
.${OVERLAY_CLASS}>*{position:absolute;display:block}

html[data-eva-scan="off"] .eva-magi-scan,
html[data-eva-grid="off"] .eva-magi-grid,
html[data-eva-vig="off"] .eva-magi-vig,
html[data-eva-top="off"] .eva-magi-top,
html[data-eva-beam="off"] .eva-magi-beam,
html[data-eva-chrome="off"] .eva-frame,
html[data-eva-chrome="off"] .eva-edge,
html[data-eva-chrome="off"] .eva-hazard,
html[data-eva-chrome="off"] .eva-tags,
html[data-eva-hud="off"] .eva-hud{display:none}

/* 扫描线：3px 周期、1px 暗线。深色下是 CRT 余晖，浅色下减半免得脏 */
.eva-magi-scan{
  inset:0;
  background:repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0 2px,rgba(0,0,0,.30) 2px 3px);
  opacity:var(--eva-scan-strength,.5);mix-blend-mode:multiply;
}
body:not([data-ds-dark-theme]) .eva-magi-scan{opacity:calc(var(--eva-scan-strength,.5) * .45)}

/* 暗角：把注意力压回中间 */
.eva-magi-vig{
  inset:0;
  background:radial-gradient(130% 100% at 50% 42%,rgba(0,0,0,0) 46%,rgba(0,0,0,.52) 100%);
  opacity:.7;
}
body:not([data-ds-dark-theme]) .eva-magi-vig{opacity:.22}

/* 测绘网格：默认关闭 */
.eva-magi-grid{
  inset:0;
  background-image:
    linear-gradient(var(--dsw-alias-border-l1) 1px,rgba(0,0,0,0) 1px),
    linear-gradient(90deg,var(--dsw-alias-border-l1) 1px,rgba(0,0,0,0) 1px);
  background-size:48px 48px;opacity:.7;
}

/* 顶边压力线 + 刻度 */
.eva-magi-top{
  inset:0 0 auto 0;height:2px;
  background:linear-gradient(90deg,var(--eva-accent),rgba(0,0,0,0) 62%);
  opacity:.85;
}
.eva-magi-top::after{
  content:"";position:absolute;left:0;right:0;top:6px;height:7px;
  background:repeating-linear-gradient(90deg,var(--eva-accent) 0 1px,rgba(0,0,0,0) 1px 24px);
  opacity:.28;
}

/* 走行的刷新带：老 CRT 的场同步条，9 秒扫一遍 */
.eva-magi-beam{
  inset:0 0 auto 0;height:150px;
  background:linear-gradient(to bottom,rgba(0,0,0,0),rgba(255,255,255,.035),rgba(0,0,0,0));
  animation:eva-beam 9s linear infinite;
}
@keyframes eva-beam{0%{transform:translateY(-160px)}100%{transform:translateY(100vh)}}

/* ---- 框架：内嵌发丝线 + 四角 L 标 ---- */
.eva-frame{position:absolute;inset:5px;border:1px solid var(--eva-hair)}
.eva-corner{position:absolute;width:17px;height:17px;border:2px solid var(--eva-accent);opacity:.7}
.eva-corner.tl{left:5px;top:5px;border-right:0;border-bottom:0}
.eva-corner.tr{right:5px;top:5px;border-left:0;border-bottom:0}
.eva-corner.bl{left:5px;bottom:5px;border-right:0;border-top:0}
.eva-corner.br{right:5px;bottom:5px;border-left:0;border-top:0}

/* ---- 左右刻度尺：每 8px 短刻度、每 40px 长刻度 ---- */
.eva-edge{position:absolute;top:70px;bottom:74px;left:7px;width:8px;opacity:.5;
  background:
    repeating-linear-gradient(to bottom,var(--eva-line) 0 1px,rgba(0,0,0,0) 1px 8px) left/3px 100% no-repeat,
    repeating-linear-gradient(to bottom,var(--eva-accent) 0 1px,rgba(0,0,0,0) 1px 40px) left/8px 100% no-repeat;}
.eva-edge.r{left:auto;right:7px;background-position:right,right}

/* ---- 底部危险条纹 ---- */
.eva-hazard{
  inset:auto 0 0 0;height:5px;opacity:.4;
  background:repeating-linear-gradient(45deg,
    var(--dsw-alias-state-warn-primary) 0 5px,rgba(0,0,0,0) 5px 10px);
}

/* ---- 右下角叠层：标签块 + 仪表簇 ----
   位置约束来自实测：输入框卡片右缘在 x=1373（1600 宽窗口下居中），发送/暂停按钮
   就贴在它的右端，所以这块装饰的总宽必须 ≤ 约 200px 才塞得进右侧留白。
   早先版本宽 263px，直接压住了输入框和发送按钮 —— 用户的原话是
   「右下角的中央教条区需要不遮挡下面输入框和暂停按钮」。

   自动避让：JS 会量输入框的实际位置，把可用留白写进 data-fit。
   空间不够就降级（先丢标签块、再只留一行读数），不够到一定程度就整块隐藏 ——
   装饰宁可消失，也不能压住控件。 */
.eva-corner-stack{
  position:absolute;right:18px;bottom:20px;
  display:flex;flex-direction:column;align-items:flex-end;gap:6px;
  /* 缩放用 transform 而不是改字号：不影响布局流，而且 getBoundingClientRect
     量到的是缩放后的视觉尺寸 —— 下面的避让逻辑正好需要这个值。
     transform-origin 固定在右下角，放大时它从角落里长出来，不会漂。 */
  transform:scale(var(--eva-hud-scale,1));
  transform-origin:100% 100%;
}
.eva-corner-stack[data-fit="compact"] .eva-tags{display:none}
.eva-corner-stack[data-fit="compact"] .eva-hud-grid > :nth-child(n+3){display:none}
.eva-corner-stack[data-fit="compact"] .eva-blocks,
.eva-corner-stack[data-fit="compact"] .eva-hud-hazard{display:none}
.eva-corner-stack[data-fit="hidden"]{display:none}
.eva-tags{
  /* 用网格把两个面叠在同一个格子里：容器尺寸取较宽的一面，
     所以翻转前后宽度不跳（避让逻辑也就不必跟着重算）。
     3D 翻转 + backface-visibility 让两面不会同时露出来。 */
  display:grid;transform-style:preserve-3d;
  transition:transform .5s cubic-bezier(.2,.75,.2,1);
  pointer-events:auto;cursor:pointer;
}
.eva-tags[data-face="back"]{transform:rotateX(180deg)}
.eva-tags:focus-visible{outline:2px solid var(--eva-accent);outline-offset:2px}
.eva-tags-face{
  grid-area:1/1;display:flex;flex-direction:column;align-items:flex-end;gap:5px;
  backface-visibility:hidden;
}
.eva-tags-back{transform:rotateX(180deg)}
.eva-tag--balance b,.eva-tag--today b{
  font:400 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.04em;
  font-variant-numeric:tabular-nums;
}
/* 反白标签块：nerv-hud 里那种橙底黑字 */
.eva-tag{
  display:flex;align-items:center;gap:6px;
  font:700 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  letter-spacing:.2em;text-transform:uppercase;
  padding:4px 8px;background:var(--eva-accent);color:#0a0a0a;
  box-shadow:0 0 12px color-mix(in srgb,var(--eva-accent) 45%,transparent);
}
.eva-tag small{font:400 9px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em;opacity:.72}
.eva-tag.ghost{background:transparent;color:var(--eva-accent);box-shadow:none;
  border:1px solid var(--eva-line)}

/* ---- 仪表簇：NERV 状态盘 ---- */
.eva-hud{
  display:flex;align-items:stretch;
  border:1px solid var(--eva-hair);
  background:var(--eva-panel);
  box-shadow:0 0 26px rgba(0,0,0,.35), inset 0 0 22px color-mix(in srgb,var(--eva-accent) 6%,transparent);
  font:9.5px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.04em;color:var(--eva-dim);
}
.eva-hud-vlabel{
  writing-mode:vertical-rl;text-orientation:upright;
  display:flex;align-items:center;justify-content:center;
  padding:8px 4px;border-right:1px solid var(--eva-hair);
  font-family:"Hiragino Mincho ProN","Hiragino Mincho Pro",YuMincho,"Songti SC",serif;
  font-size:11px;letter-spacing:.24em;color:var(--eva-accent);opacity:.85;
  background:color-mix(in srgb,var(--eva-accent) 7%,transparent);
}
/* 不设 min-width：让四路读数自己决定宽度，整体压在 200px 以内 */
.eva-hud-body{padding:6px 8px}
.eva-hud-head{display:flex;align-items:center;gap:5px;margin-bottom:3px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  font-weight:700;font-size:10px;letter-spacing:.26em;color:var(--eva-accent)}
.eva-hud-head i{width:6px;height:6px;background:var(--eva-accent);display:block;
  animation:eva-blink 1.15s steps(1) infinite}
@keyframes eva-blink{0%,58%{opacity:1}59%,100%{opacity:.1}}
.eva-hud-grid{display:grid;grid-template-columns:auto 1fr;gap:1px 6px}
.eva-hud-grid span{color:var(--eva-dim)}
.eva-hud-grid em{font-style:normal;color:var(--dsw-alias-label-secondary)}
.eva-hud-grid em.hot{color:var(--eva-accent)}
.eva-blocks{display:flex;gap:2px;margin-top:4px}
.eva-blocks i{flex:1;min-width:0;height:4px;background:var(--dsw-alias-border-l1);animation:eva-block 2.4s steps(1) infinite;animation-delay:calc(var(--i) * -.13s)}
@keyframes eva-block{0%,70%{background:var(--dsw-alias-border-l1)}71%,100%{background:var(--eva-accent)}}
.eva-hud-hazard{height:3px;margin-top:4px;opacity:.5;
  background:repeating-linear-gradient(45deg,var(--eva-accent) 0 4px,rgba(0,0,0,0) 4px 8px)}

/* ---- 仪表可点：点它调出设置面板 ----
   整个装饰层是 pointer-events:none（绝不挡应用），这里只把仪表单独恢复成可点。
   之所以安全：自动避让保证仪表的左缘永远在输入框右缘之外，所以它盖不到
   发送/暂停按钮，也就不会抢走本该属于控件的点击。 */
.eva-hud{pointer-events:auto;cursor:pointer}
.eva-hud:hover{border-color:var(--eva-accent)}
.eva-hud:focus-visible{outline:2px solid var(--eva-accent);outline-offset:2px}

/* ---- 设置面板 ---- */
.eva-panel{
  position:absolute;right:0;bottom:calc(100% + 8px);
  /* 面板是仪表簇的子元素，会被 --eva-hud-scale 一起放大。
     这里用反向倍率把它抵回原尺寸：调仪表的视觉大小，不该顺带改设置面板的字号。
     origin 取自己的右下角，抵回来之后仍然贴着仪表的右上角。 */
  transform:scale(var(--eva-hud-scale-inv,1));
  transform-origin:100% 100%;
  width:298px;max-height:560px;overflow:auto;pointer-events:auto;
  border:1px solid var(--eva-accent);
  background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 97%,transparent);
  box-shadow:0 0 0 1px rgba(0,0,0,.45),0 14px 44px rgba(0,0,0,.55),
    inset 0 0 30px color-mix(in srgb,var(--eva-accent) 5%,transparent);
  font:10px/1.5 ui-monospace,Menlo,monospace;letter-spacing:.03em;
  color:var(--dsw-alias-label-secondary);
}
.eva-panel[hidden]{display:none}
.eva-panel-head{
  position:sticky;top:0;z-index:1;
  display:flex;align-items:center;gap:6px;padding:5px 8px;
  background:var(--eva-accent);color:#0a0a0a;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  font-weight:700;font-size:10px;letter-spacing:.2em;text-transform:uppercase;
}
.eva-panel-head small{margin-left:auto;font:400 9px/1 ui-monospace,Menlo,monospace;
  letter-spacing:.1em;opacity:.7}
.eva-panel-body{padding:5px 8px 7px}
.eva-group{margin:7px 0 2px;padding-top:6px;border-top:1px solid var(--eva-hair);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  font-weight:700;font-size:9px;letter-spacing:.24em;color:var(--eva-accent)}
.eva-group:first-child{margin-top:0;padding-top:0;border-top:0}
.eva-row{display:flex;align-items:center;gap:8px;padding:3px 0}
.eva-row-label{flex:1;min-width:0}
.eva-row-label b{display:block;font-weight:400;font-size:10.5px;
  color:var(--dsw-alias-label-primary)}
.eva-row-label i{font-style:normal;font-size:9px;color:var(--eva-dim);letter-spacing:.04em}
.eva-row[data-dim="1"]{opacity:.42}
/* 开关：硬边小方块。ON 时橙底黑字 —— 和反白标签块同一套语言 */
.eva-sw{
  flex:0 0 auto;min-width:40px;padding:3px 6px;cursor:pointer;border-radius:0;
  border:1px solid var(--eva-line);background:transparent;color:var(--eva-dim);
  font:700 9px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;
}
.eva-sw[aria-checked="true"]{background:var(--eva-accent);color:#0a0a0a;border-color:var(--eva-accent)}
.eva-sw:hover{border-color:var(--eva-accent);color:var(--eva-accent)}
.eva-sw[aria-checked="true"]:hover{color:#0a0a0a}
.eva-sw:focus-visible{outline:2px solid var(--eva-accent);outline-offset:1px}
/* 浓度滑杆 */
.eva-row input[type=range]{
  -webkit-appearance:none;appearance:none;flex:0 0 92px;height:14px;
  background:transparent;cursor:crosshair;
}
.eva-row input[type=range]::-webkit-slider-runnable-track{height:2px;background:var(--eva-line)}
.eva-row input[type=range]::-webkit-slider-thumb{
  -webkit-appearance:none;width:9px;height:14px;margin-top:-6px;
  background:var(--eva-accent);border-radius:0;
}
.eva-val{flex:0 0 32px;text-align:right;font-size:9px;color:var(--dsw-alias-label-tertiary)}
.eva-panel-foot{display:flex;gap:6px;padding:7px 8px 8px;border-top:1px solid var(--eva-hair)}
.eva-btn{
  flex:1;padding:4px 0;cursor:pointer;border-radius:0;
  border:1px solid var(--eva-line);background:transparent;color:var(--eva-accent);
  font:700 9px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;
}
.eva-btn:hover{background:var(--eva-accent);color:#0a0a0a;border-color:var(--eva-accent)}
.eva-panel-note{padding:0 8px 7px;font-size:9px;color:var(--eva-dim);line-height:1.45}

/* ---- 两个标签块：峰谷状态 + 倒计时 ----
   状态配色：高峰 = 琥珀（注意），空闲/周末/假日 = 数据绿（便宜）。
   倒计时跟着状态走色，30 分钟内切换时状态块闪烁预警。 */
.eva-tags[data-state="peak"] .eva-tag--state{background:var(--dsw-alias-state-warn-primary);color:#0a0a0a}
.eva-tags[data-state="offhours"] .eva-tag--state,
.eva-tags[data-state="weekend"] .eva-tag--state,
.eva-tags[data-state="holiday"] .eva-tag--state{background:var(--dsw-alias-state-success-primary);color:#0a0a0a}
.eva-tags[data-state="off"] .eva-tag--state{background:var(--eva-accent);color:#0a0a0a}
.eva-tags[data-state="peak"] .eva-tag--remain{
  color:var(--dsw-alias-state-warn-primary);
  border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 45%,transparent)}
.eva-tags[data-state="offhours"] .eva-tag--remain,
.eva-tags[data-state="weekend"] .eva-tag--remain,
.eva-tags[data-state="holiday"] .eva-tag--remain{
  color:var(--dsw-alias-state-success-primary);
  border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 45%,transparent)}
.eva-tag--remain b{font:400 11px/1 ui-monospace,Menlo,monospace;
  letter-spacing:.06em;font-variant-numeric:tabular-nums}
.eva-tag--state b{white-space:nowrap}
.eva-tags[data-imminent="1"] .eva-tag--state{animation:eva-blink 1.15s steps(1) infinite}

/* ============================================================================
   2. 应用元素的装饰
   只用「不会改变布局、不会与应用自身冲突」的属性：box-shadow / outline /
   border-color / letter-spacing。刻意不用 ::before/:after（可能覆盖应用自己的
   伪元素）与 background-image（可能覆盖应用自己的底纹）。
   挂钩一律用 data-* 语义属性（应用自己就是拿它们当样式钩子的），不用哈希类名。
   ============================================================================ */

/* 会话列表：选中项左侧一条橙色标志条 —— 仪表盘式的选中态 */
html[data-eva-magi] [role="treeitem"][aria-selected="true"],
html[data-eva-magi] [role="treeitem"][data-selected="true"]{
  box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary);
}
/* 顶栏：用 inset 阴影画分隔线，不占布局（改 border 宽度会挤动内容） */
html[data-eva-magi] [data-conversation-header]{
  box-shadow:inset 0 -1px 0 var(--dsw-alias-border-l2);
}
/* 主区域：一层极淡的橙色环境光，把中心区从纯黑里拉出来 */
html[data-eva-magi] [data-conversation-region]{
  box-shadow:inset 0 0 140px color-mix(in srgb,var(--dsw-alias-brand-primary) 4%,transparent);
}
/* 输入卡片：外圈发丝线 + 内层橙色浸润 */
html[data-eva-magi] [data-composer-card]{
  box-shadow:0 0 0 1px var(--dsw-alias-border-l3),
    inset 0 0 34px color-mix(in srgb,var(--dsw-alias-brand-primary) 5%,transparent);
}
html[data-eva-magi] [data-composer-card]:focus-within{
  box-shadow:0 0 0 1px var(--dsw-alias-brand-primary),
    inset 0 0 34px color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,transparent),
    0 0 22px color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent);
}
/* 右侧栏 / 停靠面板：刻意不加描边。
   踩过的坑：早先这里给 [data-sidebar-right-panel] 加了 inset 1px 环，那个面板却是
   全高透明层（x 从屏幕正中到右缘、y 全高），于是它的左边在屏幕正中画出一条竖线、
   上边在顶端画出一条横线，拼成一个毫无意义的 L 形——用户的评价就是「多余的」。
   教训：装饰只能画在真的会绘制出来的表面上。 */
/* 按钮：加字距，悬停时内描一圈橙 —— 不设背景，避免盖掉应用的状态色 */
html[data-eva-magi] button{letter-spacing:.08em}
html[data-eva-magi] button:hover{
  box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l4);
}
/* 键帽：老终端的实体键 */
html[data-eva-magi] kbd{
  padding:1px 5px;border:1px solid var(--dsw-alias-border-l3);
  background:var(--dsw-alias-bg-layer-3);
  box-shadow:0 1px 0 var(--dsw-alias-border-l2);
}
/* 滚动条：细橙条，像仪表刻度 */
html[data-eva-magi] ::-webkit-scrollbar{width:10px;height:10px}
html[data-eva-magi] ::-webkit-scrollbar-track{background:transparent}
html[data-eva-magi] ::-webkit-scrollbar-thumb{
  background:var(--dsw-alias-scrollbar-bg-l1);border:0;
  border-left:1px solid var(--dsw-alias-border-l2);
}
html[data-eva-magi] ::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l1)}
html[data-eva-magi] ::-webkit-scrollbar-corner{background:transparent}
/* 分隔线变危险条纹 */
html[data-eva-magi] hr{
  border:0;height:5px;opacity:.4;
  background:repeating-linear-gradient(45deg,
    var(--dsw-alias-state-warn-primary) 0 5px,rgba(0,0,0,0) 5px 10px);
}
/* 代码块左侧主色竖线 */
html[data-eva-magi] pre{box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)}
/* 浮层：橙色外环 + 冷光 */
html[data-eva-magi] :is([role="dialog"],[role="menu"],[role="listbox"]){
  box-shadow:0 0 0 1px var(--dsw-alias-brand-primary),
    0 0 30px color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);
}
/* 焦点环统一走主色（focus.css 的兜底色是 state-business-primary，这里显式固定） */
html[data-eva-magi] :focus-visible{--dsw-focus-ring-color:var(--dsw-alias-brand-primary)}

/* ============================================================================
   2b. 追加的结构元素：雷达环 / 角编号 / 色散 / 扫描高光
   ============================================================================ */

/* 同心雷达环：MAGI 显示屏的底纹。极淡，只为让大片空白有「未填满的仪表盘」感 */
.eva-rings{
  inset:0;opacity:.5;
  background-image:repeating-radial-gradient(circle at 50% 46%,
    color-mix(in srgb,var(--eva-accent) 11%,transparent) 0 1px,rgba(0,0,0,0) 1px 54px);
}
html[data-eva-rings="off"] .eva-rings{display:none}

/* 四角编号：EVA 屏幕上到处是这种规格码（设施编号 / 机体番号 / 模式码）。
   刻意压在 top:52px 而不是顶角 —— 顶栏两端分别是应用自己的徽标与侧栏折叠按钮，
   第一版把编号放顶角时正好压在徽标上。 */
.eva-id{
  position:absolute;font:9px/1 ui-monospace,Menlo,monospace;
  letter-spacing:.2em;color:var(--eva-accent);opacity:.55;padding:4px 6px;
}
.eva-id.tl{left:6px;top:52px}
.eva-id.tr{right:6px;top:52px}

/* CRT 色散：红/青两条线相对偏移 1px，模仿显像管的三枪不重合。
   只作用在内嵌框架上，所以不会让正文发虚。 */
.eva-frame::before,.eva-frame::after{
  content:"";position:absolute;inset:-3px;border:1px solid;opacity:.3;
}
.eva-frame::before{border-color:#ff2f2f;transform:translate(-1px,-1px)}
.eva-frame::after{border-color:#39e6ff;transform:translate(1px,1px)}

/* 刻度尺上的扫描高光：像游标量规在滑 */
.eva-edge{overflow:hidden}
.eva-edge::after{
  content:"";position:absolute;left:0;right:0;height:70px;opacity:.28;
  background:linear-gradient(to bottom,rgba(0,0,0,0),var(--eva-accent),rgba(0,0,0,0));
  animation:eva-ruler 6.5s linear infinite;
}
.eva-edge.r::after{animation-duration:7.8s;animation-delay:-2.5s}
@keyframes eva-ruler{0%{top:-70px}100%{top:100%}}

/* ============================================================================
   3. 开机序列：一次会话只放一次，pointer-events:none 所以永不挡操作
   ============================================================================ */
.eva-boot{
  position:fixed;inset:0;z-index:2147483100;pointer-events:none;
  display:grid;place-items:center;
  background:#05060700;
  animation:eva-boot-out 2.6s ease-in forwards;
}
@keyframes eva-boot-out{
  0%,62%{background:rgba(5,6,7,.96);opacity:1}
  100%{background:rgba(5,6,7,0);opacity:0;visibility:hidden}
}
.eva-boot-card{min-width:420px;padding:22px 26px;
  border:1px solid var(--eva-line);background:rgba(8,9,10,.9);
  box-shadow:0 0 60px rgba(0,0,0,.6), inset 0 0 40px rgba(255,106,0,.05);
  font-family:ui-monospace,Menlo,monospace;color:#e8e4dc}
.eva-boot-card .jp{
  font-family:"Hiragino Mincho ProN","Hiragino Mincho Pro",YuMincho,"Songti SC",serif;
  font-size:26px;font-weight:600;letter-spacing:.3em;color:#ff6a00;
  border-top:1px solid #ff6a0066;padding-top:9px;
}
.eva-boot-card .en{font-size:10px;letter-spacing:.34em;color:#8d887e;text-transform:uppercase;margin-top:5px}
.eva-boot-card .bar{display:flex;gap:3px;margin:15px 0 11px}
.eva-boot-card .bar i{flex:1;height:9px;background:#ff6a0022;
  animation:eva-boot-block .5s steps(1) forwards;animation-delay:calc(var(--i) * 55ms)}
@keyframes eva-boot-block{to{background:#ff6a00}}
.eva-boot-card .msg{font-size:10.5px;letter-spacing:.18em;color:#b8b3a8}
.eva-boot-card .msg b{color:#7cff4f;font-weight:400}
`;

		// ============================================================
		// 3. 选项
		// ------------------------------------------------------------
		// 没有设置界面（Appearance 那一行由官方的 light/dark/system 三个方块占据，
		// 第三方主题没有 UI 插槽），所以用 localStorage + 一个全局钩子代替：
		//   __EVA_MAGI_THEME__.set("scanlines", false)
		// ============================================================
		const DEFAULT_OPTIONS = Object.freeze({
			// 资讯显示：把右下两个标签块换成 DeepSeek 峰谷计费状态 + 下一切换倒计时
			pricing: true,
			// 仪表自身的缩放倍率（面板滑杆 / Cmd+滚轮可调）
			hudScale: 1.35,
			// 结构性装饰（v0.2 新增）——「EVA 元素太少」的直接回应
			chrome: true, // 内嵌框架 + 四角 L 标 + 危险条纹 + 左右刻度尺 + 反白标签块
			hud: true, // 右下角仪表簇（竖排汉字 + 实时读数 + 方块流）
			beam: false, // 走行的场同步带（白线扫屏；实测后被要求关掉，改为默认关）
			boot: true, // 开机序列（每个会话只放一次）
			// 质感层
			// 扫描线默认关闭（用户实测后要求先去掉）。想开回来：
			//   __EVA_MAGI_THEME__.set("scanlines", true)
			scanlines: false,
			scanlineStrength: 0.5,
			vignette: true,
			grid: false,
			rings: true,
			topLine: true,
			// 形状与排版
			hardEdges: true,
			tabularNumbers: true,
			minchoHeadings: true,
		});

		// ============================================================
		// 设置面板的规格
		// ------------------------------------------------------------
		// 仪表可点开面板，面板里是同一批开关。刻意**不把 hud 自己**列进来：
		// 面板是仪表的一部分，关掉仪表等于把自己关在门外（只能回 Console 开）。
		// ============================================================
		const PANEL_SPEC = [
			{
				group: "仪表",
				items: [
					{ key: "hudScale", label: "仪表尺寸", type: "range", min: 0.7, max: 1.6, step: 0.05 },
				],
			},
			{
				group: "资讯显示",
				items: [
					{ key: "pricing", label: "峰谷时段与倒计时", hint: "替换右下两个标签块" },
				],
			},
			{
				group: "结构装饰",
				items: [
					{ key: "chrome", label: "内嵌框架 · 角标 · 刻度尺" },
					{ key: "boot", label: "开机序列", hint: "每次会话首次加载" },
					{ key: "beam", label: "场同步带", hint: "滚动白线" },
					{ key: "rings", label: "同心雷达环" },
				],
			},
			{
				group: "质感",
				items: [
					{ key: "scanlines", label: "CRT 扫描线" },
					{ key: "scanlineStrength", label: "扫描线浓度", type: "range" },
					{ key: "vignette", label: "四角压暗" },
					{ key: "grid", label: "测绘网格", hint: "48px" },
				],
			},
			{
				group: "形状与排版",
				items: [
					{ key: "hardEdges", label: "硬边", hint: "圆角归零" },
					{ key: "tabularNumbers", label: "等宽数字" },
					{ key: "minchoHeadings", label: "标题明朝体", hint: "h1~h3" },
					{ key: "topLine", label: "顶边压力线" },
				],
			},
		];

		// 选项 → <html> 上的标记。boot 不在表里：它是一次性 DOM，不走 CSS 开关。
		const OPTION_ATTRS = {
			chrome: "data-eva-chrome",
			hud: "data-eva-hud",
			beam: "data-eva-beam",
			scanlines: "data-eva-scan",
			vignette: "data-eva-vig",
			grid: "data-eva-grid",
			rings: "data-eva-rings",
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
				const on = Boolean(options[key]);
				// edges 是三态（hard/soft），其余都是 on/off
				root.setAttribute(attr, attr === "data-eva-edges" ? (on ? "hard" : "soft") : on ? "on" : "off");
			}
			root.style.setProperty("--eva-scan-strength", String(options.scanlineStrength));
			// 仪表缩放走自定义属性（不是开关，所以不在 OPTION_ATTRS 里）
			root.style.setProperty("--eva-hud-scale", String(options.hudScale));
			// 面板是仪表的子元素，会被一起放大。反向倍率让它保持原尺寸（见 .eva-panel）。
			root.style.setProperty("--eva-hud-scale-inv", String(1 / options.hudScale));
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

		// ============================================================
		// 峰谷计价：把当前处于高峰还是空闲算出来，并给出下一切换时刻
		// ------------------------------------------------------------
		// 规则与 DSH 生态里已有的实现（dsh-whale-widget）同源，其依据是
		// DeepSeek 官方计费文档 + 国务院节假日安排：
		//
		//   高峰 = 北京时间 周一至周五（不含中国法定节假日）9:00–12:00、14:00–18:00
		//   空闲 = 其余全部，含 周末（2026-08-23 起）、调休上班的周末、
		//          以及中国法定节假日全天（2026-09-19 起）
		//
		// 全部在本地按时钟推算：不联网、不读账号、不碰任何用户数据。
		// 唯一的风险是规则会变 —— 所以节假日清单只覆盖到 HOLIDAY_COVERED_YEAR，
		// 超出范围时状态照旧推算，但会标注 certainty=inferred，界面上显示「推定」。
		// ============================================================
		const PEAK_HOURS = [
			[9, 12],
			[14, 18],
		];
		// 北京时间 2026-08-23 00:00 起：周末全天按空闲计
		const WEEKEND_VALLEY_FROM = Math.floor(Date.UTC(2026, 7, 22, 16, 0, 0) / 1000);
		// 北京时间 2026-09-19 00:00 起：法定节假日全天按空闲计
		const HOLIDAY_VALLEY_FROM = Math.floor(Date.UTC(2026, 8, 18, 16, 0, 0) / 1000);
		// 只列「放假」的日期：调休上班日全部落在周末，按周末规则本就是空闲。
		// 来源：《国务院办公厅关于 2026 年部分节假日安排的通知》。
		// ⚠️ 每年 11 月国务院发布次年安排后需要补下一年；未覆盖的年份会被标为「推定」。
		const HOLIDAY_COVERED_YEAR = 2026;
		const HOLIDAY_VALLEY = new Set([
			"2026-01-01", "2026-01-02", "2026-01-03",
			"2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19",
			"2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
			"2026-04-04", "2026-04-05", "2026-04-06",
			"2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
			"2026-06-19", "2026-06-20", "2026-06-21",
			"2026-09-25", "2026-09-26", "2026-09-27",
			"2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
			"2026-10-05", "2026-10-06", "2026-10-07",
		]);

		/**
		 * 某个时刻的计费状态。
		 * @param sec - epoch 秒。
		 * @returns {peak, reason, inferred}。reason ∈ peak|offhours|weekend|holiday。
		 */
		function pricingStateAt(sec) {
			// 平移 +8h 后用 UTC 读，得到的就是北京时间的日历日与小时
			const bj = new Date(sec * 1000 + 8 * 3600 * 1000);
			const dow = bj.getUTCDay();
			const day = bj.toISOString().slice(0, 10);
			// 先判法定节假日再判周末：两者可能同时成立（如国庆里的周六）。
			// 此时报「休日」才和信息一致 —— 否则标签写着「週末」，
			// 倒计时却是整个假期的长度（4 天），自相矛盾。
			if (sec >= HOLIDAY_VALLEY_FROM && HOLIDAY_VALLEY.has(day)) {
				return { peak: false, reason: "holiday", inferred: false };
			}
			if (sec >= WEEKEND_VALLEY_FROM && (dow === 0 || dow === 6)) {
				return { peak: false, reason: "weekend", inferred: false };
			}
			const hour = bj.getUTCHours();
			for (const [start, end] of PEAK_HOURS) {
				if (hour >= start && hour < end) return { peak: true, reason: "peak", inferred: false };
			}
			return { peak: false, reason: "offhours", inferred: bj.getUTCFullYear() > HOLIDAY_COVERED_YEAR };
		}

		/**
		 * 下一个峰谷切换时刻（epoch 秒），与 pricingStateAt 完全同源。
		 * 只需扫北京时间的 0/9/12/14/18 点边界；最长假期 9 天，扫 12 天留足余量。
		 */
		function nextPricingChangeAt(sec) {
			if (!Number.isFinite(sec)) return null;
			const current = pricingStateAt(sec).peak;
			const day0 = Math.floor((sec + 8 * 3600) / 86400) * 86400;
			for (let d = 0; d <= 12; d += 1) {
				for (const edge of [0, 9, 12, 14, 18]) {
					const candidate = day0 + d * 86400 + edge * 3600 - 8 * 3600;
					if (candidate <= sec + 1) continue;
					if (pricingStateAt(candidate).peak !== current) return candidate;
				}
			}
			return null;
		}

		/** 剩余时长 → 显示文本。跨天时用「N日 HH:MM:SS」，否则 HH:MM:SS。 */
		function formatRemaining(seconds) {
			const total = Math.max(0, Math.floor(seconds));
			const days = Math.floor(total / 86400);
			const rest = total % 86400;
			const hh = String(Math.floor(rest / 3600)).padStart(2, "0");
			const mm = String(Math.floor((rest % 3600) / 60)).padStart(2, "0");
			const ss = String(rest % 60).padStart(2, "0");
			return days > 0 ? days + "日" + hh + ":" + mm + ":" + ss : hh + ":" + mm + ":" + ss;
		}

		/**
		 * 造设置面板。
		 *
		 * 与 Console 钩子共用同一个 setOption —— 两条路改的是同一份状态，
		 * 所以面板开着时从 Console 改值，面板也会跟着刷新。
		 *
		 * @param options - 当前选项（会被就地修改）。
		 * @param setOption - 单项写入 + 持久化 + 重绘。
		 * @param resetAll - 恢复全部默认值。
		 */
		function buildPanel(options, setOption, resetAll) {
			const panel = document.createElement("div");
			panel.className = "eva-panel";
			panel.hidden = true;
			panel.setAttribute("role", "dialog");
			panel.setAttribute("aria-label", "EVA/MAGI 显示设定");

			const head = document.createElement("div");
			head.className = "eva-panel-head";
			head.innerHTML = "<span>表示設定</span><small>DISPLAY CONFIG</small>";
			panel.appendChild(head);

			const body = document.createElement("div");
			body.className = "eva-panel-body";
			const controls = [];

			for (const section of PANEL_SPEC) {
				const group = document.createElement("div");
				group.className = "eva-group";
				group.textContent = section.group;
				body.appendChild(group);

				for (const item of section.items) {
					const row = document.createElement("div");
					row.className = "eva-row";
					row.dataset.key = item.key;
					const label = document.createElement("span");
					label.className = "eva-row-label";
					const name = document.createElement("b");
					name.textContent = item.label;
					label.appendChild(name);
					if (item.hint) {
						const hint = document.createElement("i");
						hint.textContent = item.hint;
						label.appendChild(hint);
					}
					row.appendChild(label);

					if (item.type === "range") {
						const input = document.createElement("input");
						input.type = "range";
						input.min = String(item.min ?? 0);
						input.max = String(item.max ?? 1);
						input.step = String(item.step ?? 0.05);
						input.setAttribute("aria-label", item.label);
						input.addEventListener("input", () => setOption(item.key, Number(input.value)));
						const val = document.createElement("span");
						val.className = "eva-val";
						row.appendChild(input);
						row.appendChild(val);
						controls.push({ key: item.key, kind: "range", input, val, row });
					} else {
						const sw = document.createElement("button");
						sw.type = "button";
						sw.className = "eva-sw";
						sw.dataset.key = item.key;
						sw.setAttribute("role", "switch");
						sw.addEventListener("click", () => setOption(item.key, !options[item.key]));
						row.appendChild(sw);
						controls.push({ key: item.key, kind: "switch", sw });
					}
					body.appendChild(row);
				}
			}
			panel.appendChild(body);

			const foot = document.createElement("div");
			foot.className = "eva-panel-foot";
			const resetBtn = document.createElement("button");
			resetBtn.type = "button";
			resetBtn.className = "eva-btn";
			resetBtn.textContent = "全部重設";
			resetBtn.addEventListener("click", () => resetAll());
			foot.appendChild(resetBtn);
			panel.appendChild(foot);

			const note = document.createElement("div");
			note.className = "eva-panel-note";
			note.textContent = '仪表本身不在列表里——关掉它就没入口了。要隐藏仪表请在 Console 里 __EVA_MAGI_THEME__.set("hud", false)。';
			panel.appendChild(note);

			/** 把 options 的当前值刷到每个控件上。 */
			const refresh = () => {
				for (const c of controls) {
					if (c.kind === "switch") {
						const on = Boolean(options[c.key]);
						c.sw.setAttribute("aria-checked", on ? "true" : "false");
						c.sw.textContent = on ? "ON" : "OFF";
					} else {
						c.input.value = String(options[c.key]);
						c.val.textContent = Number(options[c.key]).toFixed(2);
						// 扫描线关着时浓度滑杆没有意义 —— 置灰而不是隐藏，保持行高稳定。
						// 只对浓度这一项生效：缩放滑杆与扫描线无关。
						if (c.key === "scanlineStrength") {
							c.input.disabled = !options.scanlines;
							c.row.dataset.dim = options.scanlines ? "0" : "1";
						}
					}
				}
			};
			refresh();
			return { panel, refresh };
		}

		/**
		 * 造装饰层：CRT 质感 + 结构框架 + 仪表簇 + 反白标签。
		 *
		 * 全部挂在同一个 pointer-events:none 的固定层里，所以永远不挡操作、也不进
		 * 应用的布局流。仪表里的读数尽量取真实值（时刻 / 视口 / 正文字号 / 当前色板），
		 * 不做假遥测 —— 装饰就要有装饰的自觉。
		 *
		 * 返回移除函数（连同定时器、监听器一起回收）。
		 */
		function mountChrome(ctx, options, setOption, resetAll) {
			const layer = document.createElement("div");
			layer.className = OVERLAY_CLASS;
			layer.setAttribute("aria-hidden", "true");
			layer.innerHTML = [
				'<i class="eva-magi-grid"></i>',
				'<i class="eva-rings"></i>',
				'<i class="eva-magi-beam"></i>',
				'<i class="eva-magi-vig"></i>',
				'<i class="eva-magi-scan"></i>',
				'<div class="eva-frame">',
				'<span class="eva-corner tl"></span><span class="eva-corner tr"></span>',
				'<span class="eva-corner bl"></span><span class="eva-corner br"></span>',
				'<span class="eva-id tl">0471 / GEHIRN</span>',
				'<span class="eva-id tr">MAGI-1 / 三賢人</span>',
				"</div>",
				'<i class="eva-edge"></i><i class="eva-edge r"></i>',
				'<i class="eva-magi-top"></i>',
				'<i class="eva-hazard"></i>',
				'<div class="eva-corner-stack">',
				'<div class="eva-tags" data-face="front" role="button" tabindex="0" title="点击查看余额">',
				'<div class="eva-tags-face eva-tags-front">',
				'<span class="eva-tag eva-tag--state" data-state="valley"><b>空闲料金</b><small>VALLEY</small></span>',
				'<span class="eva-tag ghost eva-tag--remain"><b>--:--:--</b><small>残余</small></span>',
				"</div>",
				'<div class="eva-tags-face eva-tags-back">',
				'<span class="eva-tag eva-tag--balance"><b>—</b><small>残高</small></span>',
				'<span class="eva-tag ghost eva-tag--today"><b>—</b><small>今日</small></span>',
				"</div>",
				"</div>",
				'<div class="eva-hud">',
				'<div class="eva-hud-vlabel">中央教条区</div>',
				'<div class="eva-hud-body">',
				'<div class="eva-hud-head"><i></i>NERV</div>',
				'<div class="eva-hud-grid">',
				'<span>時刻</span><em class="eva-clock">--:--:--</em>',
				'<span>表示</span><em class="eva-view">--</em>',
				'<span>字号</span><em class="eva-font">--</em>',
				'<span>状態</span><em class="eva-state">--</em>',
				"</div>",
				'<div class="eva-blocks"></div>',
				'<div class="eva-hud-hazard"></div>',
				"</div></div>",
				"</div>",
			].join("");
			document.body.appendChild(layer);

			// 方块流：16 格，各自错开相位闪动
			const blockHost = layer.querySelector(".eva-blocks");
			for (let i = 0; i < 16; i += 1) {
				const block = document.createElement("i");
				block.style.setProperty("--i", String(i));
				blockHost.appendChild(block);
			}

			// —— 真实读数 ——
			const clock = layer.querySelector(".eva-clock");
			const view = layer.querySelector(".eva-view");
			const font = layer.querySelector(".eva-font");
			const state = layer.querySelector(".eva-state");

			const readView = () => {
				view.textContent = window.innerWidth + "×" + window.innerHeight;
			};
			const readFont = () => {
				// ui-layout 会把会话正文字号写在 body 的行内样式上
				const size = getComputedStyle(document.body).getPropertyValue("--dsh-content-font-size").trim();
				font.textContent = size || "—";
			};
			const readState = () => {
				state.textContent = document.body.hasAttribute("data-ds-dark-theme") ? "DARK" : "LIGHT";
			};
			const tick = () => {
				// 只到秒。带上百分秒会让这一格宽出 17px，而整块仪表必须压在 200px 内
				// 才塞得进输入框右侧的留白（见 .eva-corner-stack 的注释）。
				clock.textContent = new Date().toTimeString().slice(0, 8);
			};

			// —— 两个标签块：峰谷状态 + 下一切换倒计时 ——
			const tagsWrap = layer.querySelector(".eva-tags");
			const stateTag = layer.querySelector(".eva-tag--state");
			const remainTag = layer.querySelector(".eva-tag--remain");
			const stateText = stateTag.querySelector("b");
			const stateSub = stateTag.querySelector("small");
			const remainText = remainTag.querySelector("b");
			const remainSub = remainTag.querySelector("small");

			/** 状态 → [主文案, 副文案] */
			const STATE_LABELS = {
				peak: ["高峰料金", "PEAK RATE"],
				weekend: ["週末料金", "WEEKEND"],
				holiday: ["休日料金", "HOLIDAY"],
				offhours: ["空闲料金", "VALLEY"],
			};

			/**
			 * 把当前峰谷状态与倒计时画进两个标签块。
			 * pricing 关掉时退回静态装饰文案（原始的「会話記録 / 警戒態勢」）。
			 */
			const renderTags = () => {
				if (!options.pricing) {
					tagsWrap.dataset.state = "off";
					tagsWrap.dataset.imminent = "0";
					stateText.textContent = "警戒態勢 通常";
					stateSub.textContent = "NORMAL";
					remainText.textContent = "会話記録";
					remainSub.textContent = "TRANSCRIPT";
					return;
				}
				const nowSec = Math.floor(Date.now() / 1000);
				const state = pricingStateAt(nowSec);
				const key = state.peak ? "peak" : state.reason;
				const label = STATE_LABELS[key] || STATE_LABELS.offhours;
				tagsWrap.dataset.state = key;
				stateText.textContent = label[0];
				// 节假日清单没覆盖到这一年时，如实标注是推算的
				stateSub.textContent = state.inferred ? "推定 " + label[1] : label[1];

				const next = nextPricingChangeAt(nowSec);
				if (next === null) {
					remainText.textContent = "—";
					remainSub.textContent = "残余";
					tagsWrap.dataset.imminent = "0";
					return;
				}
				const remain = next - nowSec;
				remainText.textContent = formatRemaining(remain);
				// 「至切换」比「高峰终了/空闲终了」短 6px —— 默认放大到 1.35 之后，
			// 这 6px 就是标签块保得住还是被自动收掉的差别。
			remainSub.textContent = "至切换";
				// 30 分钟内就要切换 → 闪一下（EVA 的「まもなく」）
				tagsWrap.dataset.imminent = remain <= 1800 ? "1" : "0";
			};

			// —— 点击标签块翻面看余额 ——
			// 余额由**宿主半边**去取：客户端按设计读不到 API Key。
			// 流程是 标签翻面 → fetch 本机只读路由 → 宿主用凭据问 DeepSeek 官方接口。
			// 所以这里不碰密钥、不直连外网，只请求自己的宿主。
			const balanceTag = layer.querySelector(".eva-tag--balance");
			const todayTag = layer.querySelector(".eva-tag--today");
			let balanceState = "idle"; // idle | loading | ready | failed | unsupported

			/** 只做展示：把状态画到背面的两个标签上。 */
			const paintBalance = (main, sub) => {
				balanceTag.querySelector("b").textContent = main;
				balanceTag.querySelector("small").textContent = sub;
			};

			/** 失败原因 → 副文案。让人看得出是"没配密钥"还是"网络不通"。 */
			const FAILURE_LABEL = {
				NO_KEY: "未配置密钥",
				NO_BALANCE: "响应异常",
				FORBIDDEN: "本机校验未过",
				METHOD: "方法不允许",
				ERROR: "网络失败",
			};

			const formatAmount = (data) => {
				const symbol = data.currency === "USD" ? "$" : "¥";
				const amount = Number(data.balance);
				return symbol + (Number.isFinite(amount) ? amount.toFixed(2) : String(data.balance ?? "—"));
			};

			const loadBalance = async () => {
				balanceState = "loading";
				paintBalance("取得中", "RESOLVING");
				todayTag.querySelector("b").textContent = "—";
				try {
					const response = await fetch(BALANCE_ROUTE, {
						headers: { accept: "application/json" },
						credentials: "same-origin",
					});
					// 404 = 宿主半边没装上（或没注册路由）→ 与"取数失败"区分开
					if (response.status === 404) {
						balanceState = "unsupported";
						paintBalance("未対応", "NO HOST ROUTE");
						return;
					}
					const data = await response.json();
					if (!data || data.ok !== true) {
						balanceState = "failed";
						const code = (data && data.code) || "ERROR";
						let sub = FAILURE_LABEL[code];
						if (!sub && /^HTTP_/.test(code)) sub = "HTTP " + code.slice(5);
						paintBalance("取得不可", sub || "BALANCE N/A");
						return;
					}
					balanceState = "ready";
					paintBalance(formatAmount(data), "残高");
				} catch (error) {
					balanceState = "failed";
					paintBalance("取得不可", "网络失败");
				}
			};

			const tagsEl = layer.querySelector(".eva-tags");
			const flipTags = () => {
				const toBack = tagsEl.dataset.face !== "back";
				tagsEl.dataset.face = toBack ? "back" : "front";
				// 每次翻到背面都重新取一次（宿主侧还有 60 秒缓存兜底）
				if (toBack) loadBalance();
			};
			tagsEl.addEventListener("click", flipTags);
			tagsEl.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					flipTags();
				}
			});

			/**
			 * 自动避让：量出输入框卡片的实际位置，判断右下角还剩多少可用留白，
			 * 把结果写进 data-fit。
			 *
			 * 三种档位：
			 *   full    —— 空间够，标签块 + 四路读数全上
			 *   compact —— 只留竖排标签 + 時刻一行
			 *   hidden  —— 整块收起
			 *
			 * 为什么必须动态算：输入框是「在正文列里居中、有最大宽度」的。窗口宽
			 * 留白就多，窗口窄输入框几乎铺满，任何固定角落装饰都会压上去 ——
			 * 而它压住的恰好是发送/暂停按钮。装饰宁可消失，也不能压住控件。
			 */
			const fitCorner = () => {
				const stack = layer.querySelector(".eva-corner-stack");
				if (!stack) return;
				const card = document.querySelector("[data-composer-card]");
				if (!card) {
					stack.dataset.fit = "full";
					return;
				}
				const rect = card.getBoundingClientRect();
				// 输入框不贴底时（空会话里它是居中的），角落本来就是空的，不用避让
				const nearBottom = window.innerHeight - rect.bottom < 80;
				if (!nearBottom) {
					stack.dataset.fit = "full";
					return;
				}
				// 可用留白 = 输入框右缘到视口右缘；再减去「页面右边距 18 + 呼吸 6」
				// 才是仪表能占的宽度。把它和常量分开写，是为了让下面这行一眼能算。
				const free = window.innerWidth - rect.right;
				const GUTTER = 24; // 18 右边距 + 6 呼吸
				// 基宽是 1600 宽窗口下的实测值：整栈 full ≈ 134px（收窄过倒计时文案）、
				// compact（丢掉标签块）≈ 112px。两者都随缩放倍率放大。
				//
				// 刻意不用「量当前宽度」的写法：compact 时量到的是 compact 宽度，
				// 会让「该不该升回 full」变成一个来回抖动的反馈环。
				const scale = options.hudScale;
				const needFull = 134 * scale + GUTTER;
				const needCompact = 112 * scale + GUTTER;
				if (free >= needFull) stack.dataset.fit = "full";
				else if (free >= needCompact) stack.dataset.fit = "compact";
				else stack.dataset.fit = "hidden";
			};

			tick();
			readView();
			readFont();
			readState();
			renderTags();
			fitCorner();

			const clockTimer = setInterval(tick, 100);
			const pricingTimer = setInterval(renderTags, 1000);
			const onResize = () => {
				readView();
				readFont();
				fitCorner();
				placePanel();
			};
			window.addEventListener("resize", onResize);
			// 用户切浅/深色时，状態 要跟着变
			const themeObserver = new MutationObserver(readState);
			themeObserver.observe(document.body, {
				attributes: true,
				attributeFilter: ["data-ds-dark-theme"],
			});

			paintOptions(options);

			// —— 设置面板：挂在仪表簇里，由仪表点击调出 ——
			const stack = layer.querySelector(".eva-corner-stack");
			const hudEl = layer.querySelector(".eva-hud");
			const { panel, refresh: refreshPanel } = buildPanel(options, setOption, resetAll);
			stack.appendChild(panel);
			refreshPanelRef = refreshPanel;
			refreshTagsRef = renderTags;

			hudEl.setAttribute("role", "button");
			hudEl.setAttribute("tabindex", "0");
			hudEl.setAttribute("aria-label", "EVA/MAGI 显示设定");
			hudEl.setAttribute("title", "点击打开显示设定");
			hudEl.setAttribute("aria-expanded", "false");

			/**
			 * 把面板放到不遮住输入框的位置。
			 * 面板比仪表宽得多（298px），所以不能只靠仪表的自动避让 ——
			 * 输入框贴底时要整体抬到它上方。同时按剩余高度收紧 max-height。
			 */
			const placePanel = () => {
				if (panel.hidden || !stack) return;
				// below 写在栈的局部坐标系里，而栈整体被 scale(S) 缩放过 ——
				// 所以要 (视觉高度 + 间隙) / S 才能让面板正好落在仪表上方。
				const scale = options.hudScale || 1;
				let below = (stack.getBoundingClientRect().height + 8) / scale;
				const card = document.querySelector("[data-composer-card]");
				if (card) {
					const rect = card.getBoundingClientRect();
					if (window.innerHeight - rect.bottom < 80) {
						below = Math.max(below, (window.innerHeight - rect.top - 12) / scale);
					}
				}
				panel.style.bottom = below + "px";
				panel.style.maxHeight = Math.max(180, Math.min(560, window.innerHeight - 32 - below)) + "px";
			};

			const togglePanel = (open) => {
				const willOpen = typeof open === "boolean" ? open : panel.hidden;
				panel.hidden = !willOpen;
				hudEl.setAttribute("aria-expanded", willOpen ? "true" : "false");
				if (willOpen) {
					refreshPanel();
					placePanel();
				}
			};

			hudEl.addEventListener("click", () => togglePanel());

			// —— 缩放：Cmd/Ctrl + 滚轮 ——
			// 不加修饰键就完全不拦截（直接 return，也不 preventDefault），
			// 否则在输入框旁边滚动会被误缩放 —— 那比"少一个快捷方式"糟得多。
			const onHudWheel = (event) => {
				if (!event.ctrlKey && !event.metaKey) return;
				event.preventDefault();
				const step = event.deltaY < 0 ? 0.05 : -0.05;
				const next = Math.round(Math.min(1.6, Math.max(0.7, options.hudScale + step)) * 100) / 100;
				setOption("hudScale", next);
			};
			hudEl.addEventListener("wheel", onHudWheel, { passive: false });
			hudEl.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					togglePanel();
				}
			});
			// 点面板外面关掉。装饰层是 pointer-events:none，所以点应用区域也会到这里，
			// 正好当作「点到别处就收起」。
			const onDocPointerDown = (event) => {
				if (panel.hidden) return;
				if (panel.contains(event.target) || hudEl.contains(event.target)) return;
				togglePanel(false);
			};
			const onDocKeyDown = (event) => {
				if (event.key === "Escape" && !panel.hidden) togglePanel(false);
			};
			document.addEventListener("pointerdown", onDocPointerDown, true);
			document.addEventListener("keydown", onDocKeyDown);

			// 输入框的位置不只随窗口变化 —— 打开/关闭会话会让它从居中变成贴底。
			// 低频轮询是最省心的兜底（一次 getBoundingClientRect，开销可忽略）。
			const fitTimer = setInterval(() => {
				fitCorner();
				placePanel();
			}, 1000);

			return () => {
				clearInterval(clockTimer);
				clearInterval(pricingTimer);
				clearInterval(fitTimer);
				refreshTagsRef = null;
				window.removeEventListener("resize", onResize);
				hudEl.removeEventListener("wheel", onHudWheel);
				document.removeEventListener("pointerdown", onDocPointerDown, true);
				document.removeEventListener("keydown", onDocKeyDown);
				refreshPanelRef = null;
				themeObserver.disconnect();
				layer.remove();
				const root = document.documentElement;
				root.removeAttribute("data-eva-magi");
				for (const attr of Object.values(OPTION_ATTRS)) root.removeAttribute(attr);
				root.style.removeProperty("--eva-scan-strength");
				root.style.removeProperty("--eva-hud-scale");
				root.style.removeProperty("--eva-hud-scale-inv");
			};
		}

		/**
		 * 开机序列：NERV 风格的接続画面，约 2.6 秒后自行淡出并移除。
		 * 容器 pointer-events:none，所以从第一帧起就不挡任何操作。
		 */
		function mountBoot() {
			const el = document.createElement("div");
			el.className = "eva-boot";
			el.setAttribute("aria-hidden", "true");
			const blocks = Array.from({ length: 14 }, (_, i) => '<i style="--i:' + i + '"></i>').join("");
			el.innerHTML =
				'<div class="eva-boot-card">' +
				'<div class="jp">中央教条区</div>' +
				'<div class="en">NERV — MAGI SYSTEM / LINK ESTABLISHED</div>' +
				'<div class="bar">' + blocks + "</div>" +
				'<div class="msg">接続完了 — <b>CONDITION NORMAL</b> / パイロット 待機</div>' +
				"</div>";
			document.body.appendChild(el);
			const timer = setTimeout(() => el.remove(), 2900);
			return () => {
				clearTimeout(timer);
				el.remove();
			};
		}

		/** 开机序列每个浏览器会话只放一次，别让每次刷新都等一遍。 */
		function shouldRunBoot() {
			try {
				if (sessionStorage.getItem(BOOT_FLAG)) return false;
				sessionStorage.setItem(BOOT_FLAG, "1");
				return true;
			} catch (error) {
				return true; // 无痕模式下每次都放，总比不放好
			}
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

			/**
			 * 唯一的写入通道：界面面板与 Console 钩子都走它。
			 * 写入 → 持久化 → 重绘 CSS 标记 → 刷新面板控件。
			 */
			const setOption = (key, value) => {
				if (!(key in DEFAULT_OPTIONS)) {
					throw new Error(
						"[dsh-eva-magi-theme] 未知选项 " + key + "；可用：" + Object.keys(DEFAULT_OPTIONS).join(", "),
					);
				}
				options[key] = value;
				saveOptions(options);
				paintOptions(options);
				if (typeof refreshPanelRef === "function") refreshPanelRef();
				if (typeof refreshTagsRef === "function") refreshTagsRef();
				return options[key];
			};

			/** 恢复全部默认值（面板底部的「全部重設」）。 */
			const resetAll = () => {
				Object.assign(options, DEFAULT_OPTIONS);
				saveOptions(options);
				paintOptions(options);
				if (typeof refreshPanelRef === "function") refreshPanelRef();
				if (typeof refreshTagsRef === "function") refreshTagsRef();
				return options;
			};

			// 皮肤样式表 + 装饰层 + 令牌层，生命周期都挂在 ctx.effect 上，
			// 因此 HMR 重载和插件卸载都不会留下残留。
			ctx.effect(() => mountStyles(), "eva-magi: skin stylesheet");
			ctx.effect(
				() => whenBodyReady(() => mountChrome(ctx, options, setOption, resetAll)),
				"eva-magi: chrome + crt layers",
			);
			if (options.boot && shouldRunBoot()) {
				ctx.effect(() => whenBodyReady(() => mountBoot()), "eva-magi: boot sequence");
			}
			ctx.effect(
				() => ctx.theme.overrideTokens(PACKAGE_NAME, tokenLayer()),
				"eva-magi: alias token layer",
			);

			// 给用户一个不需要设置界面的开关：
			//   __EVA_MAGI_THEME__.set("grid", true)
			mounted = {
				version: "0.6.0",
				source: PACKAGE_NAME,
				options,
				palette: PALETTE,
				tokens: tokenLayer(),
				// Console 钩子与界面面板走同一条写入通道，不会有两套状态
				set: setOption,
				reset: resetAll,
			};
			globalThis.__EVA_MAGI_THEME__ = mounted;
		}

		exports.name = PACKAGE_NAME;
		exports.inject = inject;
		exports.apply = apply;
		exports.PALETTE = PALETTE;
		exports.DEFAULT_OPTIONS = DEFAULT_OPTIONS;
		// 峰谷规则是纯函数，导出以便单测（测试台用已知时刻断言高峰/空闲）
		exports.pricingStateAt = pricingStateAt;
		exports.nextPricingChangeAt = nextPricingChangeAt;
		return module.exports;
	},
});
