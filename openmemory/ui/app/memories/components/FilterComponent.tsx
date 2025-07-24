"use client";

import { useEffect, useState } from "react";
import { Filter, X, ChevronDown, SortAsc, SortDesc } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { RootState } from "@/store/store";
import { useAppsApi } from "@/hooks/useAppsApi";
import { useFiltersApi } from "@/hooks/useFiltersApi";
import {
  setSelectedApps,
  setSelectedCategories,
  setSelectedUsers,
  setMetadataFilters,
  setShowArchived,
  clearFilters,
} from "@/store/filtersSlice";
import { useMemoriesApi } from "@/hooks/useMemoriesApi";
import { useUsersApi } from "@/hooks/useUsersApi";
import { Input } from "@/components/ui/input";

const columns = [
  {
    label: "Memory",
    value: "memory",
  },
  {
            label: "Client/Agent Name",
    value: "app_name",
  },
  {
    label: "Created On",
    value: "created_at",
  },
];

export default function FilterComponent() {
  const dispatch = useDispatch();
  const { fetchApps } = useAppsApi();
  const { fetchCategories, updateSort } = useFiltersApi();
  const { fetchMemories } = useMemoriesApi();
  const { fetchUsers, users } = useUsersApi();
  const [isOpen, setIsOpen] = useState(false);
  const [tempSelectedApps, setTempSelectedApps] = useState<string[]>([]);
  const [tempSelectedCategories, setTempSelectedCategories] = useState<string[]>([]);
  const [tempSelectedUsers, setTempSelectedUsers] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [metadataKey, setMetadataKey] = useState("");
  const [metadataValue, setMetadataValue] = useState("");
  const [metadataFilters, setMetadataFilters] = useState<Record<string, string>>({});

  const apps = useSelector((state: RootState) => state.apps.apps);
  const categories = useSelector(
    (state: RootState) => state.filters.categories.items
  );
  const filters = useSelector((state: RootState) => state.filters.apps);

  useEffect(() => {
    fetchApps({ page_size: 100 });
    fetchCategories();
    fetchUsers();
  }, [fetchApps, fetchCategories, fetchUsers]);

  useEffect(() => {
    // Initialize temporary selections with current active filters when dialog opens
    if (isOpen) {
      setTempSelectedApps(filters.selectedApps);
      setTempSelectedCategories(filters.selectedCategories);
      setTempSelectedUsers(filters.selectedUsers);
      setShowArchived(filters.showArchived || false);
      setMetadataFilters(filters.metadataFilters || {});
      setMetadataKey("");
      setMetadataValue("");
      
      // Refresh all filter data when dialog opens
      fetchApps({ page_size: 100 });
      fetchCategories();
      fetchUsers();
    }
  }, [isOpen, filters, fetchApps, fetchCategories, fetchUsers]);

  const handleClearFilters = async () => {
    setTempSelectedApps([]);
    setTempSelectedCategories([]);
    setTempSelectedUsers([]);
    setShowArchived(false);
    setMetadataFilters({});
    setMetadataKey("");
    setMetadataValue("");
    dispatch(clearFilters());
    await fetchMemories();
  };

  const handleApplyFilters = async () => {
    // Close dialog immediately
    setIsOpen(false);
    
    try {
      // Get category IDs for selected category names
      const selectedCategoryIds = categories
        .filter((cat) => tempSelectedCategories.includes(cat.name))
        .map((cat) => cat.id);

      // Get app IDs for selected app names
      const selectedAppIds = apps
        .filter((app) => tempSelectedApps.includes(app.id))
        .map((app) => app.id);

      // Update the global state with temporary selections
      dispatch(setSelectedApps(tempSelectedApps));
      dispatch(setSelectedCategories(tempSelectedCategories));
      dispatch(setSelectedUsers(tempSelectedUsers));
      dispatch(setShowArchived(showArchived));
      dispatch(setMetadataFilters(metadataFilters));

      try {
        await fetchMemories(undefined, 1, 10, {
          apps: selectedAppIds,
          categories: selectedCategoryIds,
          users: tempSelectedUsers,
          metadata: metadataFilters,
          sortColumn: filters.sortColumn,
          sortDirection: filters.sortDirection,
          showArchived: showArchived,
        });
      } catch (fetchError) {
        console.error("fetchMemories failed with error:", fetchError);
      }
    } catch (error) {
      console.error("Failed to apply filters:", error);
    }
  };

  const handleDialogChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset temporary selections to active filters when dialog closes without applying
      setTempSelectedApps(filters.selectedApps);
      setTempSelectedCategories(filters.selectedCategories);
      setTempSelectedUsers(filters.selectedUsers);
      setShowArchived(filters.showArchived || false);
      setMetadataFilters(filters.metadataFilters || {});
      setMetadataKey("");
      setMetadataValue("");
    }
  };

  const hasActiveFilters =
    filters.selectedApps.length > 0 ||
    filters.selectedCategories.length > 0 ||
    filters.selectedUsers.length > 0 ||
    Object.keys(filters.metadataFilters || {}).length > 0 ||
    filters.showArchived;

  const hasTempFilters =
    tempSelectedApps.length > 0 ||
    tempSelectedCategories.length > 0 ||
    tempSelectedUsers.length > 0 ||
    Object.keys(metadataFilters).length > 0 ||
    showArchived;

  return (
    <div className="flex items-center gap-2">
      <Dialog open={isOpen} onOpenChange={handleDialogChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className={`h-9 px-4 border-zinc-700/50 bg-zinc-900 hover:bg-zinc-800 ${
              hasActiveFilters ? "border-primary" : ""
            }`}
          >
            <Filter
              className={`h-4 w-4 ${hasActiveFilters ? "text-primary" : ""}`}
            />
            Filter
            {hasActiveFilters && (
              <Badge className="ml-2 bg-primary hover:bg-primary/80 text-xs">
                {filters.selectedApps.length +
                  filters.selectedCategories.length +
                  filters.selectedUsers.length +
                  (filters.showArchived ? 1 : 0) +
                  Object.keys(filters.metadataFilters || {}).length}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] md:max-w-[700px] bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 flex justify-between items-center">
              <span>Filters</span>
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="apps" className="w-full mt-4">
            <TabsList className="grid grid-cols-5 bg-zinc-800 w-full h-auto p-1">
              <TabsTrigger
                value="apps"
                className="data-[state=active]:bg-zinc-700 text-xs sm:text-sm px-2 py-2"
              >
                <span className="hidden sm:inline">Clients/Agents</span>
                <span className="sm:hidden">Clients</span>
              </TabsTrigger>
              <TabsTrigger
                value="categories"
                className="data-[state=active]:bg-zinc-700 text-xs sm:text-sm px-2 py-2"
              >
                Categories
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="data-[state=active]:bg-zinc-700 text-xs sm:text-sm px-2 py-2"
              >
                Users
              </TabsTrigger>
              <TabsTrigger
                value="metadata"
                className="data-[state=active]:bg-zinc-700 text-xs sm:text-sm px-2 py-2"
              >
                Metadata
              </TabsTrigger>
              <TabsTrigger
                value="archived"
                className="data-[state=active]:bg-zinc-700 text-xs sm:text-sm px-2 py-2"
              >
                Archived
              </TabsTrigger>
            </TabsList>
            <TabsContent value="apps" className="mt-4 min-h-[200px]">
              <div className="space-y-3">
                {apps.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">No clients/agents found</p>
                ) : (
                  <>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all-apps"
                        checked={
                          apps.length > 0 && tempSelectedApps.length === apps.length
                        }
                        onCheckedChange={(checked) =>
                          toggleAllApps(checked as boolean)
                        }
                        className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <Label
                        htmlFor="select-all-apps"
                        className="text-sm font-normal text-zinc-300 cursor-pointer"
                      >
                        Select All
                      </Label>
                    </div>
                    {apps.map((app) => (
                      <div key={app.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`app-${app.id}`}
                          checked={tempSelectedApps.includes(app.id)}
                          onCheckedChange={() => toggleAppFilter(app.id)}
                          className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <Label
                          htmlFor={`app-${app.id}`}
                          className="text-sm font-normal text-zinc-300 cursor-pointer"
                        >
                          {app.name}
                        </Label>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </TabsContent>
            <TabsContent value="categories" className="mt-4 min-h-[200px]">
              <div className="space-y-3">
                {categories.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">No categories found</p>
                ) : (
                  <>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all-categories"
                        checked={
                          categories.length > 0 &&
                          tempSelectedCategories.length === categories.length
                        }
                        onCheckedChange={(checked) =>
                          toggleAllCategories(checked as boolean)
                        }
                        className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <Label
                        htmlFor="select-all-categories"
                        className="text-sm font-normal text-zinc-300 cursor-pointer"
                      >
                        Select All
                      </Label>
                    </div>
                    {categories.map((category) => (
                      <div
                        key={category.name}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`category-${category.name}`}
                          checked={tempSelectedCategories.includes(category.name)}
                          onCheckedChange={() =>
                            toggleCategoryFilter(category.name)
                          }
                          className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <Label
                          htmlFor={`category-${category.name}`}
                          className="text-sm font-normal text-zinc-300 cursor-pointer"
                        >
                          {category.name}
                        </Label>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </TabsContent>
            <TabsContent value="users" className="mt-4 min-h-[200px]">
              <div className="space-y-3">
                {users.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">No users found</p>
                ) : (
                  <>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="select-all-users"
                        checked={
                          users.length > 0 &&
                          tempSelectedUsers.length === users.length
                        }
                        onCheckedChange={(checked) =>
                          toggleAllUsers(checked as boolean)
                        }
                        className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <Label
                        htmlFor="select-all-users"
                        className="text-sm font-normal text-zinc-300 cursor-pointer"
                      >
                        Select All
                      </Label>
                    </div>
                    {users.map((user) => (
                      <div key={user.user_id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`user-${user.user_id}`}
                          checked={tempSelectedUsers.includes(user.user_id)}
                          onCheckedChange={() => toggleUserFilter(user.user_id)}
                          className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <Label
                          htmlFor={`user-${user.user_id}`}
                          className="text-sm font-normal text-zinc-300 cursor-pointer"
                        >
                          {user.user_id}
                        </Label>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </TabsContent>
            <TabsContent value="metadata" className="mt-4 min-h-[200px]">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="metadata-key" className="text-sm font-normal text-zinc-300">
                    Key:
                  </Label>
                  <Input
                    id="metadata-key"
                    value={metadataKey}
                    onChange={(e) => setMetadataKey(e.target.value)}
                    className="w-full bg-zinc-950 border-zinc-800"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="metadata-value" className="text-sm font-normal text-zinc-300">
                    Value:
                  </Label>
                  <Input
                    id="metadata-value"
                    value={metadataValue}
                    onChange={(e) => setMetadataValue(e.target.value)}
                    className="w-full bg-zinc-950 border-zinc-800"
                  />
                </div>
                <Button
                  onClick={() => {
                    if (metadataKey.trim() && metadataValue.trim()) {
                      const newMetadata = { ...metadataFilters };
                      newMetadata[metadataKey.trim()] = metadataValue.trim();
                      setMetadataFilters(newMetadata);
                      setMetadataKey("");
                      setMetadataValue("");
                    }
                  }}
                  className="w-full"
                  disabled={!metadataKey.trim() || !metadataValue.trim()}
                >
                  Add Metadata Filter
                </Button>
                <div className="mt-4 space-y-2">
                  {Object.entries(metadataFilters).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between bg-zinc-800/50 p-2 rounded">
                      <span className="text-sm font-normal text-zinc-300">{key}: {value}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newMetadata = { ...metadataFilters };
                          delete newMetadata[key];
                          setMetadataFilters(newMetadata);
                        }}
                      >
                        <X className="h-4 w-4 text-zinc-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="archived" className="mt-4 min-h-[200px]">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-archived"
                  checked={showArchived}
                  onCheckedChange={(checked) => setShowArchived(checked as boolean)}
                  className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label htmlFor="show-archived" className="text-sm font-normal text-zinc-300 cursor-pointer">
                  Show Archived
                </Label>
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleClearFilters}>
              Clear All
            </Button>
            <Button onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}