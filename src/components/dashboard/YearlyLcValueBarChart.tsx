
// src/components/dashboard/YearlyLcValueBarChart.tsx
"use client";

import type { FC } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface YearlyLcValue {
  year: string;
  totalValue: number | null;
}

interface YearlyLcValueBarChartProps {
  data: YearlyLcValue[];
}

const CustomTooltip: FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <p className="text-sm font-medium text-foreground">{`Year ${label}`}</p>
        <p className="text-sm text-primary">
          {value === null || value === undefined || isNaN(value) ? 'USD N/A' : `Total L/Cs Values: USD ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </p>
      </div>
    );
  }
  return null;
};

const yAxisTickFormatter = (value: number) => {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  if (value === 0) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
};

export default function YearlyLcValueBarChart({ data }: YearlyLcValueBarChartProps) {
  if (!data || data.length === 0) {
    return <p className="text-center text-muted-foreground">No yearly L/C value data to display.</p>;
  }

  const chartData = data.map(item => ({
    ...item,
    totalValue: item.totalValue === null || item.totalValue === undefined ? 0 : item.totalValue,
  }));


  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
            dataKey="year"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            stroke="hsl(var(--border))"
        />
        <YAxis
            tickFormatter={yAxisTickFormatter}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            stroke="hsl(var(--border))"
            label={{ value: 'Total Value (USD)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 12, dy: 40 }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}/>
        <Legend wrapperStyle={{ fontSize: '0.875rem', paddingTop: '10px' }} formatter={(value, entry) => <span className="text-foreground/80">{value}</span>} />
        <Bar dataKey="totalValue" name="Total L/C and T/T Value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};
