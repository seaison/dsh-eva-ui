# dsh-eva-magi-theme

把 **NERV 中央教条区**的界面语言装进 DSH Web GUI 的皮肤插件。

暗色是本体（MAGI / 中央教条区终端），浅色是配套的「EVA 技术资料」纸质版。
皮肤的调色与排版全部来自一份独立的设计稿 —— 一个叫 `nerv-hud` 的可交互 HUD 原型，
本插件是那套语言在真实产品界面里的落地版本。

![设计语言来源](docs/design-reference.png)

> 上图是**设计稿**（独立 HUD 原型 `nerv-hud.html` 的渲染），**不是 DSH GUI 的截图**。
> 皮肤的令牌级效果可以直接核对：[`docs/palette.html`](docs/palette.html) 色卡与
> [`docs/TOKENS.md`](docs/TOKENS.md) 对照表都由代码生成。

---

## 效果

| 层 | 改了什么 |
| --- | --- |
| **令牌层**（107 个 `--dsw-alias-*`） | 全部别名令牌换成 EVA 配色：底色 `#08090a`、主色 `#ff6a00`、数据绿 `#7cff4f`、警戒红 `#ff1e1e`、正文暖白 `#e8e4dc`（刻意不用纯白）。边框变成橙色发丝线，滚动条像仪表刻度，选中色是主色 |
| **形状层** | 圆角全部压到 0 —— EVA 的世界里没有圆角（`--dsw-radius-panel` 默认 28px，这是最激进的一刀，可以关） |
| **质感层** | CRT 扫描线 + 暗角 + 顶边主色压力线（`nerv-hud` 里那条 2px 渐变）；可选 48px 测绘网格 |
| **排版层** | 标题走**明朝体**：靠 `font-family` 的逐字符回退，拉丁仍吃系统无衬线，只有汉字落到 Hiragino Mincho ProN；全局等宽数字（`tabular-nums`），读数不会随内容抖动 |

---

## 安装

DSH 桌面版的插件管理在 **设置 → 插件 → 添加插件**，接受三种输入：npm 包名、GitHub 仓库地址、本地目录路径。

### 本地目录（开发 / 未发布）

```
/path/to/dsh-eva-magi-theme
```

把这行路径粘进去即可。插件会被装进当前 profile，外观改动不需要重启应用，
但**客户端半边需要刷新页面**（`Cmd+R`）才会重新进入启动清单。

### GitHub 仓库

```
https://github.com/seaison/dsh-eva-ui
```

> 仓库名是 `dsh-eva-ui`，包名是 `dsh-eva-magi-theme`。两者不一致是刻意的：
> 包名是 DSH 加载器用来解析模块的 id（必须与 `lib/client.js` 里
> `window.__ModuleLoader__.load({ id })` 完全相同），改名要动五处联动的地方，
> 不值得为了对齐仓库名去冒这个险。安装时按包名或仓库地址都行。

### npm

```bash
dsh plugin --profile <profile> add dsh-eva-magi-theme
```

> `desktop` profile 由 Electron 应用独占管理，CLI 会拒绝操作它 —— 桌面版请走插件管理界面。

### 卸载

设置 → 插件 → 找到 `dsh-eva-magi-theme` → 卸载，然后刷新页面。
插件不写任何宿主侧状态、不改设置、不碰会话数据；卸载后唯一残留是 `localStorage`
里的两个键（皮肤选项），删掉即可：

```js
localStorage.removeItem("dsh-eva-magi-theme:options")
```

---

## 选项

第三方主题在「外观」那一行没有 UI 插槽（那里只有官方的 light / dark / system 三个方块），
所以开关做成一个全局钩子 —— 打开开发者工具（设置里已开启），在 Console 里直接调：

```js
__EVA_MAGI_THEME__.set("scanlines", false)        // 关掉 CRT 扫描线
__EVA_MAGI_THEME__.set("scanlineStrength", 0.25)  // 扫描线浓度 0~1
__EVA_MAGI_THEME__.set("hardEdges", false)        // 恢复 DSH 原来的圆角
__EVA_MAGI_THEME__.set("grid", true)              // 打开测绘网格背景
__EVA_MAGI_THEME__.set("topLine", false)          // 关掉顶边主色压力线
__EVA_MAGI_THEME__.set("minchoHeadings", false)   // 标题回到哥特体
__EVA_MAGI_THEME__.set("vignette", false)         // 关掉暗角
__EVA_MAGI_THEME__.reset()                        // 全部回到默认值
```

选择存在 `localStorage`（键 `dsh-eva-magi-theme:options`），刷新后保留。

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `scanlines` | `true` | CRT 扫描线，3px 周期 |
| `scanlineStrength` | `0.5` | 扫描线不透明度；浅色模式下自动再减半 |
| `vignette` | `true` | 四角压暗 |
| `grid` | `false` | 48px 测绘网格 |
| `topLine` | `true` | 顶边主色渐变线 |
| `hardEdges` | `true` | 圆角归零 |
| `tabularNumbers` | `true` | 等宽数字 |
| `minchoHeadings` | `true` | `h1~h3` 的汉字走明朝体 |

---

## 它是怎么做到的

皮肤只走官方通道，不 hack DOM、不抢选择器优先级。

**为什么令牌必须用 API 而不是 CSS。** `ctx.theme` 组合出的主题快照由 ui-layout 以
inline style 写到 `<body>` 上：

```js
body.style.setProperty("--dsw-alias-bg-base", "#101315")   // 快照里的每个令牌
```

inline style 压过任何样式表规则，所以「写一段 CSS 覆盖 `--dsw-*`」这条路是走不通的。
本插件因此调用官方的令牌层接口：

```js
ctx.theme.overrideTokens("dsh-eva-magi-theme", {
  "--dsw-alias-bg-base": { light: "#f2efe8", dark: "#08090a" },
  // …另外 106 个
})
```

令牌层叠在用户当前主题之上、随 light/dark 自动解析，返回的 disposer 让卸载和热重载
都能精确回收。装饰层（扫描线、网格、硬边、明朝体）放在插件自有的样式表与覆盖层里，
和插件同生共死。

细节推导见 [`docs/DESIGN.md`](docs/DESIGN.md)。

---

## 兼容性

| | |
| --- | --- |
| 实测环境 | DSH Desktop **2.0.17**，`@deepseek-ai/dsh-client-ui-theme` **0.2.0-rc.2** |
| 令牌来源 | 从上述版本的客户端 bundle 中读取并逐条核对（107 个别名令牌全覆盖） |
| 操作平台 | macOS（明朝体走 Hiragino Mincho ProN）。Windows / Linux 会落到 YuMincho / Songti / `serif`，标题观感会不同 |

皮肤依赖的是 `ctx.theme` 的公开契约（`overrideTokens` / `inject: ["theme"]`）与
107 个 `--dsw-alias-*` 别名令牌名。DSH 大版本升级若改动令牌名，皮肤会静默少生效几个
令牌而不会报错 —— `npm test` 里的令牌核对就是为此准备的（见下）。

---

## 已知限制

1. **没有设置界面。** 「外观」那一行由官方主题占据，第三方主题没有 UI 插槽；开关只能走
   Console 钩子。这是当前 DSH 插件 API 的边界，不是实现偷懒。
2. **不新增第三个外观选项。** 皮肤跟随你的 light / dark / system 偏好叠加，而不是注册一个
   `eva-magi` 主题再强行 `setTheme()` —— 后者会和持久化的偏好打架，而且「外观」那行不会
   显示它，用户会看到选择与结果不一致。
3. **圆角归零很激进。** 28px → 0 是本皮肤最强的一刀，个别组件可能因此显得生硬；
   不喜欢就 `set("hardEdges", false)`。
4. **覆盖层盖在所有内容之上**（`z-index` 取最大值，但 `pointer-events:none`）。
   这是刻意的：弹窗和提示也应该是 CRT 里的一部分。
5. **仓库里没有 GUI 截图。** 本机 DSH 桌面版的 HTTP 服务拒绝非应用客户端，也拿不到
   屏幕录制权限，所以无法自动截图。可核对的替代物是色卡页与令牌表（都由代码生成），
   以及 `npm run test:client` 那 40 项行为断言 —— 外观需要你目测，行为不再是黑箱。

---

## 开发

```bash
npm test                 # 打包不变量 + 令牌核对 + 浏览器半边端到端测试
npm run test:manifest    # 只跑打包不变量（包名/id/patch 三处一致、文件都存在、零依赖）
npm run test:tokens      # 只跑 token 检查
npm run test:client      # 只跑浏览器半边测试（需要本机有 Chrome）
npm run check            # 语法检查 + 校验文档与代码一致（提交前）
npm run docs             # 重新生成 docs/TOKENS.md 与 docs/palette.html
```

> 本插件**零依赖**：没有 `dependencies`、没有 `peerDependencies`、没有构建步骤、
> 没有 lockfile。所以 CI 里不需要 `npm install`，克隆下来直接就能跑上面这些命令。
> `npm run test:manifest` 会把这条性质钉住。

### 浏览器半边怎么测

`tools/client-harness.html` 在真实 DOM 里模拟 `window.__ModuleLoader__` 与一个假的
`ctx`（记录 `effect` 与 `overrideTokens` 调用、并真的能回收），把 `apply()` 的完整
生命周期跑一遍。**40 项断言**覆盖：

- 模块 id 是否等于包名、`inject` 是否只依赖 `theme`；
- 令牌层是否走 `overrideTokens`、是否 107 条、是否都是 `{light, dark}` 双值；
- 样式表是否带 `data-plugin-css` 注入、浏览器是否真的解析成功（规则数 + 关键规则抽查）、
  覆盖层是否挂上且 `pointer-events:none`；
- 选项是否即时生效、是否拒绝未知键、是否持久化到 `localStorage`、新实例是否恢复；
- **回收是否干净**：卸载后样式表、覆盖层、根元素标记、令牌层是否全部消失。

`tools/run-client-harness.mjs` 用无头 Chrome 跑它并把结果变成退出码（找不到 Chrome 时
跳过而不是失败）。这是「拿不到 GUI 截图」的正面替代：**外观要你目测，行为由测试保证**。

改 `lib/client.js` 里的 `PALETTE` 表 → 跑 `npm run docs` → 用浏览器打开
`docs/palette.html`，就能在无需装卸皮肤的情况下看到浅色/深色两侧的结果。

**迭代皮肤本身**需要真实 GUI：改完代码 → 在插件管理器里重新添加本地目录（或刷新页面）。
`lib/client.js` 是手写的模块加载器外壳，没有构建步骤、没有依赖，改完即生效。

### 目录

```
lib/index.js             宿主半边：只作为 loader 挂载点存在（空实现是刻意的）
lib/client.js            浏览器半边：令牌表 + 皮肤样式表 + 选项；皮肤的全部内容
cordis.patch.yml         挂载声明
tools/verify-manifest.mjs 打包不变量：三处名字一致、路径存在、零依赖
tools/verify-tokens.mjs  令牌核对（形状 / 重复键 / 与官方令牌名比对）
tools/gen-tokens-doc.mjs 由代码生成文档
tools/client-harness.html 浏览器半边测试台（模拟 ModuleLoader 与 ctx）
tools/run-client-harness.mjs 用无头 Chrome 跑测试台并转成退出码
docs/DESIGN.md           设计推导：从 nerv-hud 到 --dsw-* 的逐条映射与取舍
docs/TOKENS.md           令牌对照表（生成物）
docs/palette.html        令牌色卡（生成物）
.github/workflows/ci.yml 每次推送跑 check + test
```

---

## 致谢与声明

- 《新世纪福音战士》/ *Neon Genesis Evangelion* 及其视觉设计版权属于 **khara**。
  本插件是非商业的同人风格致敬，不包含任何原作的图像、字体或音频素材。
- EVA 标题卡使用的 **Matisse EB**（Fontworks）是商业字体，本项目**不包含也不分发**它；
  明朝体走系统自带的 Hiragino Mincho ProN 等替代字体。
- DSH（DeepSeek Harness）及其客户端主题 API 版权属于其各自所有者。
- 皮肤只改变外观：不读取、不上传、不修改任何会话内容或用户数据。

## 许可

[MIT](LICENSE)
