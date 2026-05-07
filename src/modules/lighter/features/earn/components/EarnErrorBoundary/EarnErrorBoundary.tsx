import { Component, ErrorInfo, ReactNode } from "react";
import { Trans } from "@lingui/macro";
import Button from "components/Button/Button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class EarnErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[EarnErrorBoundary] Caught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-24 text-center">
          <div className="flex flex-col gap-16 max-w-[500px]">
            <h2 className="earn-accent-text text-h3 m-0 max-md:text-body-large">
              <Trans>Oops! Something went wrong</Trans>
            </h2>
            <p className="text-body-medium text-typography-secondary m-0">
              <Trans>
                We encountered an error while loading the Earn page. Please try refreshing the page or contact support if the problem persists.
              </Trans>
            </p>
            {this.state.error && (
              <details className="text-left p-12 bg-fill-surfaceElevated border-1/2 border-slate-700 rounded-4">
                <summary className="cursor-pointer text-body-small text-typography-tertiary mb-8">
                  <Trans>Error Details</Trans>
                </summary>
                <pre className="text-[12px] text-typography-tertiary overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <Button
              variant="primary-action"
              onClick={this.handleReset}
              className="mt-8"
            >
              <Trans>Refresh Page</Trans>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
