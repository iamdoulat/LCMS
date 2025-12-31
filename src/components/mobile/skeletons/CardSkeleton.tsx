export function CardSkeleton() {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
        </div>
    );
}

export function ListItemSkeleton() {
    return (
        <div className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
            </div>
        </div>
    );
}

export function ChartSkeleton() {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/2 mb-6"></div>
            <div className="flex justify-center mb-6">
                <div className="w-48 h-48 bg-slate-200 rounded-full"></div>
            </div>
            <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-slate-200 rounded-full"></div>
                            <div className="h-3 bg-slate-200 rounded w-20"></div>
                        </div>
                        <div className="h-3 bg-slate-200 rounded w-8"></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function StatCardSkeleton() {
    return (
        <div className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                <div className="flex-1">
                    <div className="h-6 bg-slate-200 rounded w-16 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-20"></div>
                </div>
            </div>
        </div>
    );
}
