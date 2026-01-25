import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Briefcase, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function DemandaMetricsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon = TrendingUp,
  trend,
  color = 'violet'
}) {
  const colorClasses = {
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100'
  };

  const iconColorClasses = {
    violet: 'bg-violet-100',
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    red: 'bg-red-100',
    amber: 'bg-amber-100'
  };

  return (
    <Card className={cn("border", colorClasses[color])}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-600">
            {title}
          </CardTitle>
          <div className={cn("p-2 rounded-lg", iconColorClasses[color])}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {value}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {trend && (
            <div className={cn(
              "text-xs font-semibold px-2 py-1 rounded",
              trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}>
              {trend > 0 ? '+' : ''}{trend}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}