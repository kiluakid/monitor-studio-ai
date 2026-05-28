import React, { useMemo } from 'react';
import { AppState } from '../types';
import { formatCurrency } from '../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { FileText, ShoppingCart, AlertCircle, CheckCircle2 } from 'lucide-react';

interface DashboardProps {
  state: AppState;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function Dashboard({ state }: DashboardProps) {
  const { purchaseRequests, purchaseOrders } = state;

  const totalSC = purchaseRequests.length;
  const totalPC = purchaseOrders.length;
  const totalValuePC = purchaseOrders.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
  const criticalSC = purchaseRequests.filter(sc => sc.urgency === 'Crítica').length;

  const scByCategory = useMemo(() => {
    const counts = purchaseRequests.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name || 'Não Definida', value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5
  }, [purchaseRequests]);

  const pcByStatus = useMemo(() => {
    const counts = purchaseOrders.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [purchaseOrders]);

  const recentOrders = useMemo(() => {
    return [...purchaseOrders]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [purchaseOrders]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Cards */}
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-900/30 text-blue-400 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-neutral-400 font-medium">Total de SCs</p>
            <h3 className="text-2xl font-bold text-white">{totalSC}</h3>
          </div>
        </div>
        
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-900/30 text-emerald-400 rounded-lg">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-neutral-400 font-medium">Total de PCs</p>
            <h3 className="text-2xl font-bold text-white">{totalPC}</h3>
          </div>
        </div>

        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-indigo-900/30 text-indigo-400 rounded-lg">
             <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-neutral-400 font-medium">Valor Total Recebido (PC)</p>
            <h3 className="text-2xl font-bold text-white">{formatCurrency(totalValuePC)}</h3>
          </div>
        </div>

        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-rose-900/30 text-rose-400 rounded-lg">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-neutral-400 font-medium">SCs Críticas</p>
            <h3 className="text-2xl font-bold text-white">{criticalSC}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charts */}
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-sm">
          <h3 className="text-lg font-semibold text-white mb-4">Top 5 Categorias (SC)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scByCategory} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a3a3a3' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a3a3a3' }} />
                <Tooltip cursor={{ fill: '#171717' }} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#171717', color: '#fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }} />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-sm">
          <h3 className="text-lg font-semibold text-white mb-4">Status dos Pedidos (PC)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pcByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pcByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#171717', color: '#fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ color: '#a3a3a3' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
