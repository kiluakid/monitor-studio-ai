import React, { useMemo, useState } from 'react';
import { AppState } from '../types';
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
  Cell,
  LabelList,
  Label
} from 'recharts';
import { FileText, ShoppingCart, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface DashboardProps {
  state: AppState;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const MONTHS_LIST = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function Dashboard({ state }: DashboardProps) {
  const { purchaseRequests, purchaseOrders } = state;
  const [selectedYear, setSelectedYear] = useState<string>('Todos');
  const [selectedMonth, setSelectedMonth] = useState<string>('Todos');
  const [selectedYearSc, setSelectedYearSc] = useState<string>('Todos');
  const [selectedMonthSc, setSelectedMonthSc] = useState<string>('Todos');

  const availableYears = useMemo(() => {
     const years = new Set<string>();
     purchaseOrders.forEach(pc => {
         const d = new Date(pc.date);
         if (!isNaN(d.getTime())) {
             years.add(d.getFullYear().toString());
         }
     });
     return Array.from(years).sort().reverse();
  }, [purchaseOrders]);

  const availableYearsSc = useMemo(() => {
     const years = new Set<string>();
     purchaseRequests.forEach(sc => {
         const d = new Date(sc.date);
         if (!isNaN(d.getTime())) {
             years.add(d.getFullYear().toString());
         }
     });
     return Array.from(years).sort().reverse();
  }, [purchaseRequests]);

  const totalSC = purchaseRequests.length;
  const totalPC = purchaseOrders.length;
  
  const latePCs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return purchaseOrders.filter(pc => {
      if (pc.status === 'Recebido' || pc.status === 'Cancelado') return false;
      
      let dDate: Date | null = null;
      if (pc.deliveryDate && pc.deliveryDate !== '-') {
        dDate = new Date(pc.deliveryDate);
      } else if (pc._raw) {
         const key = Object.keys(pc._raw).find(k => k.toLowerCase().includes('entrega') || k.toLowerCase().includes('previsao'));
         if (key && pc._raw[key]) {
            const val = pc._raw[key];
            if (typeof val === 'number' && val > 10000) {
              dDate = new Date(Math.round((val - 25569) * 86400 * 1000));
            } else {
              dDate = new Date(val);
            }
         }
      }
      
      if (!dDate || isNaN(dDate.getTime())) return false;
      return dDate.getTime() < today.getTime();
    }).length;
  }, [purchaseOrders]);

  const criticalSC = purchaseRequests.filter(sc => sc.urgency === 'Crítica').length;

  const { chartData, filiaisLegenda } = useMemo(() => {
    const filiaisSet = new Set<string>();
    
    const filteredOrders = purchaseOrders.filter(curr => {
       const date = new Date(curr.date);
       if (isNaN(date.getTime())) return false;
       if (selectedYear !== 'Todos' && date.getFullYear().toString() !== selectedYear) return false;
       if (selectedMonth !== 'Todos' && MONTHS_LIST[date.getMonth()] !== selectedMonth) return false;
       return true;
    });

    const aggregated = filteredOrders.reduce((acc, curr) => {
      const date = new Date(curr.date);
      const monthIdx = date.getMonth();
      const monthName = MONTHS_LIST[monthIdx];
      
      let filial = 'Geral';
      if (curr._raw) {
         const key = Object.keys(curr._raw).find(k => k.toLowerCase() === 'filial');
         if (key && curr._raw[key]) {
             filial = String(curr._raw[key]);
         }
      }
      filiaisSet.add(filial);
      
      if (!acc[monthName]) {
         acc[monthName] = { name: monthName, _uniqueIds: {} };
      }
      if (!acc[monthName]._uniqueIds[filial]) {
         acc[monthName]._uniqueIds[filial] = new Set<string>();
      }
      
      acc[monthName]._uniqueIds[filial].add(curr.id);
      acc[monthName][filial] = acc[monthName]._uniqueIds[filial].size;
      return acc;
    }, {} as Record<string, any>);
    
    const data = [];
    if (selectedMonth !== 'Todos') {
       data.push(aggregated[selectedMonth] || { name: selectedMonth });
    } else {
      let lastMonthIdx = -1;
      for (let i = 11; i >= 0; i--) {
          if (aggregated[MONTHS_LIST[i]]) {
              lastMonthIdx = i;
              break;
          }
      }
      if (lastMonthIdx !== -1) {
          for(let i = 0; i <= lastMonthIdx; i++) {
             data.push(aggregated[MONTHS_LIST[i]] || { name: MONTHS_LIST[i] });
          }
      } else {
          data.push(...MONTHS_LIST.map(m => ({ name: m })));
      }
    }
    
    return { 
      chartData: data,
      filiaisLegenda: Array.from(filiaisSet).sort() 
    };
  }, [purchaseOrders, selectedYear, selectedMonth]);

  const { chartDataSc, filiaisLegendaSc } = useMemo(() => {
    const filiaisSet = new Set<string>();
    
    const filteredRequests = purchaseRequests.filter(curr => {
       const date = new Date(curr.date);
       if (isNaN(date.getTime())) return false;
       if (selectedYearSc !== 'Todos' && date.getFullYear().toString() !== selectedYearSc) return false;
       if (selectedMonthSc !== 'Todos' && MONTHS_LIST[date.getMonth()] !== selectedMonthSc) return false;
       return true;
    });

    const aggregated = filteredRequests.reduce((acc, curr) => {
      const date = new Date(curr.date);
      const monthIdx = date.getMonth();
      const monthName = MONTHS_LIST[monthIdx];
      
      let filial = 'Geral';
      if (curr._raw) {
         const key = Object.keys(curr._raw).find(k => k.toLowerCase() === 'filial');
         if (key && curr._raw[key]) {
             filial = String(curr._raw[key]);
         }
      }
      filiaisSet.add(filial);
      
      if (!acc[monthName]) {
         acc[monthName] = { name: monthName, _uniqueIds: {} };
      }
      if (!acc[monthName]._uniqueIds[filial]) {
         acc[monthName]._uniqueIds[filial] = new Set<string>();
      }
      
      acc[monthName]._uniqueIds[filial].add(curr.id);
      acc[monthName][filial] = acc[monthName]._uniqueIds[filial].size;
      return acc;
    }, {} as Record<string, any>);
    
    const data = [];
    if (selectedMonthSc !== 'Todos') {
       data.push(aggregated[selectedMonthSc] || { name: selectedMonthSc });
    } else {
      let lastMonthIdx = -1;
      for (let i = 11; i >= 0; i--) {
          if (aggregated[MONTHS_LIST[i]]) {
              lastMonthIdx = i;
              break;
          }
      }
      if (lastMonthIdx !== -1) {
          for(let i = 0; i <= lastMonthIdx; i++) {
             data.push(aggregated[MONTHS_LIST[i]] || { name: MONTHS_LIST[i] });
          }
      } else {
          data.push(...MONTHS_LIST.map(m => ({ name: m })));
      }
    }
    
    return { 
      chartDataSc: data,
      filiaisLegendaSc: Array.from(filiaisSet).sort() 
    };
  }, [purchaseRequests, selectedYearSc, selectedMonthSc]);

  const pendingPcByMonth = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const pendingOrders = purchaseOrders.filter(pc => pc.status !== 'Recebido' && pc.status !== 'Cancelado');
    
    const counts = pendingOrders.reduce((acc, curr) => {
      const date = new Date(curr.date);
      if (!isNaN(date.getTime())) {
          const monthIdx = date.getMonth();
          const monthName = months[monthIdx];
          acc[monthName] = (acc[monthName] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => months.indexOf(a.name) - months.indexOf(b.name));
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
          <div className="p-3 bg-rose-900/30 text-rose-400 rounded-lg">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-neutral-400 font-medium">SCs Críticas</p>
            <h3 className="text-2xl font-bold text-white">{criticalSC}</h3>
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
          <div className="p-3 bg-amber-900/30 text-amber-400 rounded-lg">
             <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-neutral-400 font-medium">PCs Atrasados</p>
            <h3 className="text-2xl font-bold text-white">{latePCs}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charts */}
        <div className="bg-[#404040] p-6 rounded-xl border border-neutral-700 shadow-sm col-span-1 lg:col-span-2">
          <div className="flex flex-col md:flex-row items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white mb-4 md:mb-0 text-center md:text-left">Itens em pedido de compra por data de emissão</h3>
            <div className="flex items-center space-x-3">
              <select
                className="bg-neutral-800 text-white text-sm border-neutral-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="Todos">Ano: Todos</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select 
                className="bg-neutral-800 text-white text-sm border-neutral-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="Todos">Mês: Todos</option>
                {MONTHS_LIST.map(m => (
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="h-96 w-full pb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 30, right: 30, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#525252" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#d4d4d4' }} tickMargin={10}>
                   <Label value={selectedYear !== 'Todos' ? selectedYear : 'Todos os Anos'} offset={-20} position="insideBottom" fill="#d4d4d4" fontSize={13} />
                </XAxis>
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#d4d4d4' }} />
                <Tooltip cursor={{ fill: '#525252', opacity: 0.4 }} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#262626', color: '#fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }} />
                <Legend verticalAlign="middle" align="right" layout="vertical" wrapperStyle={{ paddingLeft: '20px', fontSize: '13px', color: '#d4d4d4' }} iconType="square" />
                {filiaisLegenda.map((filial, idx) => (
                  <Bar 
                    key={filial} 
                    dataKey={filial} 
                    fill={COLORS[idx % COLORS.length]}
                  >
                    <LabelList dataKey={filial} position="top" fill="#d4d4d4" fontSize={13} formatter={(val: any) => val > 0 ? val : ''} />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#404040] p-6 rounded-xl border border-neutral-700 shadow-sm col-span-1 lg:col-span-2">
          <div className="flex flex-col md:flex-row items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white mb-4 md:mb-0 text-center md:text-left">Itens em solicitação de compra por data de emissão</h3>
            <div className="flex items-center space-x-3">
              <select
                className="bg-neutral-800 text-white text-sm border-neutral-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                value={selectedYearSc}
                onChange={(e) => setSelectedYearSc(e.target.value)}
              >
                <option value="Todos">Ano: Todos</option>
                {availableYearsSc.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select 
                className="bg-neutral-800 text-white text-sm border-neutral-700 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                value={selectedMonthSc}
                onChange={(e) => setSelectedMonthSc(e.target.value)}
              >
                <option value="Todos">Mês: Todos</option>
                {MONTHS_LIST.map(m => (
                  <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="h-96 w-full pb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataSc} margin={{ top: 30, right: 30, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#525252" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#d4d4d4' }} tickMargin={10}>
                   <Label value={selectedYearSc !== 'Todos' ? selectedYearSc : 'Todos os Anos'} offset={-20} position="insideBottom" fill="#d4d4d4" fontSize={13} />
                </XAxis>
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#d4d4d4' }} />
                <Tooltip cursor={{ fill: '#525252', opacity: 0.4 }} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#262626', color: '#fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)' }} />
                <Legend verticalAlign="middle" align="right" layout="vertical" wrapperStyle={{ paddingLeft: '20px', fontSize: '13px', color: '#d4d4d4' }} iconType="square" />
                {filiaisLegendaSc.map((filial, idx) => (
                  <Bar 
                    key={filial} 
                    dataKey={filial} 
                    fill={COLORS[idx % COLORS.length]}
                  >
                    <LabelList dataKey={filial} position="top" fill="#d4d4d4" fontSize={13} formatter={(val: any) => val > 0 ? val : ''} />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
