import { useState, useEffect, useCallback } from "react";
import {
  fetchUserNotifications,
  markNotificationRead,
  markNotificationsRead,
} from "@/features/notifications/services/notifications.service";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, CheckCheck, ShieldAlert, MessageCircle, AlertTriangle, Eye } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  link_type?: string;
  link_id?: string;
}

/** Resolve a rota de destino com base nos campos link_type e link_id da notificação */
function resolveNotificationRoute(
  linkType: string | undefined,
  linkId: string | undefined
): { path: string; state?: Record<string, unknown> } | null {
  if (!linkType || !linkId) return null;
  switch (linkType) {
    case "activity":
      return {
        path: "/sala-agil/atividades",
        state: { highlightActivityId: linkId },
      };
    default:
      return null;
  }
}

export function NotificationBell() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  // Usa profile.user_id quando disponível — é o ID correto na tabela notifications
  const userId = profile?.user_id ?? user?.id ?? "";

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    const data = await fetchUserNotifications(userId, 30);
    setNotifications(data as any[]);
  }, [userId]);

  // Carga inicial + polling de segurança a cada 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Supabase Realtime — atualiza o sino imediatamente ao receber nova notificação
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notif-bell-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const raw = payload.new as any;
          const newNotif: Notification = {
            id: raw.id,
            type: raw.type,
            title: raw.title,
            message: raw.message ?? "",
            is_read: false,
            created_at: raw.created_at,
            link_type: raw.link_type ?? undefined,
            link_id: raw.link_id ?? undefined,
          };
          setNotifications((prev) => [newNotif, ...prev]);
          // Toast clicável que também navega para a atividade
          const route = resolveNotificationRoute(newNotif.link_type, newNotif.link_id);
          toast(newNotif.title, {
            description: newNotif.message || undefined,
            duration: 8000,
            action: route
              ? {
                  label: "Ver atividade",
                  onClick: () => navigate(route.path, { state: route.state }),
                }
              : undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, navigate]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await markNotificationsRead(unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  /**
   * Ao clicar em uma notificação:
   * 1. Marca como lida
   * 2. Fecha o popover
   * 3. Navega para a rota correspondente passando o ID via state
   */
  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) await markAsRead(n.id);
    setOpen(false);
    const route = resolveNotificationRoute(n.link_type, n.link_id);
    if (route) navigate(route.path, { state: route.state });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "mention":    return <MessageCircle className="h-4 w-4 text-primary" />;
      case "impediment": return <ShieldAlert className="h-4 w-4 text-warning" />;
      case "alert":      return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:           return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-[10px] bg-destructive text-destructive-foreground animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notificações</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllAsRead}>
              <CheckCheck className="h-3 w-3" /> Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const hasLink = !!resolveNotificationRoute(n.link_type, n.link_id);
                return (
                  <div
                    key={n.id}
                    role={hasLink ? "button" : undefined}
                    tabIndex={hasLink ? 0 : undefined}
                    onClick={() => handleNotificationClick(n)}
                    onKeyDown={(e) => e.key === "Enter" && handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      !n.is_read ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    } ${
                      hasLink ? "cursor-pointer hover:bg-muted/60" : ""
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-tight ${!n.is_read ? "font-semibold" : ""}`}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                          <div className="flex items-center gap-1">
                            {hasLink && (
                              <span className="text-[10px] text-primary font-medium">Ver atividade →</span>
                            )}
                            {!n.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] gap-1 text-primary hover:text-primary"
                                onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                              >
                                <Eye className="h-3 w-3" /> Ciente
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      {!n.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5 animate-pulse" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
