# 令牌对照表

> 本文件由 `node tools/gen-tokens-doc.mjs` 从 [`lib/client.js`](../lib/client.js) 的 `PALETTE` 表生成，请勿手工编辑。

插件共覆盖 **107** 个 `--dsw-alias-*` 令牌（DSH 客户端主题层共暴露 107 个别名令牌）。
未被覆盖的令牌保持 DSH 原值——原值通常已经足够中性，皮肤只在「语义需要换色」的地方下手。

## 为什么是别名层

`ctx.theme` 组合出的主题快照由 ui-layout 以 **inline style** 写到 `<body>` 上：

```js
body.style.setProperty(name, value)   // name = --dsw-alias-*，value = 当前色板解析值
```

inline style 的优先级高于任何样式表规则，所以第三方皮肤**不能**靠 CSS 覆盖 `--dsw-alias-*`，
必须走 `ctx.theme.overrideTokens(source, tokens)` 让覆盖进入快照本身。本插件即按此实现。

相应的，不在快照里的令牌（例如 `--dsw-radius-*`、`--dsw-focus-ring-width`）可以用普通 CSS 覆盖，
它们由 `lib/client.js` 的 `SKIN_CSS` 处理。

## 底色 / 表面层

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-bg-base` | `#f2efe8` | `#08090a` |
| `--dsw-alias-bg-layer-1` | `#faf8f4` | `#0c0e10` |
| `--dsw-alias-bg-layer-2` | `#ffffff` | `#101315` |
| `--dsw-alias-bg-layer-3` | `#ece7dc` | `#161a1d` |
| `--dsw-alias-bg-overlay` | `#ffffff` | `#14181b` |
| `--dsw-alias-bg-module-platform` | `#f0ece3` | `#0e1113` |
| `--dsw-alias-bg-multi-select` | `#d9530a1f` | `#ff6a001a` |
| `--dsw-alias-bg-skeleton` | `#0000000a` | `#ffffff0f` |
| `--dsw-alias-bg-document-preview` | `#faf8f4` | `#0c0e10` |
| `--dsw-alias-bg-document-selection` | `#d9530a52` | `#ff6a0059` |
| `--dsw-alias-bg-mask-1` | `#0000003d` | `#0000005c` |
| `--dsw-alias-bg-mask-2` | `#0000001f` | `#00000033` |
| `--dsw-alias-bg-mask-3` | `#0000007a` | `#0000008a` |
| `--dsw-alias-bg-mask-drop` | `#ffffffb3` | `#0a0a0acc` |
| `--dsw-alias-bg-mask-photo` | `#000000e0` | `#000000e6` |

## 文本层级

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-label-document-preview` | `#4a4f57` | `#cfc9bd` |
| `--dsw-alias-label-primary` | `#16181c` | `#e8e4dc` |
| `--dsw-alias-label-secondary` | `#4a4f57` | `#b8b3a8` |
| `--dsw-alias-label-tertiary` | `#6b7178` | `#8d887e` |
| `--dsw-alias-label-caption` | `#949aa1` | `#6b675f` |
| `--dsw-alias-label-primary-dimmed` | `#2c3036` | `#cfc9bd` |
| `--dsw-alias-label-primary-bluish` | `#1f242a` | `#eceae4` |
| `--dsw-alias-label-dimmed` | `#c9c3b8` | `#57544d` |
| `--dsw-alias-label-primary-inverted` | `#ffffff` | `#0a0a0a` |
| `--dsw-alias-label-primary-foreground` | `#ffffff` | `#0a0a0a` |
| `--dsw-alias-label-shimmer` | `#0000004d` | `#ffffff73` |
| `--dsw-alias-label-deep-diving` | `#b24500` | `#ffb066` |
| `--dsw-alias-label-deep-diving-shimmer` | `#d9530a` | `#ffd9b3` |

## 边框（橙色发丝线）

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-border-l1` | `#b2450017` | `#ff7a1a24` |
| `--dsw-alias-border-l2` | `#b2450029` | `#ff7a1a3d` |
| `--dsw-alias-border-l3` | `#b2450040` | `#ff7a1a57` |
| `--dsw-alias-border-l4` | `#b2450059` | `#ff7a1a7a` |
| `--dsw-alias-border-l2-darkmode-thin` | `#b2450029` | `#ff7a1a1f` |
| `--dsw-alias-border-inverted` | `#0000` | `#0000` |
| `--dsw-alias-border-inverted2` | `#0000` | `#0000` |

## 品牌色 = 主色

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-brand-primary` | `#c94f08` | `#ff6a00` |
| `--dsw-alias-brand-primary-invert` | `#ffffff` | `#0a0a0a` |
| `--dsw-alias-brand-primary-new-colorprimary-new-color` | `#c94f08` | `#ff6a00` |
| `--dsw-alias-brand-text` | `#b24500` | `#ff8a2b` |

## 按钮

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-button-primary-fill` | `#c94f08` | `#ff6a00` |
| `--dsw-alias-button-primary-hover` | `#a8400a` | `#ff8f3d` |
| `--dsw-alias-button-primary-dimmed` | `#c94f0833` | `#ff6a0047` |
| `--dsw-alias-button-contrast-fill` | `#2c3036` | `#e8e4dc` |
| `--dsw-alias-button-elevated-fill` | `#ffffff` | `#1b2024` |
| `--dsw-alias-button-floating-fill` | `#ffffff` | `#12161a` |
| `--dsw-alias-button-floating-hover` | `#f0ece3` | `#1b2024` |
| `--dsw-alias-button-ghost-active-fill` | `#d9530a1f` | `#ff6a001f` |
| `--dsw-alias-button-ghost-active-border` | `#d9530a59` | `#ff6a0059` |
| `--dsw-alias-button-ghost-active-hover` | `#d9530a2e` | `#ff6a002e` |
| `--dsw-alias-button-info-fill` | `#1f8f3a1f` | `#7cff4f1f` |
| `--dsw-alias-button-info-hover` | `#1f8f3a33` | `#7cff4f33` |
| `--dsw-alias-button-tool-bar-fill` | `#faf8f4` | `#12161a` |
| `--dsw-alias-button-tool-bar-fill-invisible` | `#0000` | `#0000` |
| `--dsw-alias-button-tool-bar-hover` | `#d9530a1f` | `#ff6a001f` |

## 交互反馈

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-interactive-bg-hover` | `#d9530a14` | `#ff6a0014` |
| `--dsw-alias-interactive-bg-hover-accent` | `#d9530a24` | `#ff6a0024` |
| `--dsw-alias-interactive-bg-hover-danger` | `#c4241c1f` | `#ff1e1e24` |
| `--dsw-alias-interactive-bg-hover-solid` | `#00000014` | `#ffffff1a` |
| `--dsw-alias-interactive-bg-active` | `#d9530a24` | `#ff6a0024` |

## 状态语义

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-state-business-primary` | `#c94f08` | `#ff6a00` |
| `--dsw-alias-state-business-tertiary` | `#c94f0859` | `#ff6a0066` |
| `--dsw-alias-state-success-primary` | `#1f8f3a` | `#7cff4f` |
| `--dsw-alias-state-success-secondary` | `#1f8f3acc` | `#7cff4fcc` |
| `--dsw-alias-state-success-tertiary` | `#1f8f3a59` | `#7cff4f66` |
| `--dsw-alias-state-warn-primary` | `#b87500` | `#ffcc00` |
| `--dsw-alias-state-warn-secondary` | `#b87500cc` | `#ffcc00cc` |
| `--dsw-alias-state-warn-tertiary` | `#b8750059` | `#ffcc0066` |
| `--dsw-alias-state-warn-label` | `#8a5800` | `#ffcc00` |
| `--dsw-alias-state-error-primary` | `#c4241c` | `#ff3b30` |
| `--dsw-alias-state-error-secondary` | `#c4241ccc` | `#ff3b30cc` |
| `--dsw-alias-state-idle-primary` | `#a8a49b` | `#5a6166` |

## 链接

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-link` | `#b24500` | `#ff9a4d` |

## 滚动条

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-scrollbar-bg-l1` | `#b245002e` | `#ff7a1a2e` |
| `--dsw-alias-scrollbar-bg-l2` | `#b2450024` | `#ff7a1a24` |
| `--dsw-alias-scrollbar-hover-l1` | `#b2450059` | `#ff7a1a5c` |
| `--dsw-alias-scrollbar-hover-l2` | `#b2450047` | `#ff7a1a47` |

## 菜单

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-menu-icon` | `#2c3036` | `#cfc9bd` |
| `--dsw-alias-menu-group-header-fill` | `#faf8f4f0` | `#0c0e10f0` |

## 气泡提示

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-tooltip-bg` | `#1b1f23f2` | `#161a1df2` |
| `--dsw-alias-tooltip-key-bg` | `#3a4046` | `#262c31` |

## 系统提示

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-toast-bg` | `#1b1f23f7` | `#161a1df7` |
| `--dsw-alias-toast-label` | `#f2efe8` | `#e8e4dc` |

## 开关

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-switch-thumb` | `#ffffff` | `#ffd9b3` |

## 设置卡片

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-settings-card-fill` | `#faf8f4` | `#0c0e10` |
| `--dsw-alias-settings-card-stroke` | `#b2450029` | `#ff7a1a33` |

## Markdown / 代码

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-markdown-code-block` | `#f0ece3` | `#0b0e10` |
| `--dsw-alias-markdown-code-block-banner` | `#ece7dc` | `#101315` |
| `--dsw-alias-markdown-inline-code` | `#d9530a1a` | `#ff6a001f` |
| `--dsw-alias-markdown-citation` | `#d9530a24` | `#ff6a0024` |
| `--dsw-alias-markdown-tag` | `#1f8f3a1f` | `#7cff4f1f` |
| `--dsw-alias-markdown-placeholder` | `#949aa1` | `#6b675f` |
| `--dsw-alias-markdown-code-segment-selected` | `#d9530a33` | `#ff6a0033` |
| `--dsw-alias-markdown-code-segment-unselected` | `#0000000f` | `#ffffff14` |

## 代码差异

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-code-diff-added` | `#1f8f3a1f` | `#7cff4f1f` |
| `--dsw-alias-code-diff-deleted` | `#c4241c1f` | `#ff1e1e1f` |

## 文件差异

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-file-diff-added-bg` | `#1f8f3a14` | `#7cff4f14` |
| `--dsw-alias-file-diff-added-gutter` | `#1f8f3a24` | `#7cff4f24` |
| `--dsw-alias-file-diff-added-marker` | `#1f8f3a` | `#7cff4f` |
| `--dsw-alias-file-diff-deleted-bg` | `#c4241c14` | `#ff1e1e14` |
| `--dsw-alias-file-diff-deleted-gutter` | `#c4241c24` | `#ff1e1e24` |
| `--dsw-alias-file-diff-deleted-marker` | `#c4241c` | `#ff1e1e` |

## 引导页

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-onboarding-accent` | `#c94f08` | `#ff6a00` |
| `--dsw-alias-onboarding-card-fill` | `#faf8f4` | `#0c0e10` |
| `--dsw-alias-onboarding-checkbox-border` | `#b2450059` | `#ff7a1a59` |
| `--dsw-alias-onboarding-secondary-fill` | `#f0ece3` | `#161a1d` |

## 回合触发器

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| `--dsw-alias-turn-trigger-bg` | `#d9530a12` | `#ff6a0012` |
| `--dsw-alias-turn-trigger-bg-hover` | `#d9530a1f` | `#ff6a001f` |
