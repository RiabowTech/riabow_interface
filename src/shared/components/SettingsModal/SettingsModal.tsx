import { Trans, msg, t } from "@lingui/macro";
import cx from "classnames";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useSettings } from "@/modules/lighter/context/SettingsContext";
import { useSubaccountContext } from "@/modules/lighter/context/SubaccountContext";
import { isDevelopment } from "config/env";
import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";
import { useLocalizedMap } from "lib/i18n";
import { roundToTwoDecimals } from "lib/numbers";
import { mustNeverExist } from "lib/types";
import { MAX_TWAP_NUMBER_OF_PARTS, MIN_TWAP_NUMBER_OF_PARTS } from "sdk/configs/twap";

import { SlideModal } from "components/Modal/SlideModal";

import { DebugSettings } from "./DebugSettings";
import { DisplaySettings } from "./DisplaySettings";
import { TradingMode } from "./shared";
import { TradingSettings } from "./TradingSettings";

import SettingsIcon from "img/ic_settings.svg?react";
import TradingIcon from "img/ic_antenna_bars.svg?react";
import InfoIcon from "img/ic_info_circle_stroke.svg?react";

import "./SettingsModal.css";

let SETTINGS_TABS: ("trading")[] = [];
if (isDevelopment()) {
  SETTINGS_TABS = ["trading"];
} else {
  SETTINGS_TABS = ["trading"];
}

type SettingsTab = (typeof SETTINGS_TABS)[number];

const TAB_LABELS = {
  trading: msg`Trading`,
  display: msg`Display`,
  debug: msg`Debug`,
};

