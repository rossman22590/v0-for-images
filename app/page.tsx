"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Send, Settings, User, Bot, Paperclip, Eye, Plus, MessageSquare, Trash2 } from "lucide-react"
import type { Conversation, ChatMessage, GeneratedImage } from "@/lib/indexeddb"
import {
  useConversations,
  useCurrentConversation,
  useSettings,
  useUpdateSettings,
  useSaveConversation,
  useDeleteConversation,
  useGenerateImage,
} from "@/lib/queries"

export default function ImageEditor() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [hoveredVersion, setHoveredVersion] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<GeneratedImage | null>(null)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])
  const [localGeneratedImages, setLocalGeneratedImages] = useState<GeneratedImage[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: conversations = [] } = useConversations()
  const { data: currentConversation } = useCurrentConversation(currentConversationId)
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const saveConversation = useSaveConversation()
  const deleteConversation = useDeleteConversation()
  const generateImageMutation = useGenerateImage()

  const falKey = settings?.falKey || ""
  const selectedModel = settings?.selectedModel || "Qwen Edit"

  // Load conversation data when current conversation changes
  useEffect(() => {
    if (currentConversation) {
      setLocalMessages(currentConversation.messages)
      setLocalGeneratedImages(currentConversation.generatedImages)
      setSelectedVersion(currentConversation.generatedImages[0] || null)
    } else if (currentConversationId && localMessages.length === 0) {
      // Initialize empty conversation
      setLocalMessages([])
      setLocalGeneratedImages([])
      setSelectedVersion(null)
    }
  }, [currentConversation, currentConversationId, localMessages.length])

  // Load most recent conversation on mount
  useEffect(() => {
    if (conversations.length > 0 && !currentConversationId) {
      const latest = conversations[0]
      setCurrentConversationId(latest.id)
    }
  }, [conversations, currentConversationId])

  // Auto-save conversation when messages or images change
  useEffect(() => {
    if (!currentConversationId || (localMessages.length === 0 && localGeneratedImages.length === 0)) return

    const conversation: Conversation = {
      id: currentConversationId,
      title: localMessages.length > 0 ? localMessages[0].content.slice(0, 50) + "..." : "New Conversation",
      messages: localMessages,
      generatedImages: localGeneratedImages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    saveConversation.mutate(conversation)
  }, [localMessages, localGeneratedImages, currentConversationId, saveConversation])

  const createNewConversation = useCallback(() => {
    const newId = Date.now().toString()
    setCurrentConversationId(newId)
    setLocalMessages([])
    setLocalGeneratedImages([])
    setSelectedImage(null)
    setSelectedVersion(null)
    setPrompt("")
  }, [])

  const loadConversation = useCallback((conversationId: string) => {
    setCurrentConversationId(conversationId)
    setShowHistory(false)
  }, [])

  const handleDeleteConversation = useCallback(
    (conversationId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      deleteConversation.mutate(conversationId, {
        onSuccess: () => {
          if (currentConversationId === conversationId) {
            if (conversations.length > 1) {
              const remaining = conversations.filter((c) => c.id !== conversationId)
              loadConversation(remaining[0].id)
            } else {
              createNewConversation()
            }
          }
        },
      })
    },
    [currentConversationId, conversations, loadConversation, createNewConversation, deleteConversation],
  )

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleGenerateImage = useCallback(async () => {
    if (!falKey || !prompt) return

    const attachmentImage = selectedImage || (localGeneratedImages.length > 0 ? localGeneratedImages[0].url : null)
    if (!attachmentImage) return

    if (!currentConversationId) {
      const newId = Date.now().toString()
      setCurrentConversationId(newId)
    }

    // Add original image as v0 if first generation
    if (localGeneratedImages.length === 0 && selectedImage) {
      const originalImage: GeneratedImage = {
        id: Date.now().toString() + "_original",
        url: selectedImage,
        prompt: "Original image",
        timestamp: Date.now(),
        model: "Original",
      }
      setLocalGeneratedImages([originalImage])
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: prompt,
      image: attachmentImage,
      timestamp: Date.now(),
    }
    setLocalMessages((prev) => [...prev, userMessage])

    generateImageMutation.mutate(
      { falKey, prompt, imageUrl: attachmentImage, model: selectedModel },
      {
        onSuccess: (data) => {
          const newImage: GeneratedImage = {
            id: Date.now().toString() + "_gen",
            url: data.imageUrl,
            prompt,
            timestamp: Date.now(),
            model: selectedModel,
          }

          const assistantMessage: ChatMessage = {
            id: Date.now().toString() + "_assistant",
            type: "assistant",
            content: "Here's your edited image:",
            generatedImage: newImage,
            timestamp: Date.now(),
          }

          setLocalGeneratedImages((prev) => [newImage, ...prev])
          setLocalMessages((prev) => [...prev, assistantMessage])
          setSelectedVersion(newImage)
          setSelectedImage(newImage.url)
          setPrompt("")
        },
        onError: (error) => {
          console.error("Error generating image:", error)
        },
      },
    )
  }, [falKey, prompt, selectedImage, localGeneratedImages, currentConversationId, selectedModel, generateImageMutation])

  return (
    <div
      className="h-screen bg-zinc-950 flex flex-col relative"
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <style jsx global>{`
        ::-webkit-scrollbar {
          display: none;
        }
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        *::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="h-12 bg-zinc-950 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="text-zinc-400 hover:text-zinc-50 h-8 px-2"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={createNewConversation}
            className="text-zinc-400 hover:text-zinc-50 h-8 px-2"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="text-center">
          <h1 className="text-sm font-semibold text-zinc-50">Image Editor</h1>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          className="text-zinc-400 hover:text-zinc-50 h-8 px-2"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {showHistory && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowHistory(false)} />
          <div className="fixed top-12 left-0 w-80 h-[calc(100vh-3rem)] bg-zinc-950 border-r border-zinc-800 flex flex-col z-50 shadow-2xl">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-50">Conversations</h2>
              <Button
                onClick={createNewConversation}
                className="w-full mt-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Conversation
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-3 rounded-lg cursor-pointer mb-2 group hover:bg-zinc-800 ${
                    currentConversationId === conversation.id ? "bg-zinc-800" : ""
                  }`}
                  onClick={() => loadConversation(conversation.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-zinc-50 truncate">{conversation.title}</h3>
                      <p className="text-xs text-zinc-400 mt-1">{conversation.messages.length} messages</p>
                      <p className="text-xs text-zinc-500">{new Date(conversation.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-400"
                      onClick={(e) => handleDeleteConversation(conversation.id, e)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex-1 flex">
        <div className="w-1/2 flex flex-col">
          {showSettings && (
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="fal-key" className="text-sm text-zinc-300">
                    FAL API Key
                  </Label>
                  <Input
                    id="fal-key"
                    type="password"
                    placeholder="Enter your FAL API key"
                    value={falKey}
                    onChange={(e) => updateSettings.mutate({ falKey: e.target.value })}
                    className="mt-1 bg-zinc-950 border-zinc-700 text-zinc-50 placeholder-zinc-500 focus:border-zinc-600 focus:ring-0"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {localMessages.length === 0 ? (
              <div className="text-center text-zinc-500 mt-8">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Start a conversation by uploading an image and describing your edit</p>
              </div>
            ) : (
              localMessages
                .filter((message) => message.type === "user")
                .map((message) => (
                  <div key={message.id} className="flex gap-3 justify-start">
                    <div className="flex gap-3 max-w-[80%]">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-zinc-800">
                        <User className="w-4 h-4 text-zinc-300" />
                      </div>
                      <div className="rounded-lg p-3 space-y-2 text-zinc-50">
                        <p className="text-sm">{message.content}</p>
                        {message.image && (
                          <img
                            src={message.image || "/placeholder.svg"}
                            alt="Uploaded"
                            className="max-w-48 rounded-lg border border-zinc-700"
                          />
                        )}
                        <p className="text-xs text-zinc-500">{new Date(message.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>
                ))
            )}
            {generateImageMutation.isPending && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-zinc-300" />
                </div>
                <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-700">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-zinc-600 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-zinc-300">Generating image...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-zinc-800 bg-neutral-900/20">
            <div className="flex gap-2">
              <Textarea
                placeholder="Describe how you want to edit the image..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="flex-1 min-h-[60px] resize-none bg-zinc-950 border-zinc-700 text-zinc-50 placeholder-zinc-500 focus:border-zinc-600 focus:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleGenerateImage()
                  }
                }}
              />
              <Button
                onClick={handleGenerateImage}
                disabled={
                  !falKey ||
                  !prompt ||
                  (!selectedImage && localGeneratedImages.length === 0) ||
                  generateImageMutation.isPending
                }
                size="lg"
                className="flex-shrink-0 bg-zinc-50 hover:bg-zinc-200 text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-2 mt-2">
              <div>
                <Select value={selectedModel} onValueChange={(value) => updateSettings.mutate({ selectedModel: value })}>
                  <SelectTrigger className="w-32 h-8 bg-zinc-950 border-zinc-700 text-zinc-50 focus:border-zinc-600 focus:ring-0 text-xs whitespace-nowrap">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-700">
                    <SelectItem
                      value="Qwen Edit"
                      className="text-zinc-50 focus:bg-zinc-800 focus:text-zinc-50 text-xs whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-3 h-3 flex-shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"
                            fill="currentColor"
                          />
                          <path
                            d="M19 15L19.5 17L21 17.5L19.5 18L19 20L18.5 18L17 17.5L18.5 17L19 15Z"
                            fill="currentColor"
                          />
                          <path d="M5 6L5.5 7.5L7 8L5.5 8.5L5 10L4.5 8.5L3 8L4.5 7.5L5 6Z" fill="currentColor" />
                        </svg>
                        <span className="truncate">Qwen Edit</span>
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="Kontext Pro Edit"
                      className="text-zinc-50 focus:bg-zinc-800 focus:text-zinc-50 text-xs whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-3 h-3 flex-shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                          />
                          <path d="M9 9L15 15M15 9L9 15" stroke="currentColor" strokeWidth="2" />
                          <circle cx="12" cy="12" r="2" fill="currentColor" />
                        </svg>
                        <span className="truncate">Kontext Pro Edit</span>
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="Seeedit"
                      className="text-zinc-50 focus:bg-zinc-800 focus:text-zinc-50 text-xs whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-3 h-3 flex-shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
                          <path
                            d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                        <span className="truncate">Seeedit</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 border-zinc-700 text-zinc-400 hover:bg-zinc-800 bg-zinc-950 hover:text-zinc-50"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                {(selectedImage || (localGeneratedImages.length > 0 && localGeneratedImages[0])) && (
                  <div className="relative">
                    <img
                      src={selectedImage || localGeneratedImages[0]?.url || "/placeholder.svg"}
                      alt="Attachment"
                      className="w-8 h-8 rounded-lg object-cover border border-zinc-700"
                    />
                    {!selectedImage && localGeneratedImages.length > 0 && (
                      <div className="absolute -top-1 -right-1 bg-zinc-50 text-zinc-950 px-1 py-0.5 rounded text-xs font-bold">
                        v{localGeneratedImages.length - 1}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="w-1/2 flex flex-col relative overflow-hidden border-t border-l border-zinc-800 rounded-tl-lg">
          <div className="p-4 border-b border-zinc-800 bg-neutral-900/20">
            <h2 className="text-lg font-semibold text-zinc-50">Preview</h2>
            <p className="text-sm text-zinc-400">
              {selectedVersion
                ? `Selected: v${localGeneratedImages.findIndex((img) => img.id === selectedVersion.id) >= 0 ? localGeneratedImages.length - 1 - localGeneratedImages.findIndex((img) => img.id === selectedVersion.id) : 0}`
                : localGeneratedImages.length > 0
                  ? `Latest: v${localGeneratedImages.length - 1}`
                  : "No images generated"}
            </p>
          </div>

          <div className="flex-1 relative p-6 flex items-center justify-center">
            {localGeneratedImages.length === 0 ? (
              <div className="text-center text-zinc-500">
                <Eye className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Generated images will appear here</p>
                <p className="text-sm mt-2">Start by uploading an image and describing your edit</p>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={(selectedVersion || localGeneratedImages[0])?.url || "/placeholder.svg"}
                  alt="Preview image"
                  className="max-w-full max-h-[500px] object-contain rounded-lg shadow-2xl"
                />
                <div className="absolute top-4 left-4 bg-zinc-950/90 text-zinc-50 px-3 py-1 rounded-full text-sm font-medium border border-zinc-700">
                  v
                  {selectedVersion
                    ? localGeneratedImages.findIndex((img) => img.id === selectedVersion.id) >= 0
                      ? localGeneratedImages.length -
                        1 -
                        localGeneratedImages.findIndex((img) => img.id === selectedVersion.id)
                      : 0
                    : localGeneratedImages.length - 1}
                </div>
              </div>
            )}

            {localGeneratedImages.length > 0 && (
              <div className="absolute top-0 right-0 bg-zinc-950/95 backdrop-blur-sm border-l border-zinc-800 p-2 h-full">
                <div className="flex flex-col gap-1">
                  {localGeneratedImages.map((image, index) => {
                    const versionNumber = localGeneratedImages.length - 1 - index
                    return (
                      <div
                        key={image.id}
                        className="relative"
                        onMouseEnter={() => setHoveredVersion(image.id)}
                        onMouseLeave={() => setHoveredVersion(null)}
                      >
                        <div
                          className="w-12 h-12 relative cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => {
                            setSelectedVersion(image)
                            setSelectedImage(image.url)
                          }}
                        >
                          <img
                            src={image.url || "/placeholder.svg"}
                            alt={`Version ${versionNumber}`}
                            className="w-full h-full object-cover rounded border border-zinc-700"
                          />
                          <div className="absolute -top-1 -right-1 bg-zinc-950/90 text-zinc-50 px-2 py-1 rounded-full text-xs font-medium border border-zinc-700">
                            v{versionNumber}
                          </div>
                        </div>

                        {hoveredVersion === image.id && (
                          <div className="absolute top-0 right-full mr-2 z-50 bg-zinc-950 border border-zinc-700 rounded-lg p-3 w-64 shadow-xl">
                            <div className="absolute top-4 left-full w-2 h-2 bg-zinc-950 border-r border-b border-zinc-700 rotate-45 transform -translate-y-1/2"></div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-zinc-50 font-medium text-sm">Version {versionNumber}</span>
                                <span className="text-zinc-400 text-xs">
                                  {new Date(image.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-zinc-300 text-sm">{image.prompt}</p>
                              {image.model && (
                                <div className="flex items-center gap-1">
                                  <span className="text-zinc-400 text-xs">Model:</span>
                                  <span className="text-zinc-300 text-xs font-medium">{image.model}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
