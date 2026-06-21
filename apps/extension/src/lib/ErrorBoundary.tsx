import { Component, type ReactNode } from "react";

interface Props {
  /** エラー発生時に表示する UI */
  fallback: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * React ErrorBoundary コンポーネント。
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  private readonly reset = () => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) {
      const { fallback } = this.props;
      return typeof fallback === "function" ? fallback(this.state.error, this.reset) : fallback;
    }
    return this.props.children;
  }
}
