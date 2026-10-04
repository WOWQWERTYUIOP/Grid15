import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 [GRID//15 UNCAUGHT CLIENT ERROR]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleReturnToLobby = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.hash = '';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-screen h-screen bg-[#0a0d14] flex flex-col items-center justify-center p-6 select-none font-sans text-white">
          <div className="max-w-md w-full bg-[#111827] border border-red-500/40 rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-red-500/5 pointer-events-none" />
            
            <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto mb-4 text-red-400 animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="font-mono text-xs tracking-widest text-red-400 mb-1">SYSTEM DIAGNOSTIC NOTICE</div>
            <h1 className="font-extrabold text-2xl tracking-wider text-white mb-2">GRID//15</h1>
            <p className="text-gray-300 text-sm mb-6">
              Something went wrong during execution. The system safely intercepted the exception to prevent a black screen.
            </p>

            {this.state.error && (
              <div className="text-left bg-black/60 border border-white/10 rounded-lg p-3 mb-6 overflow-x-auto max-h-32 text-xs font-mono text-rose-300">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReturnToLobby}
                className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-sm tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg"
              >
                <Home className="w-4 h-4" />
                RETURN TO LOBBY / RESTART
              </button>

              <button
                onClick={this.handleReset}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono text-xs tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-cyan-400" />
                RELOAD APPLICATION
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
