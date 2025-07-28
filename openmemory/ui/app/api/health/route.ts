import { NextResponse } from 'next/server';

export async function GET() {
  /**
   * Health check endpoint to verify the UI server is running.
   * 
   * @returns {Promise<NextResponse>} A JSON response with status "healthy"
   */
  return NextResponse.json(
    { status: "healthy" },
    { status: 200 }
  );
} 