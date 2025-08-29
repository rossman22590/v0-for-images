import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// Types
export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  generatedImages: GeneratedImage[]
  createdAt: number
  updatedAt: number
}

export interface ChatMessage {
  id: string
  type: "user" | "assistant"
  content: string
  image?: string
  generatedImage?: GeneratedImage
  timestamp: number
}

export interface GeneratedImage {
  id: string
  url: string
  prompt: string
  timestamp: number
  model: string
}

// Query keys
export const queryKeys = {
  conversations: ["conversations"] as const,
  conversation: (id: string) => ["conversation", id] as const,
  settings: ["settings"] as const,
}

// Settings hook
export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => {
      const localFalKey = localStorage.getItem("falKey") || ""
      const selectedModel = localStorage.getItem("selectedModel") || "fal-ai/flux-pro/kontext"
      
      // Check if there's an environment FAL key available on the server
      let hasEnvFalKey = false
      try {
        const response = await fetch("/api/settings")
        if (response.ok) {
          const data = await response.json()
          hasEnvFalKey = data.hasEnvFalKey
        }
      } catch (error) {
        console.log("[v0] Could not fetch server settings:", error)
      }
      
      // Use localStorage key if available, otherwise use a placeholder to indicate env key exists
      // The actual env key will be used on the server side
      const falKey = localFalKey || (hasEnvFalKey ? "using_env_key" : "")
      
      return { 
        falKey, 
        selectedModel,
        hasEnvFalKey,
        localFalKey 
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ falKey, selectedModel }: { falKey?: string; selectedModel?: string }) => {
      if (falKey !== undefined) localStorage.setItem("falKey", falKey)
      if (selectedModel !== undefined) localStorage.setItem("selectedModel", selectedModel)
      return Promise.resolve({ falKey, selectedModel })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings })
    },
  })
}

// Conversations hook
export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => {
      try {
        const conversations = localStorage.getItem("conversations")
        return conversations ? JSON.parse(conversations) : []
      } catch (error) {
        console.error("Error reading conversations from localStorage:", error)
        return []
      }
    },
  })
}

// Current conversation hook
export function useCurrentConversation(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.conversation(conversationId || ""),
    queryFn: () => {
      if (!conversationId) return null
      try {
        const conversations = localStorage.getItem("conversations")
        if (!conversations) return null
        const allConversations = JSON.parse(conversations)
        return allConversations.find((conv: Conversation) => conv.id === conversationId) || null
      } catch (error) {
        console.error("Error reading conversation from localStorage:", error)
        return null
      }
    },
    enabled: !!conversationId,
  })
}

// Mutation hooks
export function useSaveConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversation: Conversation) => {
      try {
        const conversations = localStorage.getItem("conversations")
        const allConversations = conversations ? JSON.parse(conversations) : []
        
        const existingIndex = allConversations.findIndex((conv: Conversation) => conv.id === conversation.id)
        if (existingIndex >= 0) {
          allConversations[existingIndex] = conversation
        } else {
          allConversations.push(conversation)
        }
        
        localStorage.setItem("conversations", JSON.stringify(allConversations))
        return conversation
      } catch (error) {
        console.error("Error saving conversation to localStorage:", error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversationId: string) => {
      try {
        console.log("[v0] Deleting conversation from localStorage:", conversationId)
        const conversations = localStorage.getItem("conversations")
        if (conversations) {
          const allConversations = JSON.parse(conversations)
          const filteredConversations = allConversations.filter((conv: Conversation) => conv.id !== conversationId)
          localStorage.setItem("conversations", JSON.stringify(filteredConversations))
        }
        console.log("[v0] Successfully deleted from localStorage:", conversationId)
        return conversationId
      } catch (error) {
        console.error("Error deleting conversation from localStorage:", error)
        throw error
      }
    },
    onSuccess: (conversationId) => {
      console.log("[v0] Invalidating queries after delete:", conversationId)
      queryClient.removeQueries({ queryKey: queryKeys.conversation(conversationId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
      // Force immediate cache update
      queryClient.setQueryData(queryKeys.conversations, (oldData: unknown) => {
        const conversations = oldData as Conversation[] | undefined
        if (!conversations) return []
        return conversations.filter((conv) => conv.id !== conversationId)
      })
    },
    onError: (error) => {
      console.error("[v0] Delete conversation mutation failed:", error)
    },
  })
}

export function useGenerateImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      falKey,
      prompt,
      imageUrl,
      model,
    }: {
      falKey: string
      prompt: string
      imageUrl: string
      model: string
    }) => {
      // Don't send the placeholder "using_env_key" string - let the server use the env variable
      const requestBody = {
        prompt,
        imageUrl,
        model,
        // Only include falKey if it's a real key from localStorage, not the env placeholder
        ...(falKey && falKey !== "using_env_key" ? { falKey } : {})
      }
      
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 401 && errorData.isAuthError) {
          throw new Error(errorData.error || "Authentication failed. Please check your FAL API key.")
        }
        throw new Error(errorData.error || "Failed to generate image")
      }

      return response.json()
    },
  })
}
