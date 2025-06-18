import { ref, onUnmounted } from 'vue'
import { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source'

interface SSEOptions<T = any> {
  url: string
  headers?: Record<string, string>
  body?: any
  method?: string
  events?: string[]
  messageInterval?: number
  maxRetries?: number
  initialRetryDelay?: number
  openWhenHidden?: boolean
  onMaxRetriesExceeded?: () => void
  onMessage?: (data: T, event: string | null) => void
  onError?: (error: any) => void
}

export default function useSSE<T = any>(options: SSEOptions<T>) {
  const {
    url,
    headers = {},
    body,
    method = 'GET',
    events = [],
    messageInterval = 30000,
    maxRetries = 5,
    initialRetryDelay = 1000,
    openWhenHidden = false,
    onMaxRetriesExceeded,
    onMessage,
    onError,
  } = options

  const data = ref<T | null>(null)
  const error = ref<any>(null)
  const isConnected = ref(false)
  const retryCount = ref(0)
  let controller: AbortController | null = null
  let messageTimer: number | null = null
  let retryDelay = initialRetryDelay
  let lastMessageTime = 0

  // 处理消息的通用函数
  const handleMessage = (rawData: string, event: string | null) => {
    let parsedData: T | string
    try {
      parsedData = rawData ? JSON.parse(rawData) : null
    } catch (err) {
      parsedData = rawData
    }

    // 更新响应式数据
    data.value = parsedData as T

    // 调用自定义消息回调
    if (onMessage) {
      onMessage(parsedData as T, event)
    }
  }

  // 重置消息计时器
  const resetMessageTimer = () => {
    lastMessageTime = Date.now()
    if (messageTimer) {
      clearTimeout(messageTimer)
    }
    messageTimer = setTimeout(() => {
      console.warn(`No message received for ${messageInterval}ms, reconnecting...`)
      reconnect()
    }, messageInterval) as unknown as number
  }

  // 关闭连接
  const close = () => {
    if (controller) {
      controller.abort()
      controller = null
    }
    if (messageTimer) {
      clearTimeout(messageTimer)
      messageTimer = null
    }
    isConnected.value = false
  }

  // 检查消息间隔
  const checkMessageInterval = () => {
    const timeSinceLastMessage = Date.now() - lastMessageTime
    if (timeSinceLastMessage >= messageInterval) {
      console.warn(`Message interval exceeded (${timeSinceLastMessage}ms > ${messageInterval}ms)`)
      reconnect()
    }
  }

  // 重新连接
  const reconnect = () => {
    checkMessageInterval()

    if (retryCount.value >= maxRetries) {
      console.error(`Max retries (${maxRetries}) exceeded`)
      onMaxRetriesExceeded?.()
      return
    }

    close()
    retryCount.value += 1

    // 指数退避
    const delay = Math.min(retryDelay * Math.pow(2, retryCount.value - 1), 30000)
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${retryCount.value}/${maxRetries})`)

    setTimeout(() => {
      connect()
    }, delay)
  }

  // 建立连接
  const connect = async () => {
    // 页面不可见时不建立连接
    if (!openWhenHidden && document.visibilityState === 'hidden') {
      console.log('Page is hidden, postponing connection')
      return
    }

    close()

    controller = new AbortController()
    isConnected.value = true
    retryCount.value = 0
    retryDelay = initialRetryDelay
    lastMessageTime = Date.now()

    try {
      await fetchEventSource(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,

        async onopen(response) {
          if (
            response.ok &&
            response.headers.get('content-type')?.includes(EventStreamContentType)
          ) {
            resetMessageTimer()
            return
          }

          const error = new Error(`Unexpected response: ${response.status} ${response.statusText}`)
          if (onError) onError(error)
          throw error
        },

        onmessage(msg) {
          resetMessageTimer()

          // 处理无事件类型的消息
          if (!msg.event) {
            handleMessage(msg.data, null)
          }
        },

        onclose() {
          // 服务器关闭连接时重连
          reconnect()
        },

        onerror(err) {
          error.value = err
          isConnected.value = false
          if (onError) onError(err)
          throw err // 抛出错误会触发重连
        },

        // 处理自定义事件
        ...(events.length > 0
          ? {
              events,
              on(event, msg) {
                resetMessageTimer()
                handleMessage(msg.data, event)
              },
            }
          : {}),
      })
    } catch (err) {
      error.value = err
      isConnected.value = false
      if (onError) onError(err)
      reconnect()
    }
  }

  // 处理页面可见性变化
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && !isConnected.value) {
      connect()
    } else if (document.visibilityState === 'hidden' && !openWhenHidden) {
      close()
    } else if (document.visibilityState === 'visible' && isConnected.value) {
      checkMessageInterval()
    }
  }

  // 初始化时监听页面可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 组件卸载时清理
  onUnmounted(() => {
    close()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  // 初始连接
  connect()

  return {
    data,
    error,
    isConnected,
    retryCount,
    close,
    reconnect,
  }
}
