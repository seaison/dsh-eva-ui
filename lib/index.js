/**
 * dsh-eva-magi-theme —— 宿主半边（host half）
 *
 * 这个皮肤的全部外观逻辑都在浏览器半边 `lib/client.js` 里：
 * 它通过 `ctx.theme` 覆盖 `--dsw-*` 别名令牌，并注入插件自有的样式表与
 * CRT 覆盖层。宿主半边只做一件事——作为 Cordis loader 的挂载点存在，
 * 让包内的 `dsh.client` 声明被 client-modules 的扫描看到，从而把浏览器
 * 半边送进启动清单。
 *
 * 因此它刻意不接触会话、工具、设置或网络：
 *   - 不读也不写任何用户数据；
 *   - 不注册设置项（皮肤只在浏览器里改外观）；
 *   - 卸载时不会留下任何宿主侧状态。
 */

export const name = 'dsh-eva-magi-theme'

/**
 * 宿主侧插件入口。
 *
 * 空实现是刻意的：任何宿主侧副作用都会让这个「纯皮肤」插件在卸载后留下
 * 残留状态，而它需要保证的只有「作为一个被加载的 loader 条目存在」。
 */
export function apply() {}
