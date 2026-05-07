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
    <div>
      {getIsExpressSupported(chainId) && (
        <>
          <SettingsSection>
            <div className="text-14 font-medium text-typography-primary">
              <Trans>Trading Mode</Trans>
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
            <div className="opacity-0">
              version:
              {(import.meta.env.VITE_GIT_COMMIT_HASH || import.meta.env.VITE_APP_VERSION || "unknown").substring(
                0,
                8
              )}
            </div>

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

      <SettingsSection className="mt-2">
        {/* <InputSetting
          title={<Trans>Default Allowed Slippage</Trans>}
          description={
            <Trans>
              The maximum allowed percentage difference between the mark price and the execution price for market
              orders.
            </Trans>
          }
          defaultValue={DEFAULT_SLIPPAGE_AMOUNT}
          value={parseFloat(String(settings.savedAllowedSlippage))}
          onChange={onChangeSlippage}
          suggestions={EMPTY_ARRAY}
        /> */}

        {/* <InputSetting
          title={<Trans>TWAP Number of Parts</Trans>}
          description={
            <div>
              <Trans>The default number of parts for Time-Weighted Average Price (TWAP) orders.</Trans>
            </div>
          }
          defaultValue={DEFAULT_TIME_WEIGHTED_NUMBER_OF_PARTS}
          value={numberOfParts}
          onChange={onChangeTwapNumberOfParts}
          onBlur={onBlurTwapNumberOfParts}
          type="number"
        /> */}

        {/* {settings.shouldUseExecutionFeeBuffer && (
          <InputSetting
            title={<Trans>Max Network Fee Buffer</Trans>}
            description={
              <Trans>
                The max network fee is set to a higher value to handle potential increases in gas price during order
                execution. Any excess network fee will be refunded to your account when the order is executed.
              </Trans>
            }
            defaultValue={30}
            value={parseFloat(String(settings.executionFeeBufferBps))}
            onChange={onChangeExecutionFeeBufferBps}
            maxValue={1000 * 100}
            suggestions={EMPTY_ARRAY}
          />
        )} */}

        {/* <ToggleSwitch isChecked={settings.isAutoCancelTPSL} setIsChecked={settings.setIsAutoCancelTPSL}>
          <TooltipWithPortal
            content={
              <Trans>
                TP/SL orders will be automatically cancelled when the associated position is completely closed. This
                will only affect newly created TP/SL orders since the setting was enabled.
              </Trans>
            }
            handle={<Trans>Auto-Cancel TP/SL</Trans>}
            variant="icon"
            className="font-medium"
          />
        </ToggleSwitch> */}

        {/* External swaps are enabled by default on Botanix */}
        {/* {chainId !== BOTANIX && (
          <ToggleSwitch
            isChecked={settings.externalSwapsEnabled}
            setIsChecked={settings.setExternalSwapsEnabled}
            className="font-medium"
          >
            <Trans>Enable External Swaps</Trans>
          </ToggleSwitch>
        )} */}

        {/* <ToggleSwitch
          isChecked={settings.isSetAcceptablePriceImpactEnabled}
          setIsChecked={settings.setIsSetAcceptablePriceImpactEnabled}
          className="font-medium"
        >
          <Trans>Set Acceptable Price Impact</Trans>
        </ToggleSwitch> */}
      </SettingsSection>
    </div>
  );
}
