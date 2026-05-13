import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import { NotificationDrawer } from "./NotificationDrawer";
import type { AppNotification } from "../hooks/useNotifications";

interface Props {
  notifications:  AppNotification[];
  criticalCount:  number;
  warningCount:   number;
}

export function NotificationBell({ notifications, criticalCount, warningCount }: Props) {
  const [open, setOpen] = useState(false);
  const total = notifications.length;

  const badgeColor =
    criticalCount > 0 ? "bg-destructive text-destructive-foreground" :
    warningCount  > 0 ? "bg-orange-500 text-white" :
    "bg-primary text-primary-foreground";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 relative"
        onClick={() => setOpen(true)}
        aria-label="Notificações"
      >
        <Bell className={`h-4 w-4 ${
          criticalCount > 0 ? "text-destructive animate-[wiggle_1s_ease-in-out_infinite]" :
          warningCount  > 0 ? "text-orange-500" : ""
        }`} />
        {total > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${badgeColor}`}>
            {total > 9 ? "9+" : total}
          </span>
        )}
      </Button>

      <NotificationDrawer
        open={open}
        onClose={() => setOpen(false)}
        notifications={notifications}
        criticalCount={criticalCount}
        warningCount={warningCount}
      />
    </>
  );
}
