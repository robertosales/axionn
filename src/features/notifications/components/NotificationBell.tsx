import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "../hooks/useNotifications";
import type { Notification } from "../hooks/useNotifications";

const TYPE_ICONS: Record<string, string> = {
  hu_moved: "📦", hu_assigned: "👤", hu_blocked: "🚫",
  impediment_created: "⚠️", impediment_resolved: "✅",
  sprint_started: "🚀", sprint_ending: "⏰",
  planning_started: "🎴", retro_started: "🔄", mention: "💬",
};

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "agora"; if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, deleteNotif } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" className="relative h-8 w-8" onClick={() => setOpen(o => !o)}>
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-sm font-semibold">Notificações</span>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={markAllRead}>
                <CheckCheck className="h-3 w-3" /> Marcar todas
              </Button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-20" />
                <p className="text-xs">Nenhuma notificação</p>
              </div>
            ) : notifications.map((n: Notification) => (
              <div key={n.id} onClick={() => !n.read && markRead(n.id)}
                className={`flex items-start gap-2.5 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group ${!n.read ? "bg-primary/5" : ""}`}>
                <span className="text-base mt-0.5 shrink-0">{TYPE_ICONS[n.type] ?? "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <p className={`text-xs font-medium leading-tight ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                    <span className="text-[9px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{n.body}</p>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  <button onClick={e => { e.stopPropagation(); deleteNotif(n.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-500">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
