import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  User,
  Users,
  Bug,
  ShieldAlert,
  Rocket,
  FileBarChart2,
  LucideIcon,
} from "lucide-react";

interface TabDef {
  value: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  highlight?: boolean;
}

interface MetricsTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts?: {
    impediments?: number;
    releases?: number;
  };
  children: React.ReactNode;
}

export function MetricsTabs({
  activeTab,
  onTabChange,
  counts = {},
  children,
}: MetricsTabsProps) {
  const tabs: TabDef[] = [
    { value: "individual",  label: "Individual",    icon: User },
    { value: "team",        label: "Time",          icon: Users },
    { value: "quality",     label: "Qualidade",     icon: Bug },
    {
      value: "impediments",
      label: "Impedimentos",
      icon: ShieldAlert,
      count: counts.impediments,
    },
    {
      value: "releases",
      label: "Releases",
      icon: Rocket,
      count: counts.releases,
    },
    {
      value: "reports",
      label: "Relatórios",
      icon: FileBarChart2,
      highlight: true,
    },
  ];

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-4">
      {/* TabsList com scroll horizontal no mobile */}
      <div className="relative">
        <TabsList
          className={cn(
            "flex w-full h-auto p-1 gap-0.5",
            "overflow-x-auto scrollbar-none",
            "bg-muted/60 rounded-2xl",
          )}
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium",
                "whitespace-nowrap shrink-0 transition-all",
                "data-[state=active]:bg-background data-[state=active]:shadow-sm",
                tab.highlight && "text-primary data-[state=active]:text-primary",
              )}
            >
              <tab.icon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center",
                    "h-4 min-w-4 px-1 rounded-full text-[10px] font-bold",
                    tab.value === "impediments"
                      ? "bg-[#eab308]/20 text-[#eab308]"
                      : "bg-primary/15 text-primary",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {children}
    </Tabs>
  );
}

export { TabsContent };
