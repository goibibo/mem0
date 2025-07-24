"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { debounce } from "lodash";
import { useRef } from "react";
import { CreateUserDialog } from "./CreateUserDialog";

export function UserFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = debounce(async (query: string) => {
    if (query) {
      router.push(`/users?search=${query}`);
    } else {
      router.push('/users');
    }
  }, 500);

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-4">
      <div className="flex flex-col md:flex-row gap-4 w-full">
        <div className="relative flex-1 max-w-[500px]">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            ref={inputRef}
            placeholder="Search users by ID, name, or email..."
            className="pl-8 bg-zinc-950 border-zinc-800"
            onChange={(e) => handleSearch(e.target.value)}
            defaultValue={searchParams.get('search') || ''}
          />
        </div>
        <div className="flex gap-2">
          <CreateUserDialog />
        </div>
      </div>
    </div>
  );
} 