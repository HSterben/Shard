import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ConvexClient } from 'convex/browser'
import { useAuth } from '../auth/AuthSessionProvider'
import { api } from '../convex/api'
import { convexSiteUrl, convexUrl } from '../lib/convexUrls'
import './app/ChatView.css'

const DEFAULT_SYSTEM_INSTRUCTION =
  'You are PROXY X, an expert AI assistant. Be concise and helpful. Always provide clear, accurate information and assist the user to the best of your ability.'

const TONES = [
  { id: 'concise', label: 'Concise', instruction: 'Respond concisely. Prefer short, direct answers.' },
  { id: 'professional', label: 'Professional', instruction: 'Use a professional, polished tone.' },
  { id: 'precise', label: 'Precise', instruction: 'Be precise and specific. Avoid vague language.' },
] as const

type ToneId = (typeof TONES)[number]['id']

type ChatOptions = {
  systemInstruction: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
  stop: string | undefined
}

type AttachedFile = {
  file: File
  dataUrl: string
  type: string
  name: string
}

type ChatMessage = {
  id: number
  text: string
  sender: 'user' | 'ai'
  timestamp: Date
  images?: string[]
  isStreaming?: boolean
}

type StatePreset = {
  description?: string
  systemInstruction?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string | string[]
}

function applyTone(systemInstruction: string, toneId: ToneId) {
  const tone = TONES.find((t) => t.id === toneId)
  if (!tone) return systemInstruction
  return `${systemInstruction}\n\nTone: ${tone.instruction}`
}

function optionsFromPreset(
  presets: Record<string, StatePreset>,
  activePreset: string | null,
  message: string,
  toneId: ToneId,
): ChatOptions {
  const base: ChatOptions = {
    systemInstruction: applyTone(DEFAULT_SYSTEM_INSTRUCTION, toneId),
    temperature: 0.5,
    maxTokens: 4096,
    topP: 0.95,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    stop: undefined,
  }

  let key = activePreset
  if (!key) {
    const firstWord = message.trim().split(/\s+/)[0]
    if (firstWord) {
      key =
        Object.keys(presets).find((k) => k.toLowerCase() === firstWord.toLowerCase()) ?? null
    }
  }
  if (!key || !presets[key]) return base

  const p = presets[key]
  const sys = p.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION
  return {
    systemInstruction: applyTone(sys, toneId),
    temperature: typeof p.temperature === 'number' ? p.temperature : base.temperature,
    maxTokens: typeof p.maxTokens === 'number' && p.maxTokens > 0 ? p.maxTokens : base.maxTokens,
    topP: typeof p.topP === 'number' ? p.topP : base.topP,
    frequencyPenalty:
      typeof p.frequencyPenalty === 'number' ? p.frequencyPenalty : base.frequencyPenalty,
    presencePenalty:
      typeof p.presencePenalty === 'number' ? p.presencePenalty : base.presencePenalty,
    stop: Array.isArray(p.stop) ? p.stop[0] : typeof p.stop === 'string' ? p.stop : undefined,
  }
}

async function readSseStream(
  response: Response,
  onChunk: (chunk: string) => void,
): Promise<string> {
  if (!response.body) throw new Error('Response body is null - streaming not supported')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''
  let buffer = ''

  const consumeLine = (line: string) => {
    if (!line.startsWith('data: ')) return false
    const data = line.slice(6).trim()
    if (data === '[DONE]') return true
    if (!data) return false
    try {
      const parsed = JSON.parse(data) as {
        error?: string
        choices?: { delta?: { content?: string }; message?: { content?: string } }[]
      }
      if (parsed.error) throw new Error(parsed.error)
      const delta = parsed.choices?.[0]?.delta?.content
      const message = parsed.choices?.[0]?.message?.content
      if (delta) {
        fullContent += delta
        onChunk(delta)
      } else if (message) {
        fullContent += message
        onChunk(message)
      }
    } catch (err) {
      if (err instanceof Error && err.message !== 'Unexpected end of JSON input') {
        if (err instanceof SyntaxError) return false
        throw err
      }
    }
    return false
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) consumeLine(line)
      }
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (consumeLine(line)) {
        return fullContent
      }
    }
  }
  return fullContent
}

export default function AppChat() {
  const { user, isLoading: authLoading, signOut, getAccessToken, signIn, switchAccount } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [subscriptionRequired, setSubscriptionRequired] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [stripePlans, setStripePlans] = useState<{ monthly: string | null; yearly: string | null }>({
    monthly: null,
    yearly: null,
  })
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [activeTone, setActiveTone] = useState<ToneId>('precise')
  const [statesOpen, setStatesOpen] = useState(false)
  const [presets, setPresets] = useState<Record<string, StatePreset>>({})
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [statesQuery, setStatesQuery] = useState('')

  const convex = useRef(new ConvexClient(convexUrl))
  const conversationContext = useRef<{ text: string; sender: string; images?: string[] }[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startSignIn = useCallback(() => {
    void signIn({ state: { returnTo: '/app' } })
  }, [signIn])

  const handleSwitchAccount = useCallback(() => {
    void switchAccount({ state: { returnTo: '/app' } })
  }, [switchAccount])

  const bearerHeaders = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) throw new Error('Authentication token not available. Please log in.')
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }, [getAccessToken])

  useEffect(() => {
    if (!user) {
      convex.current.setAuth(async () => null)
      setPresets({})
      setActivePreset(null)
      return
    }
    convex.current.setAuth(async () => (await getAccessToken()) ?? null)
    let cancelled = false
    ;(async () => {
      try {
        const cloud = await convex.current.query(api.states.getMyStates, {})
        if (cancelled) return
        setPresets((cloud?.states as Record<string, StatePreset>) || {})
      } catch (err) {
        console.error('Failed to load states:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, getAccessToken])

  const fetchStripePlans = useCallback(async () => {
    try {
      const res = await fetch(`${convexSiteUrl}/stripe/plans`)
      const data = (await res.json().catch(() => ({}))) as { monthly?: string; yearly?: string }
      setStripePlans({ monthly: data.monthly || null, yearly: data.yearly || null })
    } catch (err) {
      console.error('Failed to fetch Stripe plans:', err)
    }
  }, [])

  useEffect(() => {
    if (user) fetchStripePlans()
  }, [user, fetchStripePlans])

  const hasActiveSubscription = useCallback(async () => {
    const account = await convex.current.query(api.account.getMyAccount, {})
    return { active: Boolean(account?.subscriptionActive) }
  }, [])

  const startCheckout = async (priceId: string | null) => {
    if (!priceId) return
    setCheckoutLoading(true)
    try {
      const res = await fetch(`${convexSiteUrl}/stripe/create-checkout-session-auth`, {
        method: 'POST',
        headers: await bearerHeaders(),
        body: JSON.stringify({ priceId }),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (!data.url) throw new Error('No checkout URL returned.')
      window.location.href = data.url
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start checkout')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const openPortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch(`${convexSiteUrl}/stripe/create-portal-session-auth`, {
        method: 'POST',
        headers: await bearerHeaders(),
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (!data.url) throw new Error('No portal URL returned.')
      window.location.href = data.url
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open billing portal')
    } finally {
      setPortalLoading(false)
    }
  }

  const buildContextMessages = (message: string, files: AttachedFile[]) => {
    type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
    type CtxMsg = { role: string; content: string | ContentPart[] }
    const out: CtxMsg[] = conversationContext.current.map((msg) => {
      const role = msg.sender === 'user' ? 'user' : 'assistant'
      if (msg.images?.length) {
        const content: ContentPart[] = [
          { type: 'text', text: msg.text },
          ...msg.images.map((img) => ({ type: 'image_url' as const, image_url: { url: img } })),
        ]
        return { role, content }
      }
      return { role, content: msg.text }
    })
    if (files.length > 0) {
      out.push({
        role: 'user',
        content: [
          { type: 'text', text: message || '' },
          ...files.map((f) => ({ type: 'image_url' as const, image_url: { url: f.dataUrl } })),
        ],
      })
    } else {
      out.push({ role: 'user', content: message })
    }
    return out
  }

  const chatBody = (message: string, files: AttachedFile[], options: ChatOptions) => ({
    messages: buildContextMessages(message, files),
    systemInstruction: options.systemInstruction,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    topP: options.topP,
    frequencyPenalty: options.frequencyPenalty,
    presencePenalty: options.presencePenalty,
    stop: options.stop,
  })

  const askOpenRouterStream = async (
    message: string,
    files: AttachedFile[],
    options: ChatOptions,
    onChunk: (chunk: string) => void,
  ) => {
    const response = await fetch(`${convexSiteUrl}/openrouter/stream`, {
      method: 'POST',
      headers: await bearerHeaders(),
      body: JSON.stringify(chatBody(message, files, options)),
    })
    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(errorData.error || `HTTP error: ${response.status}`)
    }
    return readSseStream(response, onChunk)
  }

  const askOpenRouterComplete = async (message: string, files: AttachedFile[], options: ChatOptions) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000)
    let res: Response
    try {
      res = await fetch(`${convexSiteUrl}/openrouter/complete`, {
        method: 'POST',
        signal: controller.signal,
        headers: await bearerHeaders(),
        body: JSON.stringify(chatBody(message, files, options)),
      })
    } catch (e) {
      clearTimeout(timeoutId)
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error('Request timed out. Try a shorter question or try again.')
      }
      throw e
    }
    clearTimeout(timeoutId)
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    const data = (await res.json()) as { content?: string }
    return data.content ?? ''
  }

  const getAIResponse = async (userMessage: string, files: AttachedFile[] = []) => {
    try {
      const sub = await hasActiveSubscription()
      if (!sub.active) {
        setSubscriptionRequired(true)
        return
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
      setSubscriptionRequired(true)
      return
    }

    setIsLoading(true)
    const aiMessageId = Date.now() + 1
    setMessages((prev) => [
      ...prev,
      { id: aiMessageId, text: '', sender: 'ai', timestamp: new Date(), isStreaming: true },
    ])

    const options = optionsFromPreset(presets, activePreset, userMessage, activeTone)
    try {
      let contentToUse = ''
      try {
        contentToUse = await askOpenRouterStream(userMessage, files, options, (chunk) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === aiMessageId ? { ...msg, text: msg.text + chunk } : msg)),
          )
        })
      } catch (streamErr) {
        console.warn('Stream failed, falling back to complete:', streamErr)
        contentToUse = await askOpenRouterComplete(userMessage, files, options)
        setMessages((prev) =>
          prev.map((msg) => (msg.id === aiMessageId ? { ...msg, text: contentToUse } : msg)),
        )
      }

      if (!contentToUse.trim()) {
        setMessages((prev) => [
          ...prev.filter((msg) => msg.id !== aiMessageId),
          {
            id: Date.now() + 1,
            text: 'Error: The AI returned no text. Wait a minute and try again.',
            sender: 'ai',
            timestamp: new Date(),
          },
        ])
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId ? { ...msg, text: contentToUse, isStreaming: false } : msg,
          ),
        )
        conversationContext.current = [
          ...conversationContext.current,
          {
            text: userMessage,
            sender: 'user',
            images: files.length > 0 ? files.map((f) => f.dataUrl) : undefined,
          },
          { text: contentToUse, sender: 'ai' },
        ]
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev.filter((msg) => msg.id !== aiMessageId),
        {
          id: Date.now() + 1,
          text: `Error: ${error instanceof Error ? error.message : 'Failed to get response.'}`,
          sender: 'ai',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const el = messagesEndRef.current
    if (!el) return
    const scroller = el.closest('.chat-messages')
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  }, [messages])

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const valid = files.filter((file) => file.type.startsWith('image/') || file.type === 'application/pdf')
    const next = await Promise.all(
      valid.map(async (file) => ({
        file,
        dataUrl: await fileToBase64(file),
        type: file.type,
        name: file.name,
      })),
    )
    setAttachedFiles((prev) => [...prev, ...next])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const messageText = inputValue.trim()
    if ((!messageText && attachedFiles.length === 0) || isLoading) return
    const filesToSend = [...attachedFiles]
    setInputValue('')
    setAttachedFiles([])
    const userMessage: ChatMessage = {
      id: Date.now(),
      text: messageText || (filesToSend.length > 0 ? 'Sent files' : ''),
      sender: 'user',
      timestamp: new Date(),
      images: filesToSend.map((f) => f.dataUrl),
    }
    setMessages((prev) => [...prev, userMessage])
    conversationContext.current = [
      ...conversationContext.current,
      {
        text: messageText || '',
        sender: 'user',
        images: filesToSend.length > 0 ? filesToSend.map((f) => f.dataUrl) : undefined,
      },
    ]
    await getAIResponse(messageText || '', filesToSend)
  }

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  const titleBar = (
    <div className="chat-title-bar">
      <span className="chat-title-text">PROXY X</span>
      <div className="chat-title-actions">
        <Link to="/" className="chat-title-link">
          Home
        </Link>
        {user ? (
          <>
            <span className="chat-title-link" style={{ cursor: 'default' }}>
              {user.email}
            </span>
            <button type="button" className="chat-title-ghost" onClick={() => void openPortal()} disabled={portalLoading}>
              {portalLoading ? 'Billing…' : 'Billing'}
            </button>
            <button type="button" className="chat-title-ghost" onClick={handleSwitchAccount}>
              Switch account
            </button>
            <button type="button" className="chat-title-ghost" onClick={() => void signOut({ returnTo: `${window.location.origin}/app` })}>
              Sign out
            </button>
          </>
        ) : null}
      </div>
    </div>
  )

  if (authLoading) {
    return (
      <div className="chat-view">
        {titleBar}
        <div className="chat-auth-container">
          <div className="chat-auth-content">
            <div className="chat-loading-spinner" />
            <p>Checking authentication...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="chat-view">
        {titleBar}
        <div className="chat-auth-container">
          <div className="chat-auth-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="7" r="4" />
              <path d="M5.5 21a8.38 8.38 0 0 1 13 0" />
            </svg>
            <h2>Sign in to continue</h2>
            <p>Please log in to use PROXY X on the web</p>
            <button className="chat-login-button" type="button" onClick={() => void startSignIn()}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (subscriptionRequired) {
    return (
      <div className="chat-view">
        {titleBar}
        <div className="chat-auth-container">
          <div className="chat-auth-content">
            <h2>Subscription required</h2>
            <p>Please subscribe to continue using AI features.</p>
            <button
              className="chat-login-button"
              type="button"
              onClick={() => void startCheckout(stripePlans.monthly)}
              disabled={checkoutLoading || !stripePlans.monthly}
            >
              {checkoutLoading ? 'Opening Checkout...' : 'Subscribe (Monthly)'}
            </button>
            <button
              className="chat-login-button"
              type="button"
              onClick={() => void startCheckout(stripePlans.yearly)}
              disabled={checkoutLoading || !stripePlans.yearly}
              style={{ marginTop: 10 }}
            >
              {checkoutLoading ? 'Opening Checkout...' : 'Subscribe (Yearly)'}
            </button>
            <button
              className="chat-close-button"
              type="button"
              onClick={async () => {
                try {
                  await convex.current.action(api.account.syncMySubscription, {})
                } catch (err) {
                  console.error('syncMySubscription failed:', err)
                }
                setSubscriptionRequired(false)
                await getAIResponse(messages.find((m) => m.sender === 'user')?.text || '')
              }}
              style={{ marginTop: 16, width: 'auto', height: 'auto', padding: '8px 12px' }}
            >
              I already subscribed (retry)
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-view">
      {titleBar}
      <div className="chat-shell">
        <aside className={`chat-sidebar${statesOpen ? ' is-open' : ''}`} aria-label="States">
          <button
            type="button"
            className={`chat-states-toggle${activePreset ? ' has-active' : ''}`}
            onClick={() => setStatesOpen((v) => !v)}
            aria-expanded={statesOpen}
            title="View states"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="4" width="18" height="4" rx="1" />
              <rect x="3" y="10" width="18" height="4" rx="1" />
              <rect x="3" y="16" width="18" height="4" rx="1" />
            </svg>
            {statesOpen ? <span>States</span> : null}
          </button>
          {statesOpen && (
            <div className="chat-sidebar-panel">
              {Object.keys(presets).length === 0 ? (
                <p className="chat-sidebar-empty">
                  No synced states yet. Add states in the desktop app while signed in — they will appear here.
                </p>
              ) : (
                <>
                  <label className="chat-states-search-wrap">
                    <span className="visually-hidden">Search states</span>
                    <input
                      className="chat-states-search"
                      type="search"
                      value={statesQuery}
                      onChange={(e) => setStatesQuery(e.target.value)}
                      placeholder="Search states"
                    />
                  </label>
                  <div className="chat-preset-list" role="listbox" aria-label="States">
                    <button
                      type="button"
                      role="option"
                      aria-selected={!activePreset}
                      className={`chat-preset-item${!activePreset ? ' is-active' : ''}`}
                      onClick={() => setActivePreset(null)}
                    >
                      Default
                    </button>
                    {Object.keys(presets)
                      .filter((name) =>
                        name.toLowerCase().includes(statesQuery.trim().toLowerCase()),
                      )
                      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                      .map((name) => (
                        <button
                          key={name}
                          type="button"
                          role="option"
                          aria-selected={activePreset === name}
                          className={`chat-preset-item${activePreset === name ? ' is-active' : ''}`}
                          title={presets[name]?.description || name}
                          onClick={() => setActivePreset(name)}
                        >
                          {name}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
        <div className="chat-main">
          <div className="chat-tone-bar" role="tablist" aria-label="Response tone">
            {TONES.map((tone) => (
              <button
                key={tone.id}
                type="button"
                role="tab"
                aria-selected={activeTone === tone.id}
                className={`chat-tone-pill${activeTone === tone.id ? ' is-active' : ''}`}
                onClick={() => setActiveTone(tone.id)}
              >
                {tone.label}
              </button>
            ))}
          </div>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">Start a conversation...</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`message message-${msg.sender}`}>
                  <div className="message-bubble">
                    {msg.images && msg.images.length > 0 && (
                      <div className="message-images">
                        {msg.images.map((img, idx) => (
                          <div key={idx} className="message-image-container">
                            <img src={img} alt={`Attachment ${idx + 1}`} className="message-image" />
                          </div>
                        ))}
                      </div>
                    )}
                    {(msg.text || msg.isStreaming) && (
                      <div className="message-text message-text-markdown">
                        {msg.sender === 'ai' ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text || ''}</ReactMarkdown>
                        ) : (
                          msg.text
                        )}
                        {msg.isStreaming && <span className="streaming-cursor">▋</span>}
                      </div>
                    )}
                  </div>
                  <div className="message-time">{formatTime(msg.timestamp)}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          {attachedFiles.length > 0 && (
            <div className="chat-attachments">
              {attachedFiles.map((fileData, idx) => (
                <div key={idx} className="chat-attachment-item">
                  {fileData.type.startsWith('image/') ? (
                    <img src={fileData.dataUrl} alt={fileData.name} className="attachment-preview" />
                  ) : (
                    <div className="attachment-pdf-icon">PDF</div>
                  )}
                  <span className="attachment-name" title={fileData.name}>
                    {fileData.name.length > 15 ? `${fileData.name.substring(0, 15)}...` : fileData.name}
                  </span>
                  <button
                    type="button"
                    className="attachment-remove"
                    onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove attachment"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <form className="chat-input-container" onSubmit={(e) => void handleSubmit(e)}>
            <input
              type="file"
              ref={fileInputRef}
              className="chat-file-input"
              accept="image/*,application/pdf"
              multiple
              onChange={(e) => void handleFileSelect(e)}
              aria-label="Attach file"
            />
            <button
              type="button"
              className="chat-attach-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              aria-label="Attach file"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              type="text"
              className="chat-input-field"
              placeholder="Ask PROXY X..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
            <button
              type="submit"
              className="chat-input-submit"
              disabled={(!inputValue.trim() && attachedFiles.length === 0) || isLoading}
              aria-label="Send message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
