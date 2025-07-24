import React from "react";

export const UserTableSkeleton = () => {
  return (
    <div className="rounded-md border border-zinc-800">
      <div className="bg-zinc-800 p-4">
        <div className="grid grid-cols-5 gap-4">
          <div className="h-4 bg-zinc-700 rounded animate-pulse" />
          <div className="h-4 bg-zinc-700 rounded animate-pulse" />
          <div className="h-4 bg-zinc-700 rounded animate-pulse" />
          <div className="h-4 bg-zinc-700 rounded animate-pulse" />
          <div className="h-4 bg-zinc-700 rounded animate-pulse" />
        </div>
      </div>
      <div className="p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4">
            <div className="h-4 bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 bg-zinc-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}; 