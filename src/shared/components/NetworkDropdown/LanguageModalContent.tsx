import cx from "classnames";

import { dynamicActivate, isTestLanguage, locales } from "lib/i18n";
import { tryImportImage } from "lib/legacy";

import Button from "components/Button/Button";

import CheckedIcon from "img/ic_checked.svg?react";

type Props = {
  currentLanguage: string | undefined;
  onClose: () => void;
};

export default function LanguageModalContent({ currentLanguage, onClose }: Props) {
  return (
    <>
      {Object.keys(locales).map((item) => {
        return (
          <Button
            variant="secondary"
            key={item}
            className={cx({
              "!bg-button-secondary !text-typography-primary": currentLanguage === item,
            })}
            onClick={() => {
              dynamicActivate(item).then(onClose);
            }}
          >
            <div className="flex items-center gap-8">
              <div className="menu-item-icon">
                {isTestLanguage(item) ? (
                  "🫐"
                ) : (
                  (() => {
                    const flagSrc = tryImportImage(`flag_${item}.svg`);
                    return flagSrc ? (
                      <img className="network-dropdown-icon" src={flagSrc} alt={locales[item]} />
                    ) : (
                      <span className="network-dropdown-icon flex items-center justify-center text-12">🌐</span>
                    );
                  })()
                )}
              </div>
              <span className="text-body-medium font-medium">{locales[item]}</span>
            </div>
            <div className="network-dropdown-menu-item-img ml-auto py-4">
              {currentLanguage === item && <CheckedIcon />}
            </div>
          </Button>
        );
      })}
    </>
  );
}
