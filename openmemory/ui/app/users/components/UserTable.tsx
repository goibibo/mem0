"use client";

import { User as UserIcon, Mail, Calendar } from "lucide-react";
import { HiMiniRectangleStack } from "react-icons/hi2";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/helpers";
import { User } from "@/hooks/useUsersApi";

interface UserTableProps {
  users: User[];
}

export function UserTable({ users }: UserTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-zinc-800 hover:bg-zinc-800">
            <TableHead className="border-zinc-700">
              <div className="flex items-center">
                <UserIcon className="mr-2 h-4 w-4" />
                User ID
              </div>
            </TableHead>
            <TableHead className="border-zinc-700">
              <div className="flex items-center">
                <UserIcon className="mr-2 h-4 w-4" />
                Name
              </div>
            </TableHead>
            <TableHead className="border-zinc-700">
              <div className="flex items-center">
                <Mail className="mr-2 h-4 w-4" />
                Email
              </div>
            </TableHead>
            <TableHead className="border-zinc-700">
              <div className="flex items-center justify-center">
                <HiMiniRectangleStack className="mr-2 h-4 w-4" />
                Total Memories
              </div>
            </TableHead>
            <TableHead className="border-zinc-700">
              <div className="flex items-center justify-center">
                <Calendar className="mr-2 h-4 w-4" />
                Created On
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className="hover:bg-zinc-900/50">
              <TableCell className="font-medium">{user.user_id}</TableCell>
              <TableCell>{user.name || "-"}</TableCell>
              <TableCell>{user.email || "-"}</TableCell>
              <TableCell className="text-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300">
                  {user.total_memories}
                </span>
              </TableCell>
              <TableCell className="text-center">
                {formatDate(user.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 