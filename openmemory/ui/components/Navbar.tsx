"use client";

import { Button } from "@/components/ui/button";
import { HiMiniRectangleStack } from "react-icons/hi2";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreateMemoryDialog } from "@/app/memories/components/CreateMemoryDialog";
import { CreateUserDialog } from "@/app/users/components/CreateUserDialog";
import { useMemoriesApi } from "@/hooks/useMemoriesApi";
import Image from "next/image";

import { useAppsApi } from "@/hooks/useAppsApi";
import { useConfig } from "@/hooks/useConfig";
import { useUsersApi } from "@/hooks/useUsersApi";
import { useRouter } from "next/navigation";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const memoriesApi = useMemoriesApi();
  const appsApi = useAppsApi();
  const configApi = useConfig();
  const usersApi = useUsersApi();

  // Define route matchers with typed parameter extraction
  const routeBasedFetchMapping: {
    match: RegExp;
    getFetchers: (params: Record<string, string>) => (() => Promise<any>)[];
  }[] = [
    {
      match: /^\/memory\/([^/]+)$/,
      getFetchers: ({ memory_id }) => [
        () => memoriesApi.fetchMemoryById(memory_id),
        () => memoriesApi.fetchAccessLogs(memory_id),
        () => memoriesApi.fetchRelatedMemories(memory_id),
      ],
    },
    {
      match: /^\/apps\/([^/]+)$/,
      getFetchers: ({ app_id }) => [
        () => appsApi.fetchAppMemories(app_id),
        () => appsApi.fetchAppAccessedMemories(app_id),
        () => appsApi.fetchAppDetails(app_id),
      ],
    },
    {
      match: /^\/memories$/,
      getFetchers: () => [memoriesApi.fetchMemories],
    },
    {
      match: /^\/apps$/,
      getFetchers: () => [appsApi.fetchApps],
    },
    {
      match: /^\/users$/,
      getFetchers: () => [usersApi.fetchUsers],
    },
  ];

  const getFetchersForPath = (path: string) => {
    for (const route of routeBasedFetchMapping) {
      const match = path.match(route.match);
      if (match) {
        if (route.match.source.includes("memory")) {
          return route.getFetchers({ memory_id: match[1] });
        }
        if (route.match.source.includes("app")) {
          return route.getFetchers({ app_id: match[1] });
        }
        return route.getFetchers({});
      }
    }
    return [];
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === href;
    return pathname.startsWith(href.substring(0, 5));
  };

  const activeClass = "bg-zinc-800 text-white border-zinc-600";
  const inactiveClass = "text-zinc-300";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="OpenMemory" width={26} height={26} />
          <span className="text-xl font-medium">OpenMemory</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/memories">
            <Button
              variant="outline"
              size="sm"
              className={`flex items-center gap-2 border-none ${
                isActive("/memories") ? activeClass : inactiveClass
              }`}
            >
              <HiMiniRectangleStack />
              Memories
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <CreateMemoryDialog 
            onMemoryCreated={() => {
              // Navigate to memories page if not already there
              if (pathname !== '/memories') {
                router.push('/memories?page=1&size=10');
              } else {
                // If already on memories page, just refresh
                window.location.reload();
              }
            }} 
          />
          <CreateUserDialog />
        </div>
      </div>
    </header>
  );
}
