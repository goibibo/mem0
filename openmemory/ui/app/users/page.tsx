"use client";

import { UsersSection } from "./components/UsersSection";
import { UserFilters } from "./components/UserFilters";
import "@/styles/animation.css";

export default function UsersPage() {
  return (
    <main className="flex-1 py-6">
      <div className="container">
        <div className="mt-1 pb-4 animate-fade-slide-down">
          <UserFilters />
        </div>
        <div className="animate-fade-slide-down delay-1">
          <UsersSection />
        </div>
      </div>
    </main>
  );
} 