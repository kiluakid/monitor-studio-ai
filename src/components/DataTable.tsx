import React, { useState, useMemo } from 'react';
import { PurchaseRequest, PurchaseOrder } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { Search, Filter } from 'lucide-react';

interface DataTableProps {
  type: 'sc' | 'pc';
  data: (PurchaseRequest | PurchaseOrder)[];
}

export function DataTable({ type, data }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFilial, setFilterFilial] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'category' | 'filial'>('date');

  // Extract unique filiais
  const filiais = useMemo(() => {
    const fSet = new Set<string>();
    data.forEach(item => {
       const key = Object.keys(item._raw || {}).find(k => k.toLowerCase() === 'filial');
       if (key && item._raw && item._raw[key]) fSet.add(String(item._raw[key]));
    });
    return Array.from(fSet).sort();
  }, [data]);

  // Extract unique categories
  const categories = useMemo(() => Array.from(new Set(data.map(item => item.category))), [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Search
      let searchStr = type === 'sc' 
        ? `${(item as PurchaseRequest).id} ${(item as PurchaseRequest).product} ${item.category}`.toLowerCase()
        : `${(item as PurchaseOrder).id} ${(item as PurchaseOrder).supplier} ${item.category}`.toLowerCase();
      
      if (item._raw) {
         searchStr += ' ' + Object.values(item._raw).map(val => String(val).toLowerCase()).join(' ');
      }
      
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
      const matchesFilial = filterFilial === 'All' || (() => {
         const key = Object.keys(item._raw || {}).find(k => k.toLowerCase() === 'filial');
         return key && item._raw && String(item._raw[key]) === filterFilial;
      })();
      
      return matchesSearch && matchesCategory && matchesFilial;
    }).sort((a, b) => {
      if (sortBy === 'date') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'category') return a.category.localeCompare(b.category);
      if (sortBy === 'filial') {
         const filialA = String(a._raw?.['Filial'] || a.category || '').toLowerCase();
         const filialB = String(b._raw?.['Filial'] || b.category || '').toLowerCase();
         return filialA.localeCompare(filialB);
      }
      return 0;
    });
  }, [data, searchTerm, filterFilial, filterCategory, sortBy, type]);

  const dynamicColumns = useMemo(() => {
    if (data.length > 0 && data[0]._raw) {
      const keys = new Set<string>();
      data.slice(0, 50).forEach(item => {
        if (item._raw) {
          Object.keys(item._raw).forEach(k => {
             const keyLower = k.trim().toLowerCase();
             if (!keyLower.includes('empty') && !keyLower.includes('listagem do browse')) {
                keys.add(k);
             }
          });
        }
      });
      return Array.from(keys);
    }
    return null;
  }, [data]);

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header & Filters */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-950 space-y-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-5 h-5" />
            <input
              type="text"
              placeholder={`Pesquisar ${type === 'sc' ? 'solicitações...' : 'pedidos...'}`}
              className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-neutral-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

         <div className="flex flex-wrap gap-4 items-center text-sm">
            <div className="flex items-center space-x-2 text-neutral-400 font-medium shrink-0">
               <Filter className="w-4 h-4" />
               <span>Filtros:</span>
            </div>
            <select
              value={filterFilial}
              onChange={(e) => setFilterFilial(e.target.value)}
              className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-md outline-none focus:border-indigo-500 max-w-[200px] truncate"
              title={filterFilial}
            >
              <option value="All">Todas Filiais</option>
              {filiais.map((f, i) => <option key={i} value={f}>{f}</option>)}
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-md outline-none focus:border-indigo-500"
            >
              <option value="All">Todas Categorias</option>
              {categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
            </select>

            <div className="h-6 w-px bg-neutral-800 hidden md:block"></div>
            
             <select
                 value={sortBy}
                 onChange={(e) => setSortBy(e.target.value as any)}
                 className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-md outline-none focus:border-indigo-500 font-medium"
               >
                 <option value="date">Ordenar por Data</option>
                 <option value="filial">Ordenar por Filial</option>
                 <option value="category">Ordenar por Categoria</option>
               </select>
         </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-800/50 border-b border-neutral-800 text-neutral-400 text-sm">
              {dynamicColumns ? (
                dynamicColumns.map((col, idx) => (
                  <th key={idx} className="py-3 px-4 font-semibold whitespace-nowrap">{col}</th>
                ))
              ) : null}
            </tr>
          </thead>
          <tbody className="align-top">
             {filteredData.length === 0 ? (
                <tr>
                   <td colSpan={dynamicColumns ? dynamicColumns.length : 1} className="py-8 text-center text-neutral-500">
                      Nenhum registro encontrado.
                   </td>
                </tr>
             ) : (
                filteredData.map((item, index) => (
                  <tr key={index} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                    {dynamicColumns ? (
                      dynamicColumns.map((col, idx) => {
                         const value = item._raw?.[col];
                         let displayValue = '-';
                         
                         if (value !== undefined && value !== null) {
                            const colLower = col.toLowerCase();
                            const isDateCol = colLower.includes('dt') || colLower.includes('data') || colLower.includes('emissão') || colLower.includes('emissao') || colLower.includes('entrega') || colLower.includes('previsao');
                            
                            if (isDateCol && typeof value === 'number' && value > 10000) {
                               const date = new Date(Math.round((value - 25569) * 86400 * 1000));
                               displayValue = date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                            } else {
                               displayValue = String(value);
                            }
                         }

                         return (
                           <td key={idx} className="py-3 px-4 text-sm text-neutral-300 whitespace-nowrap">
                             {displayValue}
                           </td>
                         );
                      })
                    ) : null}
                  </tr>
                ))
             )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-neutral-800 bg-neutral-950 text-xs text-neutral-500 text-right">
        Total Exibido: {filteredData.length}
      </div>
    </div>
  );
}
