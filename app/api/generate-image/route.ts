import { type NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"

export async function POST(request: NextRequest) {
  try {
    const { prompt, imageUrl, model, falKey: requestFalKey } = await request.json()
    // Try to get FAL key from request body first, then fall back to environment variable
    // Trim whitespace from environment variable to handle any formatting issues
    const envFalKey = process.env.FAL_KEY?.trim()
    const falKey = requestFalKey || envFalKey

    console.log("[v0] API Request received:", {
      hasFalKey: !!falKey,
      hasRequestFalKey: !!requestFalKey,
      hasEnvFalKey: !!process.env.FAL_KEY,
      falKeyLength: falKey?.length,
      requestFalKeyLength: requestFalKey?.length,
      envFalKeyLength: process.env.FAL_KEY?.length,
      falKeyStart: falKey?.substring(0, 10),
      requestFalKeyStart: requestFalKey?.substring(0, 10),
      envFalKeyStart: process.env.FAL_KEY?.substring(0, 10),
      prompt: prompt?.substring(0, 50) + "...",
      imageUrl: imageUrl?.substring(0, 50) + "...",
      model: model,
    })

    if (!falKey || !prompt || !imageUrl) {
      console.log("[v0] Missing required fields:", { falKey: !!falKey, prompt: !!prompt, imageUrl: !!imageUrl })
      return NextResponse.json({ 
        error: "Missing required fields. Please ensure you have set your FAL API key in settings." 
      }, { status: 400 })
    }

    fal.config({
      credentials: falKey,
    })

    const modelEndpoints: Record<string, string> = {
      "Qwen Edit": "fal-ai/qwen-image-edit",
      Seeedit: "fal-ai/bytedance/seededit/v3/edit-image",
      "Kontext Pro Edit": "fal-ai/flux-pro/kontext",
    }

    const endpoint = modelEndpoints[model as string] || "fal-ai/flux-pro/kontext"
    console.log("[v0] Using model endpoint:", endpoint)

    let input: any = {
      image_url: imageUrl,
      prompt: prompt,
    }

    // Add model-specific parameters
    if (model === "Qwen Edit") {
      input = {
        ...input,
        strength: 0.8,
        num_inference_steps: 28,
        guidance_scale: 3.5,
      }
    } else if (model === "Seeedit") {
      input = {
        ...input,
        strength: 0.75,
        num_inference_steps: 20,
      }
    } else if (model === "Kontext Pro Edit") {
      input = {
        ...input,
        strength: 0.85,
        num_inference_steps: 30,
        guidance_scale: 4.0,
      }
    }

    console.log("[v0] Making FAL API request using fal-js client with model:", model)

    const result = await fal.subscribe(endpoint, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log("[v0] FAL processing:", update.logs?.map((log) => log.message).join(", "))
        }
      },
    })

    console.log("[v0] FAL API success, received result:", {
      hasImages: !!result.data.images,
      imageCount: result.data.images?.length || 0,
      requestId: result.requestId,
      model: model,
    })

    return NextResponse.json({
      imageUrl: result.data.images?.[0]?.url || "/placeholder.svg?height=512&width=512",
      model: model,
    })
  } catch (error) {
    console.error("[v0] Error generating image:", error)
    
    // Check if it's an API authentication error
    if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
      console.error("[v0] Authentication failed - FAL API key may be invalid or expired")
      return NextResponse.json({ 
        error: "Authentication failed. Please check your FAL API key in settings or .env.local file. Visit https://fal.ai/dashboard/keys to verify your key is valid.",
        isAuthError: true
      }, { status: 401 })
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json({ error: `Failed to generate image: ${errorMessage}` }, { status: 500 })
  }
}
