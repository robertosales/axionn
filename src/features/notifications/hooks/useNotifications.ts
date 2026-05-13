import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth }  from "@/contexts/AuthContext";
import { toast }    from "sonner";

export interface AppNotification {
  id:         string;
  title:      string;
  message:    string;
  type:       string; // info | warning | success | error
  is_read:    boolean;
  link_type:  string | null;
  link_id:    string | null;
  created_at: string;
  team_id:    string;
}

export function useNotifications() {
  const { profile, currentTeam } = useAuth();
  const userId = profile?.user_id ?? "";
  const teamId = currentTeam?.id ?? "";

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);

  const load = useCallback(async () => {
    if (!userId || !teamId) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (data ?? []) as AppNotification[];
    setNotifications(list);
    setUnreadCount(list.filter(n => !n.is_read).length);
    setLoading(false);
  }, [userId, teamId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!userId || !teamId) return;
    const ch = supabase
      .channel(`notifications-${userId}-${teamId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const n = payload.new as AppNotification;
        setNotifications(prev => [n, ...prev]);
        setUnreadCount(c => c + 1);
        // Toast automático
        const toastFn = n.type === "error" ? toast.error
          : n.type === "warning" ? toast.warning
          : n.type === "success" ? toast.success
          : toast.info;
        toastFn(n.title, { description: n.message });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, teamId]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await supabase.from("notifications").update({ is_read: true })
      .eq("user_id", userId).eq("team_id", teamId).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [userId, teamId]);

  const deleteNotification = useCallback(async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications(prev => {
      const n = prev.find(x => x.id === id);
      if (n && !n.is_read) setUnreadCount(c => Math.max(0, c - 1));
      return prev.filter(x => x.id !== id);
    });
  }, []);

  const clearAll = useCallback(async () => {
    await supabase.from("notifications").delete().eq("user_id", userId).eq("team_id", teamId);
    setNotifications([]);
    setUnreadCount(0);
  }, [userId, teamId]);

  return { notifications, unreadCount, loading, markRead, markAllRead, deleteNotification, clearAll, reload: load };
}
