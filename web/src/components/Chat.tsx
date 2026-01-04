import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, StopCircle, Bot, Sparkles, Wrench, ChevronDown, CheckCircle2 } from 'lucide-react'
import Markdown from 'react-markdown'
import { getChatUrl } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ChatMessagePart {
  type: 'text' | 'tool_use' | 'tool_result'
  content: string
  toolName?: string
  toolId?: string
}

interface ChatMessage {
  type: 'user' | 'assistant' | 'system' | 'error'
  content: string
  timestamp: string
  parts?: ChatMessagePart[]
  turnId?: number
}

interface RawMessage {
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result' | 'error' | 'done' | 'connected'
  content: string
  timestamp: string
  toolName?: string
  toolId?: string
}

interface ChatProps {
  workspaceName: string
  sessionId?: string
  onSessionId?: (sessionId: string) => void
}

function ToolUseBubble({
  toolName,
  content
}: {
  toolName: string
  content: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="ml-0">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors w-full"
        >
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')}
          />
          <Wrench className="h-3 w-3" />
          <span className="font-mono font-medium">{toolName}</span>
        </button>
        {isExpanded && content && (
          <pre className="mt-2 p-2 bg-muted/50 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto border border-border/50">
            {content.slice(0, 500)}
            {content.length > 500 && '... (truncated)'}
          </pre>
        )}
      </div>
    </div>
  )
}

function ToolResultBubble({
  content
}: {
  content: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="ml-0">
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors w-full"
        >
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')}
          />
          <CheckCircle2 className="h-3 w-3" />
          <span className="font-medium">Tool result</span>
        </button>
        {isExpanded && content && (
          <pre className="mt-2 p-2 bg-muted/50 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto border border-border/50 whitespace-pre-wrap">
            {content.slice(0, 2000)}
            {content.length > 2000 && '... (truncated)'}
          </pre>
        )}
      </div>
    </div>
  )
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-primary text-primary-foreground rounded-tr-sm">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  )
}

function AssistantText({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-pre:bg-background/50 prose-pre:border prose-code:text-xs prose-code:before:content-none prose-code:after:content-none">
      <Markdown>{content}</Markdown>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.type === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  if (message.type === 'error') {
    return (
      <div className="flex justify-center">
        <span className="text-xs text-destructive bg-destructive/10 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  if (message.type === 'user') {
    return <UserBubble content={message.content} />
  }

  if (message.parts && message.parts.length > 0) {
    return (
      <div className="space-y-3">
        {message.parts.map((part, idx) => {
          if (part.type === 'text' && part.content) {
            return <AssistantText key={idx} content={part.content} />
          }
          if (part.type === 'tool_use') {
            return (
              <ToolUseBubble
                key={idx}
                toolName={part.toolName || 'unknown'}
                content={part.content}
              />
            )
          }
          if (part.type === 'tool_result') {
            return <ToolResultBubble key={idx} content={part.content} />
          }
          return null
        })}
      </div>
    )
  }

  return <AssistantText content={message.content} />
}

function StreamingMessage({ parts }: { parts: ChatMessagePart[] }) {
  const hasContent = parts.some(p => p.content.length > 0)

  return (
    <div className="space-y-3">
      {parts.map((part, idx) => {
        if (part.type === 'text' && part.content) {
          return <AssistantText key={idx} content={part.content} />
        }
        if (part.type === 'tool_use') {
          return (
            <ToolUseBubble
              key={idx}
              toolName={part.toolName || 'unknown'}
              content={part.content}
            />
          )
        }
        if (part.type === 'tool_result') {
          return <ToolResultBubble key={idx} content={part.content} />
        }
        return null
      })}
      {!hasContent && (
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  )
}

export function Chat({ workspaceName, sessionId: initialSessionId, onSessionId }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)

  const streamingPartsRef = useRef<ChatMessagePart[]>([])
  const [streamingParts, setStreamingParts] = useState<ChatMessagePart[]>([])
  const turnIdRef = useRef(0)

  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingParts, scrollToBottom])

  const finalizeStreaming = useCallback(() => {
    const parts = [...streamingPartsRef.current]

    if (parts.length > 0) {
      const textContent = parts
        .filter(p => p.type === 'text')
        .map(p => p.content)
        .join('')

      setMessages(prev => [...prev, {
        type: 'assistant',
        content: textContent || '(No text response)',
        timestamp: new Date().toISOString(),
        parts,
        turnId: turnIdRef.current,
      }])
    }

    streamingPartsRef.current = []
    setStreamingParts([])
    setIsStreaming(false)
  }, [])

  const connect = useCallback(() => {
    const wsUrl = getChatUrl(workspaceName)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const msg: RawMessage = JSON.parse(event.data)

        if (msg.type === 'connected') {
          return
        }

        if (msg.type === 'tool_use') {
          const lastPart = streamingPartsRef.current[streamingPartsRef.current.length - 1]
          if (lastPart?.type === 'text' && lastPart.content === '') {
            streamingPartsRef.current.pop()
          }
          streamingPartsRef.current.push({
            type: 'tool_use',
            content: msg.content,
            toolName: msg.toolName,
            toolId: msg.toolId,
          })
          streamingPartsRef.current.push({ type: 'text', content: '' })
          setStreamingParts([...streamingPartsRef.current])
          return
        }

        if (msg.type === 'tool_result') {
          const lastPart = streamingPartsRef.current[streamingPartsRef.current.length - 1]
          if (lastPart?.type === 'text' && lastPart.content === '') {
            streamingPartsRef.current.pop()
          }
          streamingPartsRef.current.push({
            type: 'tool_result',
            content: msg.content,
            toolId: msg.toolId,
          })
          streamingPartsRef.current.push({ type: 'text', content: '' })
          setStreamingParts([...streamingPartsRef.current])
          return
        }

        if (msg.type === 'assistant') {
          if (streamingPartsRef.current.length === 0) {
            streamingPartsRef.current.push({ type: 'text', content: '' })
          }
          const lastPart = streamingPartsRef.current[streamingPartsRef.current.length - 1]
          if (lastPart?.type === 'text') {
            lastPart.content += msg.content
          } else {
            streamingPartsRef.current.push({ type: 'text', content: msg.content })
          }
          setStreamingParts([...streamingPartsRef.current])
          return
        }

        if (msg.type === 'done') {
          finalizeStreaming()
          return
        }

        if (msg.type === 'system') {
          if (msg.content.startsWith('Session started')) {
            const match = msg.content.match(/Session (\S+)/)
            if (match) {
              const newSessionId = match[1]
              setSessionId(newSessionId)
              onSessionId?.(newSessionId)
            }
            return
          }
          if (msg.content === 'Processing your message...') {
            return
          }
        }

        if (msg.type === 'error') {
          setMessages(prev => [...prev, {
            type: 'error',
            content: msg.content,
            timestamp: msg.timestamp,
          }])
          return
        }

        if (msg.type === 'system') {
          setMessages(prev => [...prev, {
            type: 'system',
            content: msg.content,
            timestamp: msg.timestamp,
          }])
        }
      } catch (err) {
        console.error('Failed to parse message:', err)
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      finalizeStreaming()
    }

    ws.onerror = (error) => {
      console.error('Chat WebSocket error:', error)
      setMessages(prev => [...prev, {
        type: 'error',
        content: 'Connection error - is the workspace running?',
        timestamp: new Date().toISOString(),
      }])
    }

    return ws
  }, [workspaceName, onSessionId, finalizeStreaming])

  useEffect(() => {
    const ws = connect()

    return () => {
      ws.close()
    }
  }, [connect])

  const sendMessage = useCallback(() => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }

    turnIdRef.current += 1

    const userMessage: ChatMessage = {
      type: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      turnId: turnIdRef.current,
    }

    setMessages(prev => [...prev, userMessage])

    wsRef.current.send(JSON.stringify({
      type: 'message',
      content: input.trim(),
      sessionId,
    }))

    setInput('')
    setIsStreaming(true)
    streamingPartsRef.current = []
    setStreamingParts([])
  }, [input, sessionId])

  const interrupt = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }))
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-orange-500" />
          <span className="font-medium">Claude Code</span>
          {sessionId && (
            <span className="text-xs text-muted-foreground font-mono">
              {sessionId.slice(0, 8)}...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-2 h-2 bg-muted-foreground rounded-full" />
              Disconnected
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Sparkles className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-center">
              Start a conversation with Claude Code
            </p>
            <p className="text-sm text-center mt-1">
              Ask questions, request code changes, or get help with your project
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}

        {isStreaming && (
          <StreamingMessage parts={streamingParts} />
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4 pb-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            className="min-h-[44px] max-h-[200px] resize-none"
            disabled={!isConnected}
            rows={1}
          />
          {isStreaming ? (
            <Button
              onClick={interrupt}
              variant="destructive"
              size="icon"
              className="shrink-0"
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || !isConnected}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
