
"use client";

import * as React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface ChartData {
  name: string;
  present: number;
  absent: number;
  delay: number;
  leave: number;
  weekend: number;
  holiday: number;
}

interface AttendanceSummaryChartProps {
  data: ChartData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
        <p className="font-bold mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {`${entry.name}: ${entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const AttendanceSummaryChart: React.FC<AttendanceSummaryChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{
          top: 20, right: 30, left: 20, bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} label={{ value: 'Attendance Count', angle: -90, position: 'insideLeft' }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
        <Bar dataKey="present" stackId="a" fill="#2ecc71" name="Present" />
        <Bar dataKey="delay" stackId="a" fill="#f1c40f" name="Delay" />
        <Bar dataKey="leave" stackId="a" fill="#3498db" name="Leave" />
        <Bar dataKey="absent" stackId="a" fill="#e74c3c" name="Absent" />
        <Bar dataKey="weekend" stackId="a" fill="#9b59b6" name="Weekend" />
        <Bar dataKey="holiday" stackId="a" fill="#1abc9c" name="Holiday" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default AttendanceSummaryChart;
