import { Component, type ReactNode } from 'react'

interface State { err: Error | null }
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { err: null }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error, info: unknown) { console.error('[ErrorBoundary]', err, info) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-8">
        <div className="max-w-md border border-rule rounded-[var(--radius-card)] p-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-signal">Runtime Error</div>
          <h1 className="mt-2 text-xl font-semibold">页面出了一点问题</h1>
          <p className="mt-2 text-sm text-muted leading-relaxed">{this.state.err.message}</p>
          <pre className="mt-3 p-3 bg-muted/10 rounded text-[11px] overflow-auto max-h-48">{this.state.err.stack}</pre>
          <div className="mt-4 flex gap-2">
            <button onClick={() => location.reload()} className="px-3 h-9 text-sm rounded border border-rule hover:bg-muted/10">重新加载</button>
            <button onClick={() => this.setState({ err: null })} className="px-3 h-9 text-sm rounded bg-brand text-white">尝试恢复</button>
          </div>
        </div>
      </div>
    )
  }
}
