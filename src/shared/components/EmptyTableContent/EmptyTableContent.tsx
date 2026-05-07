import { Trans } from "@lingui/macro";
import { ReactNode, useEffect, useState } from "react";

import Loader from "components/Loader/Loader";

const LOADING_TIMEOUT = 3000; // 3秒超时，如果超过这个时间还在加载，显示空状态

export function EmptyTableContent({
  isLoading,
  isEmpty,
  emptyText = <Trans>No items yet</Trans>,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  emptyText?: ReactNode;
}) {
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    if (isLoading) {
      // 如果正在加载，设置超时
      const timer = setTimeout(() => {
        setHasTimedOut(true);
      }, LOADING_TIMEOUT);

      return () => clearTimeout(timer);
    } else {
      // 如果加载完成，重置超时状态
      setHasTimedOut(false);
    }
  }, [isLoading]);

  // 如果加载完成且为空，或者超时且为空，显示空状态
  const shouldShowEmpty = (!isLoading && isEmpty) || (hasTimedOut && isEmpty);
  const shouldShowLoading = isLoading && !hasTimedOut;

  if (!shouldShowLoading && !shouldShowEmpty) return null;

  return (
    <div className="flex min-h-[164px] w-full grow items-center justify-center bg-slate-900 text-[13px] text-typography-secondary">
      {shouldShowLoading ? <Loader /> : shouldShowEmpty ? emptyText : null}
    </div>
  );
}
