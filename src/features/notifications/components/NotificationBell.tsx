import { useState, useRef, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { Badge }  from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotifications } from "../hooks/useNotifications";
import type { AppNotification } from "../hooks/useNotifications";

const TYPE_STYLES: Record<string, string> = {
  info:    "border-l-2 border-blue-400",
  success: "border-l-2 border-emerald-400",
  warning: "border-l-2 border-orange-400",
  error:   "border-l-2 border-red-400",
};

const TYPE_DOT: Record<string, string> = {
  info:    "bg-blue-400",
  success: "bg-emerald-400",
  warning: "bg-orange-400",
  error:   "bg-red-400",
};

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 max-h-[480px] rounded-xl border border-border bg-background shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold">Notificações</span>
              {unreadCount > 0 && <Badge variant="destructive" className="text-[9px] px-1.5">{unreadCount}</Badge>}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={markAllRead}>
                  <CheckCheck className="h-3 w-3" /> Lidas
                </Button>
              )}
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2 text-muted-foreground" onClick={clearAll}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-20" />
                <p className="text-xs">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem
                  key={n.id} notification={n}
                  onRead={() => markRead(n.id)}
                  onDelete={() => deleteNotification(n.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({ notification: n, onRead, onDelete }:
  { notification: AppNotification; onRead: () => void; onDelete: () => void }) {
  return (
    <div
      className={`flex gap-2 px-3 py-2.5 border-b border-border/40 hover:bg-muted/30 transition-colors ${
        !n.is_read ? "bg-primary/5" : "
      } ${TYPE_STYLES[n.type] ?? "border-l-2 border-transparent"}`}
    >
      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.is_read ? "bg-muted" : (TYPE_DOT[n.type] ?? "bg-primary")}`} />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className={`text-xs font-medium leading-snug ${n.is_read ? "text-muted-foreground" : ""}`}>{n.title}</p>
        <p className="text-[11px] text-muted-foreground leading-snug">{n.message}</p>
        <p className="text-[10px] text-muted-foreground/60">{new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        {!n.is_read && (
          <button onClick={onRead} className="text-muted-foreground hover:text-primary p-0.5 rounded">
            <Check className="h-3 w-3" />
          </button>
        )}
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-0.5 rounded">
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
