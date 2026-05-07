/**
 * 与 `PrimitTradeHeaderNav` 主站入口一致：这些路径使用 Primit 顶栏 +（可选）全宽主区，桌面端隐藏左侧 SideNav。
 */
const PRIMIT_APP_SHELL_PREFIXES = [
  "/trade",
  "/earn",
  "/accounts",
  "/leaderboard",
  "/referrals",
  "/points",
  "/fee-vip",
] as const;

export function isPrimitAppShellPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return PRIMIT_APP_SHELL_PREFIXES.some((p) => normalized === p || normalized.startsWith(`${p}/`));
}
