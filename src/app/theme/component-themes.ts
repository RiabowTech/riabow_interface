/**
 * 组件级主题入口：默认同时加载 Legacy 与 Zanbara 两包，由 `html[data-ui-theme]`（界面主题）决定哪套 Tab 等配色生效；亮/暗仍由 `html.dark`（颜色主题）决定。
 *
 * - 仅旧版整站：可只保留 `import "styles/themes/legacy/theme-components.css";`
 * - 仅新版整站：可只保留 `import "styles/themes/zanbara/theme-components.css";`（需全站不再依赖荧光 Tab）
 */
import "styles/earn-accent.css";
import "styles/zanbara-page-hero.css";
import "styles/themes/legacy/theme-components.css";
import "styles/themes/zanbara/theme-components.css";
