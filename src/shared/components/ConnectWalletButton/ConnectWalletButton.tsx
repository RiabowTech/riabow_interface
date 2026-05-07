import cx from "classnames";
import { ReactNode, useCallback, useRef } from "react";

import Button from "components/Button/Button";
import { useDesignSystem } from "shared/context/DesignSystemContext/DesignSystemContext";
import { PrimitCornerBracketFrame } from "shared/ui/PrimitCornerBracketFrame";

import WalletIcon from "img/ic_wallet.svg?react";

type Props = {
  children: ReactNode;
  onClick?: () => void;
};

export default function ConnectWalletButton({ children, onClick }: Props) {
  const { isPrimit } = useDesignSystem();
  const isConnectingRef = useRef(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Prevent multiple simultaneous connection requests
      if (isConnectingRef.current || !onClick) {
        return;
      }

      isConnectingRef.current = true;
      try {
        onClick();
      } finally {
        // Reset after a short delay to allow the modal to open
        setTimeout(() => {
          isConnectingRef.current = false;
        }, 1000);
      }
    },
    [onClick]
  );

  const button = (
    <Button
      variant="primary"
      size="controlled"
      qa="connect-wallet-button"
      className={cx("flex h-40 items-center gap-6 max-md:h-32", isPrimit && "connect-wallet-cta")}
      onClick={handleClick}
    >
      <WalletIcon className="box-content size-20" />
      <span>{children}</span>
    </Button>
  );

  return (
    <PrimitCornerBracketFrame className="shrink-0" enabled={isPrimit} layout="tl-br">
      {button}
    </PrimitCornerBracketFrame>
  );
}
