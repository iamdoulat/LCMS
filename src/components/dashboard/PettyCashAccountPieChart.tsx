
// src/components/dashboard/PettyCashAccountPieChart.tsx
"use client";

import type { FC } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PieChartDataItem {
  name: string;
  value: number;
  fill: string;
}

interface PettyCashAccountPieChartProps {
  data: PieChartDataItem[];
}

const CustomTooltip: FC<any> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <p className="text-sm font-medium text-foreground">{`${payload[0].name} : BDT ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
      </div>
    );
  }
  return null;
};

export const PettyCashAccountPieChart: FC<PettyCashAccountPieChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-center text-muted-foreground">No account data to display.</p>;
  }
  
  const PIE_CHART_COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={120}
          innerRadius={60}
          fill="#8884d8"
          dataKey="value"
          stroke="hsl(var(--card))"
          strokeWidth={2}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
        <Legend 
          iconSize={12} 
          wrapperStyle={{ fontSize: '0.875rem', paddingTop: '10px' }} 
          formatter={(value) => <span className="text-foreground/80">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default PettyCashAccountPieChart;
