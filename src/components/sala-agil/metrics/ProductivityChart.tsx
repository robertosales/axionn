import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, CHART_TOOLTIP_STYLE, CHART_LEGEND_STYLE } from "./tokens";

type ChartType = "bar" | "line" | "pie" | "donut" | "radar";

interface ProductivityChartProps {
  type: ChartType;
  data: any[];
  title: string;
  subtitle?: string;
  dataKeys?: { key: string; name?: string; color?: string }[];
  nameKey?: string;
  valueKey?: string;
  radarKeys?: string[];
  radarAngleKey?: string;
  height?: number;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
      <BarChart2 className="h-8 w-8 mb-2 opacity-30" />
      <p className="text-xs">Sem dados suficientes</p>
    </div>
  );
}

export function ProductivityChart({
  type,
  data,
  title,
  subtitle,
  dataKeys = [],
  nameKey = "name",
  valueKey = "value",
  radarKeys = [],
  radarAngleKey = "metric",
  height = 260,
  loading = false,
  className,
  children,
}: ProductivityChartProps) {
  const isEmpty = !data || data.length === 0;

  const renderChart = () => {
    if (isEmpty) return <EmptyChart />;

    switch (type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
              <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Legend {...CHART_LEGEND_STYLE} />
              {dataKeys.map((dk, i) => (
                <Bar
                  key={dk.key}
                  dataKey={dk.key}
                  name={dk.name ?? dk.key}
                  fill={dk.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
              <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Legend {...CHART_LEGEND_STYLE} />
              {dataKeys.map((dk, i) => (
                <Line
                  key={dk.key}
                  type="monotone"
                  dataKey={dk.key}
                  name={dk.name ?? dk.key}
                  stroke={dk.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case "pie":
      case "donut": {
        const innerRadius = type === "donut" ? 45 : 0;
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                dataKey={valueKey}
                nameKey={nameKey}
                cx="50%" cy="50%"
                innerRadius={innerRadius}
                outerRadius={80}
                paddingAngle={type === "donut" ? 3 : 1}
                label={type === "pie" ? ({ name, value }) => `${name}: ${value}` : false}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Legend {...CHART_LEGEND_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        );
      }

      case "radar": {
        const memberColors = CHART_COLORS;
        return (
          <ResponsiveContainer width="100%" height={height}>
            <RadarChart data={data}>
              <PolarGrid />
              <PolarAngleAxis dataKey={radarAngleKey} tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Legend {...CHART_LEGEND_STYLE} />
              {radarKeys.map((key, i) => (
                <Radar
                  key={key}
                  name={key}
                  dataKey={key}
                  stroke={memberColors[i % memberColors.length]}
                  fill={memberColors[i % memberColors.length]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Card className={cn("border border-border/60 shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className={`w-full rounded-lg`} style={{ height }} /> : renderChart()}
        {children}
      </CardContent>
    </Card>
  );
}
