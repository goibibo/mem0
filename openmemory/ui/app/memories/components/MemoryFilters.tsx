"use client";
import { Archive, Pause, Play, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FiTrash2 } from "react-icons/fi";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store/store";
import { clearSelection } from "@/store/memoriesSlice";
import { useMemoriesApi } from "@/hooks/useMemoriesApi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter, useSearchParams } from "next/navigation";
import { debounce } from "lodash";
import { useEffect, useRef } from "react";
import FilterComponent from "./FilterComponent";
import { clearFilters } from "@/store/filtersSlice";
import { SearchMemoriesDialog } from "./SearchMemoriesDialog";

export function MemoryFilters() {
  const dispatch = useDispatch();
  const selectedMemoryIds = useSelector(
    (state: RootState) => state.memories.selectedMemoryIds
  );
  const { deleteMemories, updateMemoryState, fetchMemories } = useMemoriesApi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFilters = useSelector((state: RootState) => state.filters.apps);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDeleteSelected = async () => {
    try {
      await deleteMemories(selectedMemoryIds);
      dispatch(clearSelection());
    } catch (error) {
      console.error("Failed to delete memories:", error);
    }
  };

  const handleArchiveSelected = async () => {
    try {
      await updateMemoryState(selectedMemoryIds, "archived");
    } catch (error) {
      console.error("Failed to archive memories:", error);
    }
  };

  const handlePauseSelected = async () => {
    try {
      await updateMemoryState(selectedMemoryIds, "paused");
    } catch (error) {
      console.error("Failed to pause memories:", error);
    }
  };

  const handleResumeSelected = async () => {
    try {
      await updateMemoryState(selectedMemoryIds, "active");
    } catch (error) {
      console.error("Failed to resume memories:", error);
    }
  };

  // Debounced search for filtering UI results
  const handleSearch = debounce(async (query: string) => {
    router.push(`/memories?search=${query}`);
  }, 500);

  useEffect(() => {
    // if the url has a search param, set the input value to the search param
    if (searchParams.get("search")) {
      if (inputRef.current) {
        inputRef.current.value = searchParams.get("search") || "";
        inputRef.current.focus();
      }
    }
  }, [searchParams]);

  const handleClearAllFilters = async () => {
    dispatch(clearFilters());
    // Clear search param as well
    router.push('/memories');
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    await fetchMemories(); // Fetch memories without any filters
  };

  const hasActiveFilters =
    activeFilters.selectedApps.length > 0 ||
    activeFilters.selectedCategories.length > 0 ||
    activeFilters.selectedUsers.length > 0 ||
    Object.keys(activeFilters.metadataFilters || {}).length > 0 ||
    activeFilters.showArchived ||
    searchParams.get("search");

  return (
    <div className="flex flex-col gap-4 mb-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-[500px]">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            ref={inputRef}
            placeholder="Filter memories..."
            className="pl-8 bg-zinc-950 border-zinc-800"
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <SearchMemoriesDialog />
          <FilterComponent />
          {hasActiveFilters && (
            <Button
              variant="outline"
              className="bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              onClick={handleClearAllFilters}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {selectedMemoryIds.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <span className="text-sm text-zinc-400">
            {selectedMemoryIds.length} selected
          </span>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-zinc-400 hover:text-zinc-300"
                >
                  <Pause className="h-4 w-4 mr-1" />
                  State
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem
                  onClick={handlePauseSelected}
                  className="cursor-pointer"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleResumeSelected}
                  className="cursor-pointer"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleArchiveSelected}
                  className="cursor-pointer"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteSelected}
              className="text-red-400 hover:text-red-300"
            >
              <FiTrash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
