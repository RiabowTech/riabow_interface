/**
 * 与 `ZanbaraTradeHeaderNav` 主站入口一致：这些路径使用 Zanbara 顶栏 +（可选）全宽主区，桌面端隐藏左侧 SideNav。
 */
const ZANBARA_APP_SHELL_PREFIXES = [
  "/trade",
  "/earn",
  "/accounts",
  "/leaderboard",
  "/referrals",
  "/points",
  "/vip",
] as const;

export function isZanbaraAppShellPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return ZANBARA_APP_SHELL_PREFIXES.some((p) => normalized === p || normalized.startsWith(`${p}/`));
}
