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
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { GoPlus } from "react-icons/go";
import { Loader2, User } from "lucide-react";
import { useUsersApi } from "@/hooks/useUsersApi";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function CreateUserDialog() {
  const { createUser, isLoading, fetchUsers } = useUsersApi();
  const [open, setOpen] = useState(false);
  const userIdRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleCreateUser = async () => {
    const userId = userIdRef.current?.value.trim();
    const name = nameRef.current?.value.trim();
    const email = emailRef.current?.value.trim();

    console.log('Create user called with:', { userId, name, email });

    if (!userId) {
      toast.error("User ID is required");
      return;
    }

    try {
      console.log('Calling createUser API...');
      const result = await createUser({
        user_id: userId,
        name: name || undefined,
        email: email || undefined,
      });
      console.log('User created successfully:', result);
      
      // Show success message
      toast.success(`User "${userId}" created successfully`);
      
      // Clear the inputs
      if (userIdRef.current) userIdRef.current.value = '';
      if (nameRef.current) nameRef.current.value = '';
      if (emailRef.current) emailRef.current.value = '';
      
      // Close the dialog
      setOpen(false);
      
      // Navigate to memories page
      router.push('/memories');
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      handleCreateUser();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <GoPlus />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to the system
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          handleCreateUser();
        }}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="userId">User ID *</Label>
              <div className="relative">
                <User className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  ref={userIdRef}
                  id="userId"
                  placeholder="e.g., john_doe"
                  className="pl-8 bg-zinc-950 border-zinc-800"
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                ref={nameRef}
                id="name"
                placeholder="e.g., John Doe"
                className="bg-zinc-950 border-zinc-800"
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                ref={emailRef}
                id="email"
                type="email"
                placeholder="e.g., john@example.com"
                className="bg-zinc-950 border-zinc-800"
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button"
              variant="outline" 
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create User"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 