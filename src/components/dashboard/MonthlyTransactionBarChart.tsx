
// src/components/dashboard/MonthlyTransactionBarChart.tsx
"use client";

import type { FC } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MonthlyChartData {
  name: string; // Month name e.g., "Jan"
  debits: number;
  credits: number;
}

interface MonthlyTransactionBarChartProps {
  data: MonthlyChartData[];
}

const CustomTooltip: FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-green-600 dark:text-green-400">
          Credits: {payload[0].value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-red-600 dark:text-red-400">
          Debits: {payload[1].value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

const yAxisTickFormatter = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
};


export const MonthlyTransactionBarChart: FC<MonthlyTransactionBarChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-center text-muted-foreground">No transaction data available for this period.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
        <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} stroke="hsl(var(--border))" />
        <YAxis tickFormatter={yAxisTickFormatter} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} stroke="hsl(var(--border))"/>
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
        <Legend wrapperStyle={{ fontSize: '0.875rem', paddingTop: '10px' }} formatter={(value) => <span className="text-foreground/80">{value}</span>}/>
        <Bar dataKey="credits" name="Total Credits" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="debits" name="Total Debits" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MonthlyTransactionBarChart;
