import cx from "classnames";

import Button from "components/Button/Button";

import ChevronEdgeLeft from "img/ic_chevron_edge_left.svg?react";
import ChevronEdgeRight from "img/ic_chevron_edge_right.svg?react";
import ChevronLeftIcon from "img/ic_chevron_left.svg?react";
import ChevronRightIcon from "img/ic_chevron_right.svg?react";

import "./Pagination.css";

export type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  topMargin?: boolean;
};

function getPageNumbers(current, max = 1) {
  if (max === 1) return [];
  if (current === 1) {
    return max >= 3 ? [1, 2, 3] : [1, 2];
  } else if (current === max) {
    return max >= 3 ? [current - 2, current - 1, current] : [current - 1, current];
  } else {
    return [current - 1, current, current + 1];
  }
}

const baseButtonClasses =
  // 统一翻页按钮样式：深色圆角方块，符合主 UI 主题
  "flex h-32 w-32 items-center justify-center rounded-[10px] bg-[#151515] " +
  "text-slate-300 hover:text-white hover:bg-[#1f1f1f] transition-colors border border-transparent";

const activePageClasses =
  "!bg-[#00FFB2] !text-black  border border-[#00FFB2]";

const disabledButtonClasses = "opacity-40 cursor-not-allowed";

export default function Pagination({ page, pageCount, topMargin = true, onPageChange }: PaginationProps) {
  if (pageCount <= 1) {
    return <></>;
  }

  const middleButtons = getPageNumbers(page, pageCount).map((pageNumber) => {
    const isActive = pageNumber === page;
    return (
      <Button
        variant="secondary"
        key={pageNumber}
        className={cx(baseButtonClasses, "p-0 text-[13px] font-medium", {
          [activePageClasses]: isActive,
        })}
        onClick={() => onPageChange(pageNumber)}
      >
        {pageNumber}
      </Button>
    );
  });

  const isPrevDisabled = page <= 1;
  const isNextDisabled = page >= pageCount;

  return (
    <div
      className={cx("pagination", {
        "mt-25": topMargin,
      })}
    >
      <div className="text-body-medium flex gap-8 max-md:text-[13px]">
        {/* 第一页 */}
        <Button
          variant="secondary"
          onClick={() => onPageChange(1)}
          className={cx(baseButtonClasses, "!p-0", {
            [disabledButtonClasses]: isPrevDisabled,
          })}
          disabled={isPrevDisabled}
        >
          <div className="size-14">
            <ChevronEdgeLeft />
          </div>
        </Button>

        {/* 上一页 */}
        <Button
          variant="secondary"
          onClick={() => onPageChange(page - 1)}
          className={cx(baseButtonClasses, "!p-0", {
            [disabledButtonClasses]: isPrevDisabled,
          })}
          disabled={isPrevDisabled}
        >
          <ChevronLeftIcon className="size-14 shrink-0" />
        </Button>

        {/* 中间页码 */}
        <div className="flex gap-8">{middleButtons}</div>

        {/* 下一页 */}
        <Button
          variant="secondary"
          onClick={() => onPageChange(page + 1)}
          className={cx(baseButtonClasses, "!p-0", {
            [disabledButtonClasses]: isNextDisabled,
          })}
          disabled={isNextDisabled}
        >
          <ChevronRightIcon className="ml-2 size-14 shrink-0" />
        </Button>

        {/* 最后一页 */}
        <Button
          variant="secondary"
          onClick={() => onPageChange(pageCount)}
          className={cx(baseButtonClasses, "!p-0", {
            [disabledButtonClasses]: isNextDisabled,
          })}
          disabled={isNextDisabled}
        >
          <div className="size-14">
            <ChevronEdgeRight />
          </div>
        </Button>
      </div>
    </div>
  );
}
