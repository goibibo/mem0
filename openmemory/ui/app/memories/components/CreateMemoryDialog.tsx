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
import { useState, useRef, useEffect } from "react";
import { GoPlus } from "react-icons/go";
import { Loader2 } from "lucide-react";
import { useMemoriesApi } from "@/hooks/useMemoriesApi";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { useUsersApi } from "@/hooks/useUsersApi";

interface CreateMemoryDialogProps {
  onMemoryCreated?: () => void;
}

export function CreateMemoryDialog({ onMemoryCreated }: CreateMemoryDialogProps) {
  const { createMemory, isLoading } = useMemoriesApi();
  const { fetchUsers, users, isLoading: isLoadingUsers } = useUsersApi();
  const currentUserId = useSelector((state: RootState) => state.profile.userId);
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(currentUserId);
  const [metadataText, setMetadataText] = useState("");
  const [metadataError, setMetadataError] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);
  
  // Refresh users when dialog opens
  useEffect(() => {
    if (open) {
      fetchUsers().then(() => {
        console.log('CreateMemoryDialog: Users fetched:', users);
      });
    }
  }, [open, fetchUsers]);
  
  // Monitor users array changes
  useEffect(() => {
    console.log('CreateMemoryDialog: Users array updated:', users);
  }, [users]);

  const handleCreateMemory = async (text: string) => {
    try {
      // Parse metadata if provided
      let metadata = null;
      if (metadataText.trim()) {
        try {
          metadata = JSON.parse(metadataText);
          setMetadataError("");
        } catch (e) {
          setMetadataError("Invalid JSON format");
          return;
        }
      }
      
      await createMemory(text, selectedUserId, metadata);
      toast.success(`Memory created successfully for user: ${selectedUserId}`);
      // close the dialog
      setOpen(false);
      // Clear the text area and metadata
      if (textRef.current) {
        textRef.current.value = "";
      }
      setMetadataText("");
      setMetadataError("");
      
      // Call the callback to refresh memories in parent component
      if (onMemoryCreated) {
        onMemoryCreated();
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Reset user ID when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setSelectedUserId(currentUserId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <GoPlus />
          Create Memory
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle>Create New Memory</DialogTitle>
          <DialogDescription>
            Add a new memory to your OpenMemory instance
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="userId">User ID</Label>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={isLoadingUsers}
            >
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                {isLoadingUsers ? (
                  <SelectItem value="loading" disabled>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    Loading users...
                  </SelectItem>
                ) : users.length === 0 ? (
                  <SelectItem value="no-users" disabled>
                    No users found
                  </SelectItem>
                ) : (
                  users.map((user) => (
                    <SelectItem
                      key={user.id}
                      value={user.user_id}
                      className="hover:bg-zinc-800"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>
                          {user.user_id}
                          {user.name && user.name !== user.user_id && (
                            <span className="text-zinc-500 ml-1">({user.name})</span>
                          )}
                        </span>
                        {user.total_memories > 0 && (
                          <span className="text-xs text-zinc-500 ml-2">
                            {user.total_memories} memories
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="memory">Memory</Label>
            <Textarea
              ref={textRef}
              id="memory"
              placeholder="e.g., Lives in San Francisco"
              className="bg-zinc-950 border-zinc-800 min-h-[150px]"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="metadata">Custom Metadata (Optional)</Label>
            <Textarea
              id="metadata"
              value={metadataText}
              onChange={(e) => {
                setMetadataText(e.target.value);
                setMetadataError("");
              }}
              placeholder='{"category": "personal", "topic": "location", "importance": "high"}'
              className={`bg-zinc-950 border-zinc-800 min-h-[80px] font-mono text-sm ${
                metadataError ? "border-red-500" : ""
              }`}
            />
            {metadataError && (
              <p className="text-sm text-red-500">{metadataError}</p>
            )}
            <p className="text-xs text-zinc-500">
              Enter valid JSON format. This metadata can be used for filtering and categorization.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={isLoading || !selectedUserId}
            onClick={() => handleCreateMemory(textRef?.current?.value || "")}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              "Save Memory"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
