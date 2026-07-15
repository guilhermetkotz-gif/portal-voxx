import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default class ChatErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ChatVoxx ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[calc(100vh-140px)] items-center justify-center bg-slate-50 rounded-xl border border-slate-200">
          <div className="text-center max-w-md p-6">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Erro ao carregar o chat</h3>
            <p className="text-sm text-slate-500 mb-1">
              Ocorreu um erro inesperado ao carregar o Chat Voxx.
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-slate-400 mb-4 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <Button onClick={this.handleReload} className="bg-violet-600 hover:bg-violet-700">
              <RefreshCw className="w-4 h-4 mr-2" /> Recarregar
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}