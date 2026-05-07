import "lib/polyfills";
import "styles/tailwind.css";
import "lib/monkeyPatching";

import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";

import { LANGUAGE_LOCALSTORAGE_KEY } from "config/localStorage";
import { defaultLocale, dynamicActivate } from "lib/i18n";
import { initSentry, Sentry } from "lib/sentry";
import WalletProvider from "lib/wallets/WalletProvider";

import App from "./app/App";
import reportWebVitals from "./reportWebVitals";

// Initialize Sentry before rendering the app
initSentry();

async function bootstrap() {
  const locale = localStorage.getItem(LANGUAGE_LOCALSTORAGE_KEY) || defaultLocale;
  /**
   * 必须在首帧 React 渲染前加载并 activate 文案目录。
   * 若先 `i18n.load(locale, {})` + `activate`，Lingui 会用空 catalog 渲染，界面会短暂出现 message id（像乱码），
   * 直到异步 `dynamicActivate` 完成才恢复。
   */
  try {
    await dynamicActivate(locale);
  } catch (error) {
    console.error("[i18n bootstrap] failed to activate locale:", locale, error);
    try {
      await dynamicActivate(defaultLocale);
    } catch (fallbackError) {
      console.error("[i18n bootstrap] fallback locale failed:", defaultLocale, fallbackError);
    }
  }

  createRoot(document.getElementById("root")!).render(
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-8 text-white">
          <h1 className="mb-4 text-2xl font-bold">Something went wrong</h1>
          <p className="mb-4 text-gray-400">An unexpected error occurred. Our team has been notified.</p>
          <pre className="mb-6 max-w-lg overflow-auto rounded bg-slate-800 p-4 text-sm text-red-400">
            {error?.toString()}
          </pre>
          <button
            onClick={resetError}
            className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      )}
      onError={(error) => {
        console.error("[Sentry ErrorBoundary] Caught error:", error);
      }}
    >
      <Router>
        <WalletProvider>
          <App />
        </WalletProvider>
      </Router>
    </Sentry.ErrorBoundary>
  );

  const bootShell = document.getElementById("boot-shell");
  if (bootShell) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bootShell.remove();
        document.body.classList.remove("trade-boot");
      });
    });
  }
}

bootstrap();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.info))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
export { formatTokenAmount, formatTokenAmountWithUsd, formatUsd } from "lib/numbers";
