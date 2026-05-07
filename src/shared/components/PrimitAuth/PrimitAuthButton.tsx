import { Trans } from "@lingui/macro";
import { useCallback, useEffect } from "react";
import { useAccount } from "wagmi";

import { usePrimitAuth } from "@/modules/lighter/api";

import Button from "components/Button/Button";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import "./PrimitAuthButton.scss";

interface PrimitAuthButtonProps {
  variant?: "primary" | "secondary" | "link";
  className?: string;
  showStatus?: boolean;
}

export function PrimitAuthButton({
  variant = "secondary",
  className,
  showStatus = true,
}: PrimitAuthButtonProps) {
  const { isConnected } = useAccount();
  const {
    isAuthenticated,
    isAuthenticating,
    error,
    authenticate,
    logout,
    clearError,
  } = usePrimitAuth();

  // Debug: Log authentication state changes (only important ones)
  useEffect(() => {
    // Only log when authentication state changes (not on every render)
    if (isAuthenticated !== undefined) {
    }
  }, [isAuthenticated]); // Only depend on isAuthenticated to reduce logs

  const handleClick = useCallback(async () => {
    if (isAuthenticated) {
      logout();
    } else {
      clearError();
      await authenticate();
    }
  }, [isAuthenticated, authenticate, logout, clearError]);

  // Don't show if wallet is not connected
  if (!isConnected) {
    return null;
  }

  const buttonText = isAuthenticating ? (
    <Trans>Signing...</Trans>
  ) : isAuthenticated ? (
    <Trans>Sign Out</Trans>
  ) : (
    <Trans>Sign In</Trans>
  );

  const statusIndicator = showStatus && (
    <span
      className={`PrimitAuthButton-status ${isAuthenticated ? "PrimitAuthButton-status--authenticated" : ""}`}
    />
  );

  return (
    <div className={`PrimitAuthButton ${className || ""}`}>
      {error ? (
      <TooltipWithPortal
        handle={
          <Button
            variant={variant}
            className="PrimitAuthButton-button"
            onClick={handleClick}
            disabled={isAuthenticating}
          >
            {statusIndicator}
            {buttonText}
          </Button>
        }
          disabled={false}
        isHandlerDisabled={false}
          shouldPreventDefault={false}
        renderContent={() => (
          <div className="PrimitAuthButton-error">
            <Trans>Error: {error}</Trans>
          </div>
        )}
      />
      ) : (
        <Button
          variant={variant}
          className="PrimitAuthButton-button"
          onClick={handleClick}
          disabled={isAuthenticating}
        >
          {statusIndicator}
          {buttonText}
        </Button>
      )}
    </div>
  );
}

export default PrimitAuthButton;
