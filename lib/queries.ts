import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { conversationDB, type Conversation } from "./indexeddb"

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
    queryFn: () => {
      const falKey = localStorage.getItem("falKey") || ""
      const selectedModel = localStorage.getItem("selectedModel") || "Qwen Edit"
      return { falKey, selectedModel }
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
    queryFn: async () => {
      await conversationDB.init()
      return conversationDB.getAllConversations()
    },
  })
}

// Current conversation hook
export function useCurrentConversation(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.conversation(conversationId || ""),
    queryFn: async () => {
      if (!conversationId) return null
      return conversationDB.getConversation(conversationId)
    },
    enabled: !!conversationId,
  })
}

// Mutation hooks
export function useSaveConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversation: Conversation) => {
      await conversationDB.saveConversation(conversation)
      return conversation
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
      await conversationDB.deleteConversation(conversationId)
      return conversationId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
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
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ falKey, prompt, imageUrl, model }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate image")
      }

      return response.json()
    },
  })
}