export function SettingsModal({
  isSettingsVisible,
  setIsSettingsVisible,
}: {
  isSettingsVisible: boolean;
  setIsSettingsVisible: (value: boolean) => void;
}) {
  const { srcChainId } = useChainId();

  const settings = useSettings();
  const subaccountState = useSubaccountContext();

  const [activeTab, setActiveTab] = useState<SettingsTab>("trading");
  const [tradingMode, setTradingMode] = useState<TradingMode | undefined>(undefined);
  const [isTradingModeChanging, setIsTradingModeChanging] = useState(false);

  const [numberOfParts, setNumberOfParts] = useState<number>();

  useEffect(() => {
    if (!isSettingsVisible) return;

    subaccountState.refreshSubaccountData();

    if (settings.settingsWarningDotVisible) {
      settings.setSettingsWarningDotVisible(false);
    }

    setNumberOfParts(settings.savedTwapNumberOfParts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsVisible]);

  const onChangeSlippage = useCallback(
    (value: number) => {
      const slippage = parseFloat(String(value));
      if (isNaN(slippage)) {
        helperToast.error(t`Invalid slippage value`);
        return;
      }

      if (slippage > 500) {
        helperToast.error(t`Slippage should be less than -5%`);
        return;
      }

      const basisPoints = roundToTwoDecimals(slippage);
      if (parseInt(String(basisPoints)) !== parseFloat(String(basisPoints))) {
        helperToast.error(t`Max slippage precision is -0.01%`);
        return;
      }

      settings.setSavedAllowedSlippage(basisPoints);
    },
    [settings]
  );

  const onChangeExecutionFeeBufferBps = useCallback(
    (value: number) => {
      const executionFeeBuffer = parseFloat(String(value));

      if (isNaN(executionFeeBuffer) || executionFeeBuffer < 0) {
        helperToast.error(t`Invalid network fee buffer value`);
        return;
      }
      const nextExecutionBufferFeeBps = roundToTwoDecimals(executionFeeBuffer);

      if (parseInt(String(nextExecutionBufferFeeBps)) !== parseFloat(String(nextExecutionBufferFeeBps))) {
        helperToast.error(t`Max network fee buffer precision is 0.01%`);
        return;
      }

      settings.setExecutionFeeBufferBps(nextExecutionBufferFeeBps);
    },
    [settings]
  );

  const onChangeTwapNumberOfParts = useCallback((value: number) => {
    const parsedValue = parseInt(String(value));

    setNumberOfParts(parsedValue);
  }, []);

  const onBlurTwapNumberOfParts = useCallback(() => {
    if (!numberOfParts || isNaN(numberOfParts) || numberOfParts < 0) {
      helperToast.error(t`Invalid TWAP number of parts value`);
      setNumberOfParts(settings.savedTwapNumberOfParts);
      return;
    }

    if (numberOfParts < MIN_TWAP_NUMBER_OF_PARTS || numberOfParts > MAX_TWAP_NUMBER_OF_PARTS) {
      helperToast.error(t`Number of parts must be between ${MIN_TWAP_NUMBER_OF_PARTS} and ${MAX_TWAP_NUMBER_OF_PARTS}`);
      setNumberOfParts(settings.savedTwapNumberOfParts);
      return;
    }

    settings.setSavedTWAPNumberOfParts(numberOfParts);
  }, [numberOfParts, settings]);

  const onClose = useCallback(() => {
    setIsSettingsVisible(false);
  }, [setIsSettingsVisible]);

  const handleTradingModeChange = useCallback(
    async (mode: TradingMode) => {
      const prevMode = tradingMode;
      setIsTradingModeChanging(true);
      setTradingMode(mode);

      switch (mode) {
        case TradingMode.Classic: {
          if (srcChainId) {
            // eslint-disable-next-line no-console
            console.error("Express trading can not be disabled for multichain");
            setTradingMode(prevMode);
            setIsTradingModeChanging(false);
            return;
          }
          if (subaccountState.subaccount) {
            const isSubaccountDeactivated = await subaccountState.tryDisableSubaccount();

            if (!isSubaccountDeactivated) {
              setTradingMode(prevMode);
              setIsTradingModeChanging(false);
              return;
            }
          }

          settings.setExpressOrdersEnabled(false);
          setIsTradingModeChanging(false);
          break;
        }
        case TradingMode.Express: {
          if (subaccountState.subaccount) {
            const isSubaccountDeactivated = await subaccountState.tryDisableSubaccount();

            if (!isSubaccountDeactivated) {
              setTradingMode(prevMode);
              setIsTradingModeChanging(false);
              return;
            }
          }

          settings.setExpressOrdersEnabled(true);
          setIsTradingModeChanging(false);
          break;
        }
        case TradingMode.Express1CT: {
          const isSubaccountActivated = await subaccountState.tryEnableSubaccount();

          if (!isSubaccountActivated) {
            setTradingMode(prevMode);
            setIsTradingModeChanging(false);
            return;
          }

          settings.setExpressOrdersEnabled(true);
          setIsTradingModeChanging(false);
          break;
        }
        default: {
          mustNeverExist(mode);
          break;
        }
      }
    },
    [settings, srcChainId, subaccountState, tradingMode]
  );

  useEffect(
    function defineTradingMode() {
      if (isTradingModeChanging) {
        return;
      }

      let nextTradingMode = tradingMode;

      if (subaccountState.subaccount) {
        nextTradingMode = TradingMode.Express1CT;
      } else if (settings.expressOrdersEnabled) {
        nextTradingMode = TradingMode.Express;
      } else {
        nextTradingMode = TradingMode.Classic;
      }

      if (nextTradingMode !== tradingMode) {
        setTradingMode(nextTradingMode);
      }
    },
    [isTradingModeChanging, settings.expressOrdersEnabled, subaccountState.subaccount, tradingMode]
  );

  const tabLabels = useLocalizedMap(TAB_LABELS);

  const tabOptions = useMemo(
    () =>
      SETTINGS_TABS.map((tab) => ({
        value: tab,
        label: tabLabels[tab],
      })),
    [tabLabels]
  );

  const modalTitle = (
    <div className="settings-modal-header">
      <div className="settings-modal-header__icon">
        <SettingsIcon />
      </div>
      <div>
        <div className="settings-modal-header__title">
          <Trans>Settings</Trans>
        </div>
        <div className="settings-modal-header__subtitle">
          <Trans>Manage your trading preferences</Trans>
        </div>
      </div>
    </div>
  );

  const footerContent = (
    <>
      <div className="settings-modal-footer__hint">
        <span className="settings-modal-footer__info">
          <InfoIcon />
        </span>
        <span>
          <Trans>You can change this setting anytime in trading settings.</Trans>
        </span>
      </div>
      <button type="button" className="settings-modal-footer__button" onClick={onClose}>
        <Trans>Close</Trans>
      </button>
    </>
  );

  return (
    <SlideModal
      isVisible={isSettingsVisible}
      setIsVisible={setIsSettingsVisible}
      label={modalTitle}
      qa="settings-modal"
      className="settings-modal text-body-medium text-typography-secondary"
      desktopContentClassName="settings-modal-panel"
      footerContent={footerContent}
    >
      <div className="settings-modal-layout">
        <aside className="settings-modal-sidebar" aria-label={t`Settings sections`}>
          {tabOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cx("settings-modal-sidebar__item", activeTab === option.value && "is-active")}
              onClick={() => setActiveTab(option.value)}
            >
              <TradingIcon />
              <span>{option.label}</span>
            </button>
          ))}
        </aside>
        <div className="settings-modal-content">
          <TabWrapper tab="trading" activeTab={activeTab}>
            <TradingSettings
              tradingMode={tradingMode}
              handleTradingModeChange={handleTradingModeChange}
              onChangeSlippage={onChangeSlippage}
              onChangeExecutionFeeBufferBps={onChangeExecutionFeeBufferBps}
              onChangeTwapNumberOfParts={onChangeTwapNumberOfParts}
              onBlurTwapNumberOfParts={onBlurTwapNumberOfParts}
              numberOfParts={numberOfParts}
              onClose={onClose}
            />
          </TabWrapper>
          {/* <TabWrapper tab="display" activeTab={activeTab}>
            <DisplaySettings />
          </TabWrapper> */}
          {/* <TabWrapper tab="debug" activeTab={activeTab}>
            <DebugSettings isSettingsVisible={isSettingsVisible} />
          </TabWrapper> */}
        </div>
      </div>
    </SlideModal>
  );
}

function TabWrapper({
  tab,
  activeTab,
  children,
}: {
  tab: SettingsTab;
  activeTab: SettingsTab;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx("w-full shrink-0", {
        "max-md:hidden md:invisible": activeTab !== tab,
        "order-first": activeTab === tab,
      })}
    >
      {children}
    </div>
  );
}
