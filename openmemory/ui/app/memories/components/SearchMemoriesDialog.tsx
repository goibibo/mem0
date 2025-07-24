"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Search, Loader2, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useUsersApi } from "@/hooks/useUsersApi";
import { useAppsApi } from "@/hooks/useAppsApi";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { setMemoriesSuccess } from "@/store/memoriesSlice";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RootState } from "@/store/store";
import { setSemanticSearch, clearSemanticSearch } from "@/store/memoriesSlice";

interface SearchMemoriesDialogProps {
  onSearchComplete?: () => void;
}

export function SearchMemoriesDialog({ onSearchComplete }: SearchMemoriesDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [threshold, setThreshold] = useState<number>(0);
  const [limit, setLimit] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(false);
  const [selectAllUsers, setSelectAllUsers] = useState(true);
  const [selectAllApps, setSelectAllApps] = useState(true);
  
  const { fetchUsers, users } = useUsersApi();
  const { fetchApps } = useAppsApi();
  const apps = useSelector((state: RootState) => state.apps.apps);
  const dispatch = useDispatch();
  const semanticSearch = useSelector((state: RootState) => state.memories.semanticSearch);
  
  const URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8765";

  useEffect(() => {
    if (open) {
      fetchUsers();
      fetchApps({ page_size: 100 });
    }
  }, [open, fetchUsers, fetchApps]);

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setIsLoading(true);
    try {
      const requestBody: any = {
        query,
        limit,
        threshold,
        include_metadata: true
      };

      // Only include user_ids if specific users are selected
      if (!selectAllUsers && selectedUsers.length > 0) {
        requestBody.user_ids = selectedUsers;
      }

      // Only include app_ids if specific apps are selected
      if (!selectAllApps && selectedApps.length > 0) {
        requestBody.app_ids = selectedApps;
      }

      console.log("Searching memories with:", requestBody);

      const response = await axios.post(
        `${URL}/api/v1/memories/search`,
        requestBody
      );

      const memories = response.data.map((item: any) => ({
        id: item.id,
        memory: item.content,
        created_at: new Date(item.created_at).getTime(),
        state: item.state,
        metadata: item.metadata_,
        categories: item.categories,
        app_name: item.app_name,
        user_id: item.user_id
      }));

      dispatch(setMemoriesSuccess(memories));
      dispatch(setSemanticSearch({ query }));
      toast.success(`Found ${memories.length} memories`);
      setOpen(false);
      
      if (onSearchComplete) {
        onSearchComplete();
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error(error.response?.data?.detail || "Failed to search memories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setQuery("");
    setSelectedUsers([]);
    setSelectedApps([]);
    setThreshold(0);
    setLimit(10);
    setSelectAllUsers(true);
    setSelectAllApps(true);
  };

  const handleClearSearch = () => {
    dispatch(clearSemanticSearch());
    // Fetch all memories again
    const fetchMemories = async () => {
      try {
        const response = await axios.get(`${URL}/api/v1/memories`);
        const memories = response.data.map((item: any) => ({
          id: item.id,
          memory: item.content,
          created_at: new Date(item.created_at).getTime(),
          state: item.state,
          metadata: item.metadata_,
          categories: item.categories,
          app_name: item.app_name,
          user_id: item.user_id
        }));
        dispatch(setMemoriesSuccess(memories));
        toast.success('Cleared semantic search');
      } catch (error: any) {
        console.error("Error fetching memories:", error);
        toast.error("Failed to clear semantic search");
      }
    };
    fetchMemories();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant={semanticSearch.active ? "default" : "outline"}
            className={`h-9 px-4 ${semanticSearch.active ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border-zinc-700/50 bg-zinc-900 hover:bg-zinc-800'}`}
          >
            <Search className="h-4 w-4 mr-2" />
            Semantic Search
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Search Memories</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Use natural language to search through memories with advanced filters.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="query">Search Query</Label>
              <Textarea
                id="query"
                placeholder="e.g., What are the user's favorite foods and dietary preferences?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-zinc-950 border-zinc-800 min-h-[80px]"
              />
            </div>
            
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Users</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all-users"
                    checked={selectAllUsers}
                    onCheckedChange={(checked) => {
                      setSelectAllUsers(checked as boolean);
                      if (checked) {
                        setSelectedUsers([]);
                      }
                    }}
                  />
                  <label
                    htmlFor="select-all-users"
                    className="text-sm font-normal text-zinc-400 cursor-pointer"
                  >
                    Search all users
                  </label>
                </div>
              </div>
              {!selectAllUsers && (
                <div className="space-y-2">
                  <div className="border border-zinc-800 rounded-md p-2 bg-zinc-950 max-h-[120px] overflow-y-auto">
                    {users.length === 0 ? (
                      <p className="text-sm text-zinc-500">Loading users...</p>
                    ) : (
                      users.map((user) => (
                        <div key={user.id} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={`user-${user.id}`}
                            checked={selectedUsers.includes(user.user_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedUsers([...selectedUsers, user.user_id]);
                              } else {
                                setSelectedUsers(selectedUsers.filter(id => id !== user.user_id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`user-${user.id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {user.user_id}
                            {user.name && user.name !== user.user_id && (
                              <span className="text-zinc-500 ml-1">({user.name})</span>
                            )}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedUsers.map((userId) => (
                        <Badge key={userId} variant="secondary" className="text-xs">
                          {userId}
                          <X
                            className="ml-1 h-3 w-3 cursor-pointer"
                            onClick={() => setSelectedUsers(selectedUsers.filter(id => id !== userId))}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Clients/Agents</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all-apps"
                    checked={selectAllApps}
                    onCheckedChange={(checked) => {
                      setSelectAllApps(checked as boolean);
                      if (checked) {
                        setSelectedApps([]);
                      }
                    }}
                  />
                  <label
                    htmlFor="select-all-apps"
                    className="text-sm font-normal text-zinc-400 cursor-pointer"
                  >
                    Search all clients/agents
                  </label>
                </div>
              </div>
              {!selectAllApps && (
                <div className="space-y-2">
                  <div className="border border-zinc-800 rounded-md p-2 bg-zinc-950 max-h-[120px] overflow-y-auto">
                    {apps.length === 0 ? (
                      <p className="text-sm text-zinc-500">Loading apps...</p>
                    ) : (
                      apps.map((app) => (
                        <div key={app.id} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={`app-${app.id}`}
                            checked={selectedApps.includes(app.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedApps([...selectedApps, app.id]);
                              } else {
                                setSelectedApps(selectedApps.filter(id => id !== app.id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`app-${app.id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {app.name}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedApps.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedApps.map((appId) => {
                        const app = apps.find(a => a.id === appId);
                        return (
                          <Badge key={appId} variant="secondary" className="text-xs">
                            {app?.name || appId}
                            <X
                              className="ml-1 h-3 w-3 cursor-pointer"
                              onClick={() => setSelectedApps(selectedApps.filter(id => id !== appId))}
                            />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="threshold">Relevance Threshold</Label>
                <Input
                  id="threshold"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="bg-zinc-950 border-zinc-800"
                />
                <p className="text-xs text-zinc-500">0 = all results, 1 = exact match</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="limit">Max Results</Label>
                <Input
                  id="limit"
                  type="number"
                  min="1"
                  max="100"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value))}
                  className="bg-zinc-950 border-zinc-800"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleReset}
              className="bg-zinc-800 hover:bg-zinc-700"
            >
              Reset
            </Button>
            <Button
              onClick={handleSearch}
              disabled={isLoading || !query.trim()}
              className="bg-primary hover:bg-primary/80"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {semanticSearch.active && (
        <div className="flex items-center space-x-2 ml-2">
          <Badge variant="secondary" className="bg-primary/20 text-primary-foreground">
            {semanticSearch.query}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSearch}
            className="h-6 px-2 text-zinc-400 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
} 