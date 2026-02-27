"use client";

import React, { useState, useMemo } from "react";
import { startOfDay, subDays, endOfDay, format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart2 } from "lucide-react";

// Date range options
const DATE_RANGES = {
  "7D": { label: "Last 7 Days", days: 7 },
  "1M": { label: "Last Month", days: 30 },
  "3M": { label: "Last 3 Months", days: 90 },
  "6M": { label: "Last 6 Months", days: 180 },
  ALL: { label: "All Time", days: null },
};

export default function AccountChart({ transactions }) {
  const [dateRange, setDateRange] = useState("1M");

  // Filter + group transactions
  const filteredData = useMemo(() => {
    const range = DATE_RANGES[dateRange];
    const now = new Date();

    const startDate = range.days
      ? startOfDay(subDays(now, range.days))
      : startOfDay(new Date(0));

    // Filter within date range
    const filtered = transactions.filter(
      (t) => new Date(t.date) >= startDate && new Date(t.date) <= endOfDay(now)
    );

    // Group by day
    const grouped = filtered.reduce((acc, transaction) => {
      const fullDate = startOfDay(new Date(transaction.date));
      const key = format(fullDate, "MMM dd"); // e.g., "Aug 20"

      if (!acc[key]) {
        acc[key] = {
          date: key,
          timestamp: fullDate.getTime(),
          income: 0,
          expense: 0,
        };
      }

      if (transaction.type === "INCOME") {
        acc[key].income += transaction.amount;
      } else {
        acc[key].expense += transaction.amount;
      }

      return acc;
    }, {});

    // Convert to array + sort chronologically
    return Object.values(grouped).sort((a, b) => a.timestamp - b.timestamp);
  }, [transactions, dateRange]);

  // Totals calculation
  const totals = filteredData.reduce(
    (acc, day) => ({
      income: acc.income + day.income,
      expense: acc.expense + day.expense,
    }),
    { income: 0, expense: 0 }
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
            <BarChart2 className="h-4 w-4 text-indigo-600" />
          </div>
          <h2 className="text-sm font-bold text-gray-800">Transaction Overview</h2>
        </div>
        {/* Pill date-range buttons */}
        <div className="flex gap-1">
          {Object.entries(DATE_RANGES).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setDateRange(key)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all duration-150 ${dateRange === key
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
            >
              {key === "ALL" ? "All" : key}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Chart */}
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={filteredData}
              margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#9ca3af" }}
              />
              <YAxis
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#9ca3af" }}
                tickFormatter={(value) => `₹${value}`}
              />
              <Tooltip
                formatter={(value, name) => [`₹${value.toFixed(2)}`, name]}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  fontSize: "12px",
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px", color: "#6b7280", paddingTop: "12px" }}
              />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
