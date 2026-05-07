import { Trans, t } from "@lingui/macro";
import { Signer, ethers } from "ethers";
import { Link } from "react-router-dom";

import { AddTokenPermitFn } from "@/modules/lighter/context/TokenPermitsContext/TokenPermitsContextProvider";
import { getChainName, getExplorerUrl } from "config/chains";
import { INVALID_PERMIT_SIGNATURE_ERROR } from "lib/errors/customErrors";
import { helperToast } from "lib/helperToast";
import { metrics } from "lib/metrics";
import TokenAbi from "sdk/abis/Token";
import { getNativeToken, getToken } from "sdk/configs/tokens";
import { InfoTokens, TokenInfo } from "sdk/types/tokens";

import { getInvalidPermitSignatureToastContent } from "components/Errors/errorToasts";
import ExternalLink from "components/ExternalLink/ExternalLink";
import { ToastifyDebug } from "components/ToastifyDebug/ToastifyDebug";

type Params = {
  setIsApproving: (val: boolean) => void;
  signer: Signer | undefined;
  tokenAddress: string;
  spender: string;
  chainId: number;
  permitParams:
    | {
        addTokenPermit: AddTokenPermitFn;
        setIsPermitsDisabled: (disabled: boolean) => void;
        isPermitsDisabled: boolean;
      }
    | undefined;
  onApproveSubmitted?: ({ isPermit }: { isPermit: boolean }) => void;
  onApproveFail?: (error: Error, { isPermit }: { isPermit: boolean }) => void;
  getTokenInfo?: (infoTokens: InfoTokens, tokenAddress: string) => TokenInfo;
  infoTokens?: InfoTokens;
  pendingTxns?: any[];
  setPendingTxns?: (txns: any[]) => void;
  includeMessage?: boolean;
  approveAmount: bigint | undefined;
};

export async function approveTokens({
  setIsApproving,
  signer,
  tokenAddress,
  spender,
  chainId,
  onApproveSubmitted,
  onApproveFail,
  getTokenInfo,
  infoTokens,
  pendingTxns,
  setPendingTxns,
  includeMessage,
  approveAmount,
  permitParams,
}: Params): Promise<void> {
  setIsApproving(true);

  if (approveAmount === undefined) {
    approveAmount = ethers.MaxUint256;
  }

  let shouldUsePermit = false;
  try {
    const token = getToken(chainId, tokenAddress);
    shouldUsePermit = Boolean(token?.isPermitSupported && !token.isPermitDisabled);
  } catch (e) {
    // ...ignore in case of glv / gm approval
  }

  if (permitParams?.addTokenPermit && shouldUsePermit && !permitParams.isPermitsDisabled) {
    return await permitParams
      .addTokenPermit(tokenAddress, spender, approveAmount)
      .then(() => {
        onApproveSubmitted?.({ isPermit: true });
        helperToast.success(
          <div>
            <Trans>Permit signed!</Trans>
            <br />
          </div>
        );
      })
      .catch((e) => {
        onApproveFail?.(e, { isPermit: true });
        let failMsg;
        let isUserError = false;

        if (e.message.includes("user rejected")) {
          isUserError = true;
          failMsg = t`Permit signing was cancelled`;
        } else if (e.message.includes(INVALID_PERMIT_SIGNATURE_ERROR)) {
          permitParams.setIsPermitsDisabled(true);
          failMsg = getInvalidPermitSignatureToastContent();
        } else {
          failMsg = (
            <>
              <Trans>Permit signing failed</Trans>
              <br />
              <ToastifyDebug error={String(e)} />
            </>
          );
        }

        if (!isUserError) {
          metrics.pushError(e, "approveTokens.permitError");
        }

        helperToast.error(failMsg);
      })
      .finally(() => {
        setIsApproving(false);
      });
  }

  if (!signer) {
    throw new Error("Signer is required for token approval");
  }

  const contract = new ethers.Contract(tokenAddress, TokenAbi, signer);
  const nativeToken = getNativeToken(chainId);
  const networkName = getChainName(chainId);
  
  // For USDT and similar tokens, if there's already a non-zero allowance,
  // we need to reset it to 0 first before approving a new value
  // This is required for some token implementations (e.g., older USDT versions)
  try {
    const userAddress = await signer.getAddress();
    const currentAllowance = await contract.allowance(userAddress, spender);
    // If current allowance is non-zero and we're trying to approve a new non-zero value,
    // reset to 0 first (this handles USDT's requirement)
    if (currentAllowance > 0n && approveAmount > 0n) {
      try {
        const resetTx = await contract.approve(spender, 0n);
        await resetTx.wait();
      } catch (resetError) {
        // If reset fails, try to continue anyway (some tokens may allow direct approval)
        // eslint-disable-next-line no-console
        console.warn("Failed to reset approval to 0, attempting direct approval:", resetError);
      }
    }
  } catch (allowanceError) {
    // If checking allowance fails, try to continue with approval anyway
    // eslint-disable-next-line no-console
    console.warn("Failed to check current allowance, attempting approval:", allowanceError);
  }

  return await contract
    .approve(spender, approveAmount ?? ethers.MaxUint256)
    .then(async (res) => {
      const txUrl = getExplorerUrl(chainId) + "tx/" + res.hash;
      helperToast.success(
        <div>
          <Trans>
            Approval submitted! <ExternalLink href={txUrl}>View status.</ExternalLink>
          </Trans>
          <br />
        </div>
      );

      if (onApproveSubmitted) {
        onApproveSubmitted({ isPermit: false });
      }
      if (getTokenInfo && infoTokens && pendingTxns && setPendingTxns) {
        const token = getTokenInfo(infoTokens, tokenAddress);
        const pendingTxn = {
          hash: res.hash,
          message: includeMessage ? t`${token.symbol} Approved!` : false,
        };
        setPendingTxns([...pendingTxns, pendingTxn]);
      }
    })
    .catch((e) => {
      onApproveFail?.(e, { isPermit: false });
      // eslint-disable-next-line no-console
      console.error(e);
      let failMsg;
      if (
        ["not enough funds for gas", "failed to execute call with revert code InsufficientGasFunds"].includes(
          e.data?.message
        )
      ) {
        failMsg = (
          <div>
            <Trans>
              There is not enough {nativeToken.symbol} in your account on {networkName} to send this transaction.
              <br />
              <br />
              <Link to="/trade">
                Buy or Transfer {nativeToken.symbol} to {networkName}
              </Link>
            </Trans>
          </div>
        );
      } else if (e.message?.includes("User denied transaction signature")) {
        failMsg = t`Approval was cancelled.`;
      } else {
        failMsg = (
          <>
            <Trans>Approval failed.</Trans>
            <br />
            <br />
            <ToastifyDebug error={String(e)} />
          </>
        );
      }
      helperToast.error(failMsg);
    })
    .finally(() => {
      setIsApproving(false);
    });
}
