"use client";

import { useState, useEffect } from "react";
import { UserTable } from "./UserTable";
import { useUsersApi } from "@/hooks/useUsersApi";
import { useSearchParams } from "next/navigation";
import { UserTableSkeleton } from "@/skeleton/UserTableSkeleton";

export function UsersSection() {
  const searchParams = useSearchParams();
  const { fetchUsers, users, isLoading } = useUsersApi();
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);

  const searchQuery = searchParams.get("search") || "";

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = users.filter(user => 
        user.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [users, searchQuery]);

  if (isLoading) {
    return (
      <div className="w-full bg-transparent">
        <UserTableSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full bg-transparent">
      {filteredUsers.length > 0 ? (
        <UserTable users={filteredUsers} />
      ) : (
        <div className="rounded-md border border-zinc-800 p-8 text-center">
          <p className="text-zinc-400">
            {searchQuery ? `No users found matching "${searchQuery}"` : "No users found"}
          </p>
        </div>
      )}
    </div>
  );
} 