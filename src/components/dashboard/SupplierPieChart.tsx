// src/components/dashboard/SupplierPieChart.tsx
"use client";

import type { FC } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PieChartDataItem {
  name: string;
  value: number;
  fill: string; // Color for the slice
}

interface SupplierPieChartProps {
  data: PieChartDataItem[];
}

const CustomTooltip: FC<any> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <p className="text-sm font-medium text-foreground">{`${payload[0].name} : USD ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
      </div>
    );
  }
  return null;
};

const SupplierPieChartComponent: FC<SupplierPieChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-center text-muted-foreground">No data to display.</p>;
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
          // label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} // Optional: Show labels on slices
          outerRadius={120} // Increased outerRadius
          innerRadius={60} // Create a donut chart effect
          fill="#8884d8"
          dataKey="value"
          stroke="hsl(var(--card))" // Add a border to slices matching card background
          strokeWidth={2}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
        <Legend 
          iconSize={12} 
          wrapperStyle={{ fontSize: '0.875rem', paddingTop: '10px' }} 
          formatter={(value, entry) => <span className="text-foreground/80">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default SupplierPieChartComponent;

    