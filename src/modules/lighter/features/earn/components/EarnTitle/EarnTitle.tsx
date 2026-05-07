import React from "react";
import { Trans } from "@lingui/macro";

export const EarnTitle: React.FC = () => {
  return (
    <div className="primit-page-hero primit-page-hero--inset w-full">
      <header className="flex flex-col items-start text-left">
        <h1 className="primit-page-hero__title">
          <Trans>Earn</Trans>
        </h1>
        <p className="primit-page-hero__subtitle primit-page-hero__subtitle--tag">
          <Trans>AI STRATEGY</Trans>
        </p>
      </header>
    </div>
  );
};
