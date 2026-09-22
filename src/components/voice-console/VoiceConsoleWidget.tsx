import { useEffect, useState } from 'react';
import { Mic, X } from 'lucide-react';

// CC语音台悬浮按钮(2026-08-31 磊哥令):点开浮层 iframe 内嵌 /voice/ 页面
// (nginx 反代 voice-dl 8097,同源 HTTPS 满足浏览器麦克风安全上下文)。
// 纯前端挂件,不碰聊天逻辑;关闭时卸载 iframe = 断开语音 ws。
const VOICE_URL = '/voice/';

export default function VoiceConsoleWidget() {
  const [open, setOpen] = useState(false);

  // Esc 关闭
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {open ? (
        <div className="fixed bottom-4 left-4 z-[999] flex h-[70vh] max-h-[560px] w-[380px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5 text-sm">
            <span className="font-medium">语音台 · 按住说话</span>
            <button
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="关闭语音台"
            >
              <X />
            </button>
          </div>
          <iframe
            src={VOICE_URL}
            title="CC语音台"
            className="h-full w-full flex-1 border-0"
            allow="microphone"
          />
        </div>
      ) : null}

      <button
        className="fixed bottom-4 left-4 z-[999] flex h-12 w-12 items-center justify-center rounded-full border border-border/50 bg-card text-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        onClick={() => setOpen((v) => !v)}
        style={open ? { display: 'none' } : undefined}
        aria-label="打开语音台"
        title="语音台 · 按住说话"
      >
        <Mic />
      </button>
    </>
  );
}
