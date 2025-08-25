"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Send, Settings, User, Bot, Paperclip, Eye, Plus, MessageSquare, Trash2 } from "lucide-react"
import type { ChatMessage, GeneratedImage } from "@/lib/indexeddb"
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
  const [isHistoryAnimating, setIsHistoryAnimating] = useState(false)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])
  const [localGeneratedImages, setLocalGeneratedImages] = useState<GeneratedImage[]>([])
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [tempFalKey, setTempFalKey] = useState("")

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

  useEffect(() => {
    if (settingsDialogOpen) {
      setTempFalKey(falKey)
    }
  }, [settingsDialogOpen, falKey])

  useEffect(() => {
    if (currentConversation) {
      setLocalMessages(currentConversation.messages || [])
      setLocalGeneratedImages(currentConversation.generatedImages || [])
      if (currentConversation.generatedImages && currentConversation.generatedImages.length > 0) {
        const latestImage = currentConversation.generatedImages[0]
        setSelectedVersion(latestImage)
        setSelectedImage(latestImage.url)
      }
    }
  }, [currentConversation])

  useEffect(() => {
    if (currentConversationId && (localMessages.length > 0 || localGeneratedImages.length > 0)) {
      const title =
        localMessages.length > 0
          ? localMessages[0].content.slice(0, 50) + (localMessages[0].content.length > 50 ? "..." : "")
          : "New Conversation"

      saveConversation.mutate({
        id: currentConversationId,
        title,
        messages: localMessages,
        generatedImages: localGeneratedImages,
        updatedAt: Date.now(),
      })
    }
  }, [localMessages, localGeneratedImages, currentConversationId, saveConversation])

  const handleSaveFalKey = useCallback(() => {
    updateSettings.mutate({ falKey: tempFalKey })
    setSettingsDialogOpen(false)
  }, [tempFalKey, updateSettings])

  const toggleHistory = useCallback(() => {
    if (showHistory) {
      setIsHistoryAnimating(false)
      setTimeout(() => {
        setShowHistory(false)
      }, 300)
    } else {
      setShowHistory(true)
      setTimeout(() => {
        setIsHistoryAnimating(true)
      }, 10)
    }
  }, [showHistory])

  const createNewConversation = useCallback(() => {
    const newId = Date.now().toString()
    setCurrentConversationId(newId)
    setLocalMessages([])
    setLocalGeneratedImages([])
    setSelectedImage(null)
    setSelectedVersion(null)
    setPrompt("")
  }, [])

  const loadConversation = useCallback(
    (conversationId: string) => {
      setCurrentConversationId(conversationId)
      // toggleHistory()
    },
    [], // Remove toggleHistory dependency
  )

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
            onClick={toggleHistory}
            className="text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 h-8 px-2"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={createNewConversation}
            className="text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 h-8 px-2"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="text-center">
          <h1 className="text-sm font-semibold text-zinc-50">Image Editor</h1>
        </div>

        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-2 ${
                !falKey
                  ? "animate-pulse bg-orange-500/20 text-orange-400 hover:text-orange-300 hover:bg-orange-500/30 border border-orange-500/30"
                  : "text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800"
              }`}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-50">
            <DialogHeader>
              <DialogTitle className="text-zinc-50">Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="fal-key" className="text-sm text-zinc-300">
                  FAL API Key
                </Label>
                <p className="text-xs text-zinc-500 mt-1 mb-2">
                  Get your API key from{" "}
                  <a
                    href="https://fal.ai/dashboard/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    fal.ai/dashboard/keys
                  </a>
                </p>
                <Input
                  id="fal-key"
                  type="password"
                  placeholder="Enter your FAL API key"
                  value={tempFalKey}
                  onChange={(e) => setTempFalKey(e.target.value)}
                  className="mt-1 bg-zinc-950 border-zinc-700 text-zinc-50 placeholder-zinc-500 focus:border-zinc-600 focus:ring-0"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSettingsDialogOpen(false)}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 bg-zinc-950 hover:text-zinc-50"
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveFalKey} className="bg-zinc-50 hover:bg-zinc-200 text-zinc-950">
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {showHistory && (
        <>
          <div
            className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${
              isHistoryAnimating ? "opacity-100" : "opacity-0"
            }`}
            onClick={toggleHistory}
          />
          <div
            className={`fixed top-12 left-0 w-80 h-[calc(100vh-3rem)] bg-black border-t rounded-tr-lg border-r border-zinc-800 flex flex-col z-50 shadow-2xl transition-transform duration-300 ease-out ${
              isHistoryAnimating ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="p-4 border-b bg-neutral-900/30 border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-50">Conversations</h2>
              <Button onClick={createNewConversation} className="w-fit text-zinc-50">
                <Plus className="w-4 h-4" />
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-11rem)]">
            {localMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-zinc-500">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation by uploading an image and describing your edit</p>
                </div>
              </div>
            ) : (
              localMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.type === "user" ? "justify-start" : "justify-start"}`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-zinc-800 mt-0">
                    {message.type === "user" ? (
                      <User className="w-4 h-4 text-zinc-300" />
                    ) : (
                      <Bot className="w-4 h-4 text-zinc-300" />
                    )}
                  </div>
                  <div className="max-w-[80%]">
                    <div className="rounded-lg px-3 pb-3  space-y-2 text-zinc-50">
                      <p className="text-sm">{message.content}</p>
                      {message.image && (
                        <img
                          src={message.image || "/placeholder.svg"}
                          alt="Uploaded"
                          className="max-w-48 rounded-lg border border-zinc-700"
                        />
                      )}
                      {message.generatedImage && (
                        <img
                          src={message.generatedImage.url || "/placeholder.svg"}
                          alt="Generated"
                          className="max-w-64 rounded-lg border border-zinc-700"
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
                <div className="flex-1 max-w-[80%]">
                  <div className="bg-zinc-950 rounded-lg px-3 pb-3 pt-1.5">
                    <div className="flex items-center gap-2">
                      <img src="/logos/fal.svg" alt="Loading" className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-zinc-300">Generating image...</span>
                    </div>
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
                className="flex-shrink-0 bg-zinc-50 hover:bg-zinc-200 text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-2 mt-2 relative">
              <div>
                <Select
                  value={selectedModel}
                  onValueChange={(value) => updateSettings.mutate({ selectedModel: value })}
                >
                  <SelectTrigger className="w-fit h-8 bg-zinc-950 border-zinc-700 text-zinc-50 focus:border-zinc-600 focus:ring-0 text-xs whitespace-nowrap">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-700">
                    <SelectItem
                      value="Qwen Edit"
                      className="text-zinc-50 focus:bg-zinc-800 focus:text-zinc-50 text-xs whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <img src="/logos/qwen.svg" alt="Qwen" className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">Qwen Edit</span>
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="Flux Kontext Pro"
                      className="text-zinc-50 focus:bg-zinc-800 focus:text-zinc-50 text-xs whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <img src="/logos/bfl.svg" alt="Black Forest Labs" className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">Flux Kontext Pro</span>
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="Bytedance Seededit"
                      className="text-zinc-50 focus:bg-zinc-800 focus:text-zinc-50 text-xs whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <img src="/logos/bytedance.svg" alt="ByteDance" className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">Bytedance Seededit</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 h-9 px-3 border-zinc-700 text-zinc-400 hover:bg-zinc-800 bg-zinc-950 hover:text-zinc-50"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {(selectedImage || (localGeneratedImages.length > 0 && localGeneratedImages[0])) && (
                  <div className="relative">
                    <img
                      src={selectedImage || localGeneratedImages[0]?.url || "/placeholder.svg"}
                      alt="Attachment"
                      className="w-8 h-9 rounded-lg object-cover border border-zinc-700"
                    />
                    {!selectedImage && localGeneratedImages.length > 0 && (
                      <div className="absolute -top-1 -right-1 bg-zinc-50 text-zinc-950 px-1 py-0.5 rounded text-xs font-bold">
                        v{localGeneratedImages.length - 1}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="absolute bottom-0 right-0 flex items-center gap-1 text-xs text-zinc-500">
                <span>Powered by</span>
                <a
                  href="https://fal.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-100 transition-opacity"
                >
                  <img src="/logos/fal-logo.svg" alt="fal" className="h-3 opacity-70" />
                </a>
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
