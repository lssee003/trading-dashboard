export function DashboardSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-4 animate-pulse">
      {/* Hero skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg p-5 h-48 skeleton-terminal" />
        <div className="rounded-lg p-4 h-48 skeleton-terminal" />
      </div>

      {/* Category panels skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg p-3 h-60 skeleton-terminal" />
        ))}
      </div>

      {/* Bottom panels skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-lg p-4 h-64 skeleton-terminal" />
        <div className="lg:col-span-2 rounded-lg p-4 h-64 skeleton-terminal" />
      </div>
    </div>
  );
}
