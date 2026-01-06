import React from 'react';
import { Card } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const alertConfig = {
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50 border-amber-200",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    titleColor: "text-amber-800"
  },
  danger: {
    icon: AlertCircle,
    bg: "bg-red-50 border-red-200",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    titleColor: "text-red-800"
  },
  info: {
    icon: Info,
    bg: "bg-blue-50 border-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    titleColor: "text-blue-800"
  },
  success: {
    icon: CheckCircle,
    bg: "bg-emerald-50 border-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    titleColor: "text-emerald-800"
  }
};

export default function AlertCard({ type = "warning", title, message, action, className }) {
  const config = alertConfig[type];
  const Icon = config.icon;

  return (
    <Card className={cn("p-4 border", config.bg, className)}>
      <div className="flex gap-3">
        <div className={cn("p-2 rounded-lg h-fit", config.iconBg)}>
          <Icon className={cn("w-4 h-4", config.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={cn("font-semibold text-sm", config.titleColor)}>{title}</h4>
          <p className="text-xs text-slate-600 mt-0.5">{message}</p>
          {action && (
            <button className={cn("text-xs font-medium mt-2 hover:underline", config.iconColor)}>
              {action}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}