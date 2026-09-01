/**
 * Error Boundary - keeps one broken view from blanking the whole app.
 */

'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
     
    console.error('[ErrorBoundary]', error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="card text-center py-12">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Something went wrong</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm max-w-md mx-auto">
          {this.state.error.message || 'This view hit an unexpected error.'}
        </p>
        <button onClick={this.reset} className="btn-primary btn-sm">
          Try again
        </button>
      </div>
    );
  }
}
