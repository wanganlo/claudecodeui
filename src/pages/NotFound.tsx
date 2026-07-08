import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components'
export default function NotFound() {
  const { pathname } = useLocation()
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-signal">404 · Not Found</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">这条路不通</h1>
      <p className="mt-2 text-muted">
        路径 <code className="px-1 py-0.5 bg-muted/15 rounded text-[13px]">{pathname}</code> 没有对应页面。
      </p>
      <Link to="/" className="inline-block mt-6">
        <Button>返回首页</Button>
      </Link>
    </div>
  )
}
