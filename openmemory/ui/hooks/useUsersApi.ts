import { useState, useCallback } from 'react';
import axios from 'axios';

export interface User {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  total_memories: number;
  created_at: string;
}

export interface UsersResponse {
  total: number;
  page: number;
  page_size: number;
  users: User[];
}

interface CreateUserData {
  user_id: string;
  name?: string;
  email?: string;
}

export const useUsersApi = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  
  const URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8765";
  
  const fetchUsers = useCallback(async (): Promise<User[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get<UsersResponse>(
        `${URL}/api/v1/users/?page=1&page_size=100`
      );
      
      setUsers(response.data.users);
      setIsLoading(false);
      return response.data.users;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch users';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  }, [URL]);
  
  const createUser = useCallback(async (userData: CreateUserData): Promise<User> => {
    setIsLoading(true);
    setError(null);
    
    console.log('useUsersApi: Creating user with data:', userData);
    console.log('useUsersApi: API URL:', `${URL}/api/v1/users/`);
    
    try {
      const response = await axios.post<User>(
        `${URL}/api/v1/users/`,
        userData
      );
      
      console.log('useUsersApi: User created, response:', response.data);
      
      setIsLoading(false);
      // Refresh users list after creating
      await fetchUsers();
      return response.data;
    } catch (err: any) {
      console.error('useUsersApi: Error creating user:', err);
      console.error('useUsersApi: Error response:', err.response);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create user';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  }, [URL, fetchUsers]);
  
  return {
    fetchUsers,
    createUser,
    users,
    isLoading,
    error
  };
}; 