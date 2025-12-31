import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ErrorFallbackProps {
    error?: Error | string;
    resetError?: () => void;
    showHomeButton?: boolean;
}

export function ErrorFallback({ error, resetError, showHomeButton = true }: ErrorFallbackProps) {
    const router = useRouter();

    const handleRetry = () => {
        if (resetError) {
            resetError();
        } else {
            window.location.reload();
        }
    };

    const handleGoHome = () => {
        router.push('/mobile/dashboard');
    };

    const errorMessage = typeof error === 'string' ? error : error?.message || 'An unexpected error occurred';

    return (
        <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm max-w-md w-full text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">
                    Failed to load data
                </h3>
                <p className="text-sm text-slate-600 mb-6">
                    {errorMessage}
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={handleRetry}
                        className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors active:scale-98"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                    </button>
                    {showHomeButton && (
                        <button
                            onClick={handleGoHome}
                            className="flex-1 bg-slate-100 text-slate-700 py-2.5 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors active:scale-98"
                        >
                            <Home className="w-4 h-4" />
                            Home
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
