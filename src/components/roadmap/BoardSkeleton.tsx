/** Shown while the board's client shell hydrates, and as the Suspense fallback. */
export function BoardSkeleton() {
  return (
    <div aria-hidden>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-8 w-64" />
          <div className="skeleton h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton size-10 rounded-control" />
          <div className="skeleton size-10 rounded-control" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((column) => (
          <div key={column} className="flex flex-col gap-3">
            <div className="skeleton my-3 h-7 w-32 rounded-control" />
            {[0, 1, 2].map((card) => (
              <div key={card} className="skeleton h-24 rounded-card" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
