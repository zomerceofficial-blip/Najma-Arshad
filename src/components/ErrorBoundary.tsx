import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Truvornex Workspace ErrorBoundary caught error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAFB] dark:bg-[#090A0D] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white dark:bg-[#111318] border border-[#E2E5EA] dark:border-white/[0.1] rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FEF0EE] dark:bg-red-500/10 border border-[#F5C6C2] dark:border-red-500/25 flex items-center justify-center text-[#B42318] dark:text-red-300">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-base font-semibold text-[#111215] dark:text-white">
                  Workspace View Recovery
                </h1>
                <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF]">
                  Truvornex guarded against an unexpected client state error.
                </p>
              </div>
            </div>
            <p className="text-xs text-[#5E6572] dark:text-[#9CA3AF] bg-[#F8F9FA] dark:bg-[#161922] border border-[#E2E5EA] dark:border-white/[0.08] rounded-xl p-3 font-mono break-words">
              {this.state.message}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, message: '' })}
                className="h-9 px-4 border border-[#D8DCE3] dark:border-white/[0.12] rounded-lg text-xs font-medium text-[#111215] dark:text-[#F3F4F6]"
              >
                Try Recovering
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="h-9 px-4 bg-[#111215] dark:bg-white text-white dark:text-[#0B0C0E] rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload App</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
