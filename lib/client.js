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
}
.eva-corner-stack[data-fit="compact"] .eva-tags{display:none}
.eva-corner-stack[data-fit="compact"] .eva-hud-grid > :nth-child(n+3){display:none}
.eva-corner-stack[data-fit="compact"] .eva-blocks,
.eva-corner-stack[data-fit="compact"] .eva-hud-hazard{display:none}
.eva-corner-stack[data-fit="hidden"]{display:none}
.eva-tags{display:flex;flex-direction:column;align-items:flex-end;gap:5px}
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
			// 结构性装饰（v0.2 新增）——「EVA 元素太少」的直接回应
			chrome: true, // 内嵌框架 + 四角 L 标 + 危险条纹 + 左右刻度尺 + 反白标签块
			hud: true, // 右下角仪表簇（竖排汉字 + 实时读数 + 方块流）
			beam: true, // 走行的场同步带
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

		/**
		 * 造装饰层：CRT 质感 + 结构框架 + 仪表簇 + 反白标签。
		 *
		 * 全部挂在同一个 pointer-events:none 的固定层里，所以永远不挡操作、也不进
		 * 应用的布局流。仪表里的读数尽量取真实值（时刻 / 视口 / 正文字号 / 当前色板），
		 * 不做假遥测 —— 装饰就要有装饰的自觉。
		 *
		 * 返回移除函数（连同定时器、监听器一起回收）。
		 */
		function mountChrome(options) {
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
				'<div class="eva-tags">',
				'<span class="eva-tag">会話記録<small>TRANSCRIPT</small></span>',
				'<span class="eva-tag ghost">警戒態勢 通常<small>NORMAL</small></span>',
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
				// 右缘留白再减掉 26px（页面右边距 18 + 与输入框的 8px 呼吸）
				const free = window.innerWidth - rect.right - 26;
				if (free >= 200) stack.dataset.fit = "full";
				else if (free >= 116) stack.dataset.fit = "compact";
				else stack.dataset.fit = "hidden";
			};

			tick();
			readView();
			readFont();
			readState();
			fitCorner();

			const clockTimer = setInterval(tick, 100);
			const onResize = () => {
				readView();
				readFont();
				fitCorner();
			};
			window.addEventListener("resize", onResize);
			// 用户切浅/深色时，状態 要跟着变
			const themeObserver = new MutationObserver(readState);
			themeObserver.observe(document.body, {
				attributes: true,
				attributeFilter: ["data-ds-dark-theme"],
			});

			paintOptions(options);

			// 输入框的位置不只随窗口变化 —— 打开/关闭会话会让它从居中变成贴底。
			// 低频轮询是最省心的兜底（一次 getBoundingClientRect，开销可忽略）。
			const fitTimer = setInterval(fitCorner, 1000);

			return () => {
				clearInterval(clockTimer);
				clearInterval(fitTimer);
				window.removeEventListener("resize", onResize);
				themeObserver.disconnect();
				layer.remove();
				const root = document.documentElement;
				root.removeAttribute("data-eva-magi");
				for (const attr of Object.values(OPTION_ATTRS)) root.removeAttribute(attr);
				root.style.removeProperty("--eva-scan-strength");
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

			// 皮肤样式表 + 装饰层 + 令牌层，生命周期都挂在 ctx.effect 上，
			// 因此 HMR 重载和插件卸载都不会留下残留。
			ctx.effect(() => mountStyles(), "eva-magi: skin stylesheet");
			ctx.effect(() => whenBodyReady(() => mountChrome(options)), "eva-magi: chrome + crt layers");
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
				version: "0.2.2",
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
