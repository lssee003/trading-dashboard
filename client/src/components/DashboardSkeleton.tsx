export function DashboardSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-3 animate-pulse">
      {/* Hero + Analysis skeleton — matches xl:grid-cols-5 layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <div className="xl:col-span-2 rounded-lg p-4 h-32 skeleton-terminal" />
        <div className="xl:col-span-3 rounded-lg p-4 h-32 skeleton-terminal" />
      </div>

      {/* Category panels skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg p-3 h-60 skeleton-terminal" />
        ))}
      </div>

      {/* Bottom panels skeleton — matches xl:grid-cols-5 layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <div className="xl:col-span-3 rounded-lg p-4 h-64 skeleton-terminal" />
        <div className="xl:col-span-2 rounded-lg p-4 h-64 skeleton-terminal" />
      </div>
    </div>
  );
}
