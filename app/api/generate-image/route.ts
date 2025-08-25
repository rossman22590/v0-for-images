import { type NextRequest, NextResponse } from "next/server"
import { fal } from "@fal-ai/client"

export async function POST(request: NextRequest) {
  try {
    const { falKey, prompt, imageUrl, model } = await request.json()

    console.log("[v0] API Request received:", {
      hasFalKey: !!falKey,
      prompt: prompt?.substring(0, 50) + "...",
      imageUrl: imageUrl?.substring(0, 50) + "...",
      model: model,
    })

    if (!falKey || !prompt || !imageUrl) {
      console.log("[v0] Missing required fields:", { falKey: !!falKey, prompt: !!prompt, imageUrl: !!imageUrl })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    fal.config({
      credentials: falKey,
    })

    const modelEndpoints = {
      "Qwen Edit": "fal-ai/qwen-image-edit",
      Seeedit: "fal-ai/bytedance/seededit/v3/edit-image",
      "Kontext Pro Edit": "fal-ai/flux-pro/kontext",
    }

    const endpoint = modelEndpoints[model] || "fal-ai/flux-pro/kontext"
    console.log("[v0] Using model endpoint:", endpoint)

    let input = {
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
    return NextResponse.json({ error: `Failed to generate image: ${error.message}` }, { status: 500 })
  }
}
