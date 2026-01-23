'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { HistoryEntry, Counters } from '@/lib/types';
import { formatMinutes } from '@/lib/calculations';

interface HistoryChartProps {
  history: HistoryEntry[];
  currentCounters: Counters;
}

interface ChartDataPoint {
  date: string;
  dateFormatted: string;
  ca: number;
  cf: number;
  rtc: number;
  rps: number;
  hs: number;
}

const COUNTER_COLORS = {
  ca: '#3b82f6', // blue-500
  cf: '#8b5cf6', // violet-500
  rtc: '#10b981', // emerald-500
  rps: '#f59e0b', // amber-500
  hs: '#ef4444', // red-500
};

export function HistoryChart({ history, currentCounters }: HistoryChartProps) {
  const chartData = useMemo(() => {
    if (history.length === 0) {
      // Si pas d'historique, montrer juste l'état actuel
      const today = new Date().toISOString().split('T')[0];
      return [
        {
          date: today,
          dateFormatted: formatDate(today),
          ca: currentCounters.ca,
          cf: Math.round(currentCounters.cf / 60), // Convertir en heures
          rtc: Math.round(currentCounters.rtc / 60),
          rps: Math.round(currentCounters.rps / 60),
          hs: Math.round(currentCounters.hs / 60),
        },
      ];
    }

    // Construire les données à partir de l'historique
    const sortedHistory = [...history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Grouper par date
    const dataByDate = new Map<string, ChartDataPoint>();

    for (const entry of sortedHistory) {
      const dateKey = entry.date.split('T')[0];
      const snapshot = entry.countersSnapshot;

      if (!dataByDate.has(dateKey) && snapshot) {
        dataByDate.set(dateKey, {
          date: dateKey,
          dateFormatted: formatDate(dateKey),
          ca: snapshot.ca ?? 0,
          cf: Math.round((snapshot.cf ?? 0) / 60),
          rtc: Math.round((snapshot.rtc ?? 0) / 60),
          rps: Math.round((snapshot.rps ?? 0) / 60),
          hs: Math.round((snapshot.hs ?? 0) / 60),
        });
      }
    }

    // Ajouter l'état actuel
    const today = new Date().toISOString().split('T')[0];
    if (!dataByDate.has(today)) {
      dataByDate.set(today, {
        date: today,
        dateFormatted: formatDate(today),
        ca: currentCounters.ca,
        cf: Math.round(currentCounters.cf / 60),
        rtc: Math.round(currentCounters.rtc / 60),
        rps: Math.round(currentCounters.rps / 60),
        hs: Math.round(currentCounters.hs / 60),
      });
    }

    return Array.from(dataByDate.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [history, currentCounters]);

  if (chartData.length < 2) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p className="text-sm">Pas assez de données pour afficher le graphique.</p>
        <p className="text-xs mt-1">Posez des congés pour voir l'évolution.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="dateFormatted"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value, name) => {
              if (name === 'ca') return [`${value}j`, 'CA'];
              return [`${value}h`, String(name).toUpperCase()];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px' }}
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                ca: 'CA (jours)',
                cf: 'CF (heures)',
                rtc: 'RTC (heures)',
                rps: 'RPS (heures)',
                hs: 'HS (heures)',
              };
              return labels[value] || value;
            }}
          />
          <Line
            type="monotone"
            dataKey="ca"
            stroke={COUNTER_COLORS.ca}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="cf"
            stroke={COUNTER_COLORS.cf}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="rtc"
            stroke={COUNTER_COLORS.rtc}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="rps"
            stroke={COUNTER_COLORS.rps}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="hs"
            stroke={COUNTER_COLORS.hs}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
