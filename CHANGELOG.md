# 更新日志

本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)。

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

- 移除 `dsh.client.inject` 里对官方主题包的引用。浏览器半边不 `require` 任何模块，
  只依赖 Cordis 的 `theme` 服务注入，声明模块级依赖只会给启动图多加一次解析要求——
  而解析失败是「响的」，代价不成比例。

### 说明

- 宿主半边是空实现：皮肤不写任何宿主侧状态、不注册设置项、不接触会话数据。
- 令牌覆盖走官方 `ctx.theme.overrideTokens()` 通道。原因见
  [`docs/DESIGN.md`](docs/DESIGN.md)：主题快照是以 inline style 写到 `<body>` 上的，
  纯 CSS 覆盖不会生效。
