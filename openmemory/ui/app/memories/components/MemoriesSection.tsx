"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { useMemoriesApi } from "@/hooks/useMemoriesApi";
import { MemoryTable } from "./MemoryTable";
import { MemoryTableSkeleton } from "@/skeleton/MemoryTableSkeleton";
import { MemoryPagination } from "./MemoryPagination";
import { PageSizeSelector } from "./PageSizeSelector";

export function MemoriesSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchMemories } = useMemoriesApi();
  const filters = useSelector((state: RootState) => state.filters.apps);
  const categories = useSelector((state: RootState) => state.filters.categories.items);
  const semanticSearch = useSelector((state: RootState) => state.memories.semanticSearch);
  
  const [memories, setMemories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const page = parseInt(searchParams.get("page") || "1");
    const size = parseInt(searchParams.get("size") || "10");
    setCurrentPage(page);
    setItemsPerPage(size);
  }, [searchParams]);

  const loadMemories = async () => {
    // Don't load memories if semantic search is active - let semantic search results stay
    if (semanticSearch.active) {
      console.log("Semantic search is active, skipping loadMemories to preserve search results");
      return;
    }

    setIsLoading(true);
    try {
      const searchQuery = searchParams.get("search") || "";
      
      // Get category IDs for selected category names
      const selectedCategoryIds = categories
        .filter((cat: any) => filters.selectedCategories.includes(cat.name))
        .map((cat: any) => cat.id);
      
      const result = await fetchMemories(
        searchQuery,
        currentPage,
        itemsPerPage,
        {
          app_names: filters.selectedAppNames, // Use app names from Redux state
          categories: selectedCategoryIds,
          users: filters.selectedUsers,
          metadata: filters.metadataFilters,
          sortColumn: filters.sortColumn,
          sortDirection: filters.sortDirection,
          showArchived: filters.showArchived
        }
      );
      setMemories(result.memories);
      setTotalItems(result.total);
      setTotalPages(result.pages);
    } catch (error) {
      console.error("Failed to fetch memories:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadMemories();
  }, [currentPage, itemsPerPage, searchParams, filters, semanticSearch.active]);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    params.set("size", itemsPerPage.toString());
    router.push(`?${params.toString()}`);
  };

  const handlePageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1"); // Reset to page 1 when changing page size
    params.set("size", size.toString());
    router.push(`?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="w-full bg-transparent">
        <MemoryTableSkeleton />
        <div className="flex items-center justify-between mt-4">
          <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse" />
          <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
          <div className="h-8 w-32 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-transparent">
      <div>
        {memories.length > 0 ? (
          <>
            <MemoryTable />
            <div className="flex items-center justify-between mt-4">
              <PageSizeSelector
                pageSize={itemsPerPage}
                onPageSizeChange={handlePageSizeChange}
              />
              <div className="text-sm text-zinc-500 mr-2">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, totalItems)} of{" "}
                {totalItems} memories
              </div>
              <MemoryPagination
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={handlePageChange}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-zinc-800 p-3 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-zinc-400"
              >
                <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"></path>
                <path d="M16 2v6h6"></path>
                <path d="M12 18v-6"></path>
                <path d="M8 15h8"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-zinc-200 mb-2">No memories found</h3>
            <p className="text-zinc-400">
              {searchParams.get("search") 
                ? `No memories match your search "${searchParams.get("search")}"`
                : "No memories have been created yet."
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
