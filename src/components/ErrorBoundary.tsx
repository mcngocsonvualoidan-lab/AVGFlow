import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="p-6 m-4 bg-red-950/30 border border-red-500/50 rounded-2xl text-red-200">
                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                        ⚠️ Application Error
                    </h2>
                    <p className="opacity-80 mb-4">
                        Đã xảy ra lỗi hiển thị. Vui lòng tải lại trang hoặc liên hệ IT.
                    </p>
                    <div className="bg-black/50 p-4 rounded-lg font-mono text-xs overflow-auto max-h-[200px] border border-red-500/20">
                        {this.state.error?.toString()}
                        <br />
                        {this.state.error?.stack}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
