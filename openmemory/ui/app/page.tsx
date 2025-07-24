"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to memories page since dashboard is removed
    router.push('/memories');
  }, [router]);
  
  return null;
}
