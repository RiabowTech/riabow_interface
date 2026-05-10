import { Trans } from "@lingui/macro";

import { useSettings } from "@/modules/lighter/context/SettingsContext";
import { useTradingAccountSettlementChainId } from "@/modules/lighter/context/TradingAccountContext";
import { SettlementChainWarningContainer } from "@/modules/lighter/domain/multichain/SettlementChainWarningContainer";
import { getChainName } from "config/chains";
import { getIsExpressSupported } from "config/features";
import { CHAIN_ID_TO_NETWORK_ICON } from "config/icons";
import { MULTICHAIN_SOURCE_TO_SETTLEMENTS_MAPPING } from "config/multichain";
import { useTokensDataRequest } from "domain/synthetics/tokens/useTokensDataRequest";
import { useChainId } from "lib/chains";
import { formatTokenAmount } from "lib/numbers";
import { getByKey } from "lib/objects";
import { getNativeToken, NATIVE_TOKEN_ADDRESS } from "sdk/configs/tokens";

import { DropdownSelector } from "components/DropdownSelector/DropdownSelector";
import TokenIcon from "components/TokenIcon/TokenIcon";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import HourGlassIcon from "img/ic_hourglass.svg?react";
import TradingIcon from "img/ic_antenna_bars.svg?react";

import { SettingButton, SettingsSection, TradingMode } from "./shared";

interface TradingSettingsProps {
  tradingMode: TradingMode | undefined;
  handleTradingModeChange: (mode: TradingMode) => void;
  onChangeSlippage: (value: number) => void;
  onChangeExecutionFeeBufferBps: (value: number) => void;
  onChangeTwapNumberOfParts: (value: number) => void;
  onBlurTwapNumberOfParts: () => void;
  numberOfParts: number | undefined;
  onClose: () => void;
}

export function TradingSettings({
  tradingMode,
  handleTradingModeChange,
  onChangeSlippage: _onChangeSlippage,
  onChangeExecutionFeeBufferBps: _onChangeExecutionFeeBufferBps,
  onChangeTwapNumberOfParts: _onChangeTwapNumberOfParts,
  onBlurTwapNumberOfParts: _onBlurTwapNumberOfParts,
  numberOfParts: _numberOfParts,
  onClose: _onClose,
}: TradingSettingsProps) {
  const { chainId, srcChainId } = useChainId();
  const settings = useSettings();
  const [settlementChainId, setSettlementChainId] = useTradingAccountSettlementChainId();
  const nativeToken = getNativeToken(chainId);
  const nativeTokenSymbol = nativeToken.symbol;

  // Get native token data for wallet balance display
  const { tokensData } = useTokensDataRequest(chainId, srcChainId);
  const nativeTokenData = getByKey(tokensData, NATIVE_TOKEN_ADDRESS);

  return (
    <div className="settings-trading">
      {getIsExpressSupported(chainId) && (
        <>
          <div className="settings-trading__hero">
            <div className="settings-trading__hero-icon">
              <TradingIcon />
            </div>
            <div>
              <h3>
                <Trans>Trading</Trans>
              </h3>
              <p>
                <Trans>Customize your trading experience</Trans>
              </p>
            </div>
          </div>
          <SettingsSection>
            <div className="settings-trading__section-heading">
              <h4>
                <Trans>Trading Mode</Trans>
              </h4>
              <p>
                <Trans>Choose the trading experience that works best for you.</Trans>
              </p>
            </div>
            {!srcChainId && (
              <SettingButton
                title={<Trans>Classic</Trans>}
                description={<Trans>On-chain signing for every transaction.</Trans>}
                info={
                  <Trans>
                    You sign each transaction on-chain using your own RPC, typically provided by your wallet. Gas
                    payments in {nativeTokenSymbol}.
                  </Trans>
                }
                icon={<HourGlassIcon className="size-28" />}
                active={tradingMode === TradingMode.Classic}
                chip={<Trans>Recommended</Trans>}
                onClick={() => handleTradingModeChange(TradingMode.Classic)}
              />
            )}

            {/* <SettingButton
              title={<Trans>Express</Trans>}
              description={<Trans>High execution reliability using premium RPCs.</Trans>}
              info={
                <Trans>
                  You sign each transaction off-chain. Trades use premium RPCs for reliability, even during network
                  congestion. Gas payments in {gasPaymentTokensText}.
                </Trans>
              }
              icon={<ExpressIcon className="size-28" />}
              disabled={isExpressTradingDisabled}
              disabledTooltip={
                isNonEoaAccountOnAnyChain || isGeminiWallet ? (
                  <Trans>Smart wallets are not supported on Express or One-Click Trading.</Trans>
                ) : undefined
              }
              chip={
                <Chip color="gray">
                  <Trans>Optimal</Trans>
                </Chip>
              }
              active={tradingMode === TradingMode.Express}
              onClick={() => handleTradingModeChange(TradingMode.Express)}
            /> */}
            {/* <SettingButton
              title={<Trans>Express + One-Click</Trans>}
              description={<Trans>CEX-like experience with Express reliability.</Trans>}
              icon={<OneClickIcon className="size-28" />}
              disabled={isExpressTradingDisabled}
              disabledTooltip={
                isNonEoaAccountOnAnyChain || isGeminiWallet ? (
                  <Trans>Smart wallets are not supported on Express or One-Click Trading.</Trans>
                ) : undefined
              }
              info={
                <Trans>
                  Transactions are executed for you without individual signing, providing a seamless, CEX-like
                  experience. Trades use premium RPCs for reliability, even during network congestion. Gas payments in{" "}
                  {gasPaymentTokensText}.
                </Trans>
              }
              chip={
                <Chip color="blue">
                  <Trans>Fastest</Trans>
                </Chip>
              }
              active={tradingMode === TradingMode.Express1CT}
              onClick={() => handleTradingModeChange(TradingMode.Express1CT)}
            /> */}

            {/* {isOutOfGasPaymentBalance && !(isNonEoaAccountOnAnyChain || isGeminiWallet) && (
              <ExpressTradingOutOfGasBanner onClose={onClose} />
            )} */}

            {/* {Boolean(subaccountState.subaccount && getIsSubaccountActive(subaccountState.subaccount)) && (
              <OneClickAdvancedSettings />
            )} */}

            {settings.expressOrdersEnabled && nativeTokenData && (
              <div className="flex w-full items-center justify-between py-8">
                <div className="font-medium">
                  <Trans>Gas Token</Trans>
                </div>
                <div className="flex items-center">
                  <TokenIcon symbol={nativeTokenData.symbol} className="mr-8" displaySize={16} />
                  <span className="mr-4">
                    {formatTokenAmount(nativeTokenData.balance, nativeTokenData.decimals, undefined, {
                      displayDecimals: 4,
                    })}
                  </span>
                  <span>{nativeTokenData.symbol}</span>
                </div>
              </div>
            )}
          </SettingsSection>
        </>
      )}

      {srcChainId && (
        <SettingsSection className="mt-2">
          <div className="flex items-center justify-between">
            <TooltipWithPortal
              className="font-medium"
              variant="icon"
              content={
                <Trans>
                  The settlement chain is the network used for your account and opening positions. Account balances and
                  positions are specific to the selected network.
                </Trans>
              }
              handle={<Trans>Settlement Chain</Trans>}
            />
            <DropdownSelector
              slim
              variant="ghost"
              value={settlementChainId}
              onChange={setSettlementChainId}
              options={MULTICHAIN_SOURCE_TO_SETTLEMENTS_MAPPING[srcChainId]}
              item={({ option }) => (
                <div className="flex items-center gap-8 text-typography-primary">
                  <img src={CHAIN_ID_TO_NETWORK_ICON[option]} alt={getChainName(option)} className="size-20" />
                  <span>{getChainName(option)}</span>
                </div>
              )}
              button={
                <div className="flex items-center gap-4 text-typography-primary">
                  <img
                    src={CHAIN_ID_TO_NETWORK_ICON[settlementChainId]}
                    alt={getChainName(settlementChainId)}
                    className="size-20"
                  />
                  <span>{getChainName(settlementChainId)}</span>
                </div>
              }
            />
          </div>
          <SettlementChainWarningContainer />
        </SettingsSection>
      )}

    </div>
  );
}
