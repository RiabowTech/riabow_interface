import React from "react";
import { Trans } from "@lingui/macro";

export const EarnTitle: React.FC = () => {
  return (
    <div className="zanbara-page-hero zanbara-page-hero--inset w-full">
      <header className="flex flex-col items-start text-left">
        <h1 className="zanbara-page-hero__title">
          <Trans>Earn</Trans>
        </h1>
        <p className="zanbara-page-hero__subtitle zanbara-page-hero__subtitle--tag">
          <Trans>AI STRATEGY</Trans>
        </p>
      </header>
    </div>
  );
};
