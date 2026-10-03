# 更新日志

本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.0] —— 未发布

「0.1.0 只有令牌与质感，EVA 元素太少」的直接回应。补上一层结构性装饰，
并把验证方式从「等用户目测」换成「起独立实例 + CDP 截图 + 自动断言」。

### 新增

- **结构装饰层**（`chrome`）：内嵌发丝框架、四角 L 标、左右刻度尺（带游标扫描高光）、
  底部危险条纹、顶边压力线与刻度、四角规格编号（`0471 / GEHIRN`、`MAGI-1 / 三賢人`）、
  CRT 三枪色散（红/青各偏移 1px）。
- **仪表簇**（`hud`）：右下角 NERV 状态盘 —— 竖排明朝体「中央教条区」、橙底反白标签块、
  四路**真实**读数（时刻 / 视口尺寸 / 会话正文字号 / 当前色板）、16 格方块流动画。
- **开机序列**（`boot`）：每次会话首次加载放一段「NERV — MAGI SYSTEM / LINK ESTABLISHED」
  接续画面（明朝体大字 + 进度方块），约 2.6 秒后淡出；`pointer-events:none`，从不挡操作。
- **同心雷达环**（`rings`）与**走行的场同步带**（`beam`）。
- **应用元素装饰**：顶栏分隔线、输入卡片橙色外圈（聚焦整圈点亮）、会话列表选中项
  左侧橙条、主区域环境光、键帽/代码块/`hr`/滚动条/浮层/焦点环。
- `tools/shoot.mjs`：给真实 GUI 截图。用 CDP 真实等待 + `Page.captureScreenshot`，
  因为 `chrome --screenshot` 配 `--virtual-time-budget` 在带 WebSocket 的活应用上永不返回。
- `docs/screenshot-dark.png`、`docs/screenshot-boot.png`：**真实 GUI 截图**，
  补上 0.1.0「没有截图」的短板。

### 变更

- 装饰层挂钩改用应用自己的 `data-*` 语义属性（`data-conversation-header`、
  `data-composer-card`、`data-sidebar-right-panel`、`data-dockkit-surface` …），
  不再依赖 CSS Modules 的哈希类名。
- 元素装饰只用不改布局、不覆盖应用样式的属性（`box-shadow` / `outline` /
  `border-color` / `letter-spacing`），刻意避开 `::before`/`::after` 与 `background-image`。
- 选项从 8 个增加到 13 个；浏览器半边测试从 40 项增加到 55 项断言。

### 修复

- 第一版标签分别放在右上与左下，实测**盖住了应用的侧栏折叠按钮与「设置」**。
  改为右下角单一纵向叠层，由 flex 保证互不重叠。装饰绝不能压住控件。

## [0.1.0] —— 未发布

首个版本。

### 新增

- 覆盖 DSH 客户端主题层全部 **107 个 `--dsw-alias-*` 别名令牌**，深浅两套配色：
  - 深色：MAGI / 中央教条区——底色 `#08090a`、主色 `#ff6a00`、数据绿 `#7cff4f`、
    警戒红 `#ff1e1e`、暖白正文 `#e8e4dc`、橙色发丝线边框。
  - 浅色：EVA 技术资料纸质版——暖白图纸 `#f2efe8`、压深的橙 `#c94f08`。
- 装饰层：CRT 扫描线、暗角、顶边主色压力线、可选 48px 测绘网格。
- 形状层：圆角归零（`--dsw-radius-*`），可关。
- 排版层：`h1~h3` 汉字走明朝体（拉丁仍为系统无衬线）；全局等宽数字。
- 8 个运行时选项，通过 `__EVA_MAGI_THEME__` 全局钩子调整，选择持久化到 `localStorage`。
- `tools/gen-tokens-doc.mjs`：由 `lib/client.js` 生成 `docs/TOKENS.md` 与 `docs/palette.html`，
  保证文档与实现同源；`--check` 模式用于校验。
- `tools/client-harness.html` + `tools/run-client-harness.mjs`：浏览器半边的端到端测试。
  在真实 DOM 里模拟 `__ModuleLoader__` 与 `ctx`，跑完 `apply()` 的注册 / 注入 / 挂载 /
  选项 / 回收全流程，共 40 项断言；无头 Chrome 执行，退出码可用于 CI（无 Chrome 时跳过）。

### 修复

- 移除 `dsh.client.inject` 里对官方主题包的引用，并移除 `peerDependencies`。
  浏览器半边不 `require` 任何模块、只依赖 Cordis 的 `theme` 服务注入，声明模块级依赖
  与包级 peer 依赖只会给安装/启动图多加两次解析要求——而解析失败是「响的」，
  代价不成比例。
- 新增 `tools/verify-manifest.mjs`：把「包名 / 模块 id / patch name 三处一致」
  「`exports["./client"]` 与 `main` 指向的文件真实存在」这类**装错就静默失效**的
  不变量钉成测试，并接入 `npm test`。
- 新增 `tools/verify-contrast.mjs`：WCAG 对比度（46 个组合）+ 覆盖前后的浅/深极性
  一致性（36 个不透明令牌）。它在写这一版时抓到三个真实缺陷，全部已修（见下）。

### 配色修正（由对比度/极性检查抓出）

- 浅色 `label-tertiary` `#6b7178` → `#626970`：对比度 4.29:1 → 4.85:1（正文阈值 4.5）。
- 浅色 `label-caption` `#949aa1` → `#7c828a`：对比度 2.47:1 → 3.38:1（UI 文本阈值 3.0）。
- `brand-primary-invert` 的浅/深极性与官方相反（官方浅色 `#0f1115` / 深色 `#f9fafb`），
  改为 `#0a0a0a` / `#e8e4dc`。该令牌在官方 bundle 里找不到消费方，因此只保证极性同向。

### 说明

- 宿主半边是空实现：皮肤不写任何宿主侧状态、不注册设置项、不接触会话数据。
- 令牌覆盖走官方 `ctx.theme.overrideTokens()` 通道。原因见
  [`docs/DESIGN.md`](docs/DESIGN.md)：主题快照是以 inline style 写到 `<body>` 上的，
  纯 CSS 覆盖不会生效。
