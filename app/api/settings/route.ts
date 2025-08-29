import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Only return whether the key exists, not the actual key value for security
    const hasEnvFalKey = !!process.env.FAL_KEY
    
    return NextResponse.json({
      hasEnvFalKey,
      // Don't send the actual key value to the client for security reasons
    })
  } catch (error) {
    console.error("[v0] Error reading settings:", error)
    return NextResponse.json({ error: "Failed to read settings" }, { status: 500 })
  }
}
