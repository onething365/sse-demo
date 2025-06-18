<template>
  <div class="home-container">
    <!-- <span @click="handleTestClick">test</span>
    <span @click="handleLoginClick">login</span>
    <span @click="handleGetPageClick">{{ loading ? '加载中' : '' }}page</span>
    <HelloWorld msg="22"></HelloWorld> -->
    {{ isConnected ? '连接' : '断开' }}
  </div>
</template>
<script lang="ts" setup>
import { useRequest } from 'alova/client'
import { testMockGetApi, login, getFeedList } from '@/api/testalova'
import useSse from '@/hooks/useSSE'

const { data, isConnected } = useSse({
  url: '/connect/sse',
  events: ['notification', 'alert'],
  messageInterval: 60000,
  onMessage: (message, event) => {
    console.log(`Received ${event || 'default'} message:`, message)
  },

  onError: err => {
    console.error('SSE error:', err)
  },
})

const handleTestClick = async () => {
  const d = await testMockGetApi()
  console.log(d, 'test')
}
const handleLoginClick = async () => {
  const d = await login({ username: 'test', password: 'test@123' })
  console.log(d, 'login')
}
const {
  data: feedList,
  loading,
  send: getList,
} = useRequest(getFeedList, {
  initialData: [],
  immediate: false,
})
const handleGetPageClick = async () => {
  await getList()
  console.log(feedList, 'feedList')
}
</script>
<style lang="scss" scoped>
.home-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  flex-direction: column;
  .home-content {
    flex: 1;
    display: flex;
    align-items: center;
  }
}
</style>
