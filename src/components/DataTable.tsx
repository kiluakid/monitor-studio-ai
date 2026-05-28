import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { PurchaseRequest, PurchaseOrder } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { Download, Search, Filter } from 'lucide-react';

interface DataTableProps {
  type: 'sc' | 'pc';
  data: (PurchaseRequest | PurchaseOrder)[];
}

export function DataTable({ type, data }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterUrgency, setFilterUrgency] = useState('All'); // Only applies to SC
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'urgency' | 'category'>('date');

  // Extract unique categories
  const categories = useMemo(() => Array.from(new Set(data.map(item => item.category))), [data]);
  
  // Extract unique statuses
  const statuses = useMemo(() => Array.from(new Set(data.map(item => item.status))), [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Search
      const searchStr = type === 'sc' 
        ? `${(item as PurchaseRequest).id} ${(item as PurchaseRequest).product} ${item.category}`.toLowerCase()
        : `${(item as PurchaseOrder).id} ${(item as PurchaseOrder).supplier} ${item.category}`.toLowerCase();
      
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
      const matchesStatus = filterStatus === 'All' || item.status === filterStatus;
      
      let matchesUrgency = true;
      if (type === 'sc' && filterUrgency !== 'All') {
         matchesUrgency = (item as PurchaseRequest).urgency === filterUrgency;
      }

      return matchesSearch && matchesCategory && matchesStatus && matchesUrgency;
    }).sort((a, b) => {
      if (sortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'category') return a.category.localeCompare(b.category);
      if (sortBy === 'urgency' && type === 'sc') {
         const levels = { 'Crítica': 4, 'Alta': 3, 'Normal': 2, 'Baixa': 1 };
         return (levels[(b as PurchaseRequest).urgency as keyof typeof levels] || 0) - (levels[(a as PurchaseRequest).urgency as keyof typeof levels] || 0);
      }
      return 0;
    });
  }, [data, searchTerm, filterCategory, filterStatus, filterUrgency, sortBy, type]);

  const exportPDF = () => {
    const doc = new jsPDF();
    
    const title = type === 'sc' ? 'Relatório de Solicitações de Compra (MATA110)' : 'Relatório de Pedidos de Compra (MATA121)';
    const filename = type === 'sc' ? 'relatorio_sc.pdf' : 'relatorio_pc.pdf';
    
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
    doc.text(`Total de registros: ${filteredData.length}`, 14, 34);

    if (type === 'sc') {
      const rows = (filteredData as PurchaseRequest[]).map(item => [
        item.id,
        formatDate(item.date),
        item.product,
        item.category,
        item.quantity.toString(),
        item.urgency,
        item.status
      ]);

      (doc as any).autoTable({
        startY: 40,
        head: [['SC', 'Data', 'Produto', 'Categoria', 'Qtd', 'Urgência', 'Status']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }, // blue-500
        styles: { fontSize: 8 }
      });
    } else {
      const rows = (filteredData as PurchaseOrder[]).map(item => [
        item.id,
        item.sc_id || '-',
        formatDate(item.date),
        item.supplier,
        item.category,
        formatCurrency(item.totalValue),
        item.status
      ]);

      (doc as any).autoTable({
        startY: 40,
        head: [['PC', 'Num. SC', 'Data', 'Fornecedor', 'Categoria', 'Valor Total', 'Status']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }, // emerald-500
        styles: { fontSize: 8 }
      });
    }

    doc.save(filename);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header & Filters */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder={`Pesquisar ${type === 'sc' ? 'solicitações...' : 'pedidos...'}`}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={exportPDF}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800"
          >
            <Download className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
        </div>

         <div className="flex flex-wrap gap-4 items-center text-sm">
            <div className="flex items-center space-x-2 text-slate-600 font-medium shrink-0">
               <Filter className="w-4 h-4" />
               <span>Filtros:</span>
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-md outline-none focus:border-primary-500"
            >
              <option value="All">Todas Categorias</option>
              {categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-md outline-none focus:border-primary-500"
            >
              <option value="All">Todos Status</option>
              {statuses.map((s, i) => <option key={i} value={s}>{s}</option>)}
            </select>

            {type === 'sc' && (
               <select
                 value={filterUrgency}
                 onChange={(e) => setFilterUrgency(e.target.value)}
                 className="px-3 py-1.5 bg-white border border-slate-300 rounded-md outline-none focus:border-primary-500"
               >
                 <option value="All">Todas Urgências</option>
                 <option value="Baixa">Baixa</option>
                 <option value="Normal">Normal</option>
                 <option value="Alta">Alta</option>
                 <option value="Crítica">Crítica</option>
               </select>
            )}

            <div className="h-6 w-px bg-slate-300 hidden md:block"></div>
            
             <select
                 value={sortBy}
                 onChange={(e) => setSortBy(e.target.value as any)}
                 className="px-3 py-1.5 bg-white border border-slate-300 rounded-md outline-none focus:border-primary-500 text-slate-600 font-medium"
               >
                 <option value="date">Ordenar por Data</option>
                 <option value="category">Ordenar por Categoria</option>
                 {type === 'sc' && <option value="urgency">Ordenar por Urgência</option>}
               </select>
         </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 text-sm">
              <th className="py-3 px-4 font-semibold whitespace-nowrap">ID</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Data</th>
              {type === 'sc' ? (
                <>
                  <th className="py-3 px-4 font-semibold">Produto</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Categoria</th>
                  <th className="py-3 px-4 font-semibold">Qtd</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Urgência</th>
                </>
              ) : (
                <>
                  <th className="py-3 px-4 font-semibold">Fornecedor</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Num. SC</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Valor Total</th>
                </>
              )}
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="align-top">
             {filteredData.length === 0 ? (
                <tr>
                   <td colSpan={8} className="py-8 text-center text-slate-500">
                      Nenhum registro encontrado.
                   </td>
                </tr>
             ) : (
                filteredData.map((item, index) => (
                  <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-slate-800 whitespace-nowrap">{item.id}</td>
                    <td className="py-3 px-4 text-sm text-slate-500 whitespace-nowrap">{formatDate(item.date)}</td>
                    
                    {type === 'sc' ? (
                      <>
                        <td className="py-3 px-4 text-sm text-slate-800">{(item as PurchaseRequest).product}</td>
                        <td className="py-3 px-4 text-sm text-slate-500 whitespace-nowrap">{item.category}</td>
                        <td className="py-3 px-4 text-sm text-slate-800">{(item as PurchaseRequest).quantity}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                           <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border
                              ${(item as PurchaseRequest).urgency === 'Crítica' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                (item as PurchaseRequest).urgency === 'Alta' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                (item as PurchaseRequest).urgency === 'Baixa' ? 'bg-slate-50 text-slate-700 border-slate-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'
                              }
                           `}>
                              {(item as PurchaseRequest).urgency}
                           </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4 text-sm text-slate-800">{(item as PurchaseOrder).supplier}</td>
                        <td className="py-3 px-4 text-sm text-slate-500 whitespace-nowrap">{(item as PurchaseOrder).sc_id}</td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-800 whitespace-nowrap">
                          {formatCurrency((item as PurchaseOrder).totalValue)}
                        </td>
                      </>
                    )}
                    
                    <td className="py-3 px-4 whitespace-nowrap">
                       <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {item.status}
                       </span>
                    </td>
                  </tr>
                ))
             )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 text-right">
        Total Exibido: {filteredData.length}
      </div>
    </div>
  );
}
