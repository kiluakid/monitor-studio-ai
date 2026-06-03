import React, { useState, useMemo } from 'react';
import { PurchaseRequest, PurchaseOrder, InventoryItem } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { Search, Filter, X, Download, FileText, FileSpreadsheet } from 'lucide-react';
import * as xlsx from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DataTableProps {
  type: 'sc' | 'pc' | 'inventory';
  data: (PurchaseRequest | PurchaseOrder | InventoryItem)[];
}

export function DataTable({ type, data }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFilial, setFilterFilial] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'date_desc' | 'category' | 'filial'>('date_desc');
  const [selectedItem, setSelectedItem] = useState<(PurchaseRequest | PurchaseOrder) | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Extract unique filiais
  const filiais = useMemo(() => {
    const fSet = new Set<string>();
    data.forEach(item => {
       const keys = Object.keys(item._raw || {});
       let key = keys.find(k => k.toLowerCase().trim() === 'filial');
       if (!key) key = keys.find(k => k.toLowerCase().trim() === 'armazém' || k.toLowerCase().trim() === 'armazem' || k.toLowerCase().trim() === 'local');
       if (key && item._raw && item._raw[key]) {
           const f = String(item._raw[key]).trim();
           if (f) fSet.add(f);
       }
    });
    return Array.from(fSet).sort();
  }, [data]);

  // Extract unique categories (for inventory, maybe we use warehouse as category, or just product description)
  const categories = useMemo(() => {
    const cSet = new Set<string>();
    data.forEach(item => {
      if (type === 'inventory') {
         const keys = Object.keys(item._raw || {});
         const key = keys.find(k => k.toLowerCase().trim() === 'tipo' || k.toLowerCase().trim() === 'tp' || k.toLowerCase().trim() === 'grupo');
         if (key && item._raw && item._raw[key]) cSet.add(String(item._raw[key]).trim());
      } else {
         cSet.add(String((item as any).category || 'Geral').trim());
      }
    });
    return Array.from(cSet).filter(c => c).sort();
  }, [data, type]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Search
      let searchStr = '';
      if (type === 'sc') {
        searchStr = `${(item as PurchaseRequest).id} ${(item as PurchaseRequest).product} ${(item as PurchaseRequest).category}`.toLowerCase();
      } else if (type === 'pc') {
        searchStr = `${(item as PurchaseOrder).id} ${(item as PurchaseOrder).supplier} ${(item as PurchaseOrder).category}`.toLowerCase();
      } else if (type === 'inventory') {
        searchStr = `${(item as InventoryItem).id} ${(item as InventoryItem).description} ${(item as InventoryItem).warehouse}`.toLowerCase();
      }
      
      if ((item as any)._raw) {
         searchStr += ' ' + Object.values((item as any)._raw).map(val => String(val).toLowerCase()).join(' ');
      }
      
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());
      
      let itemCategory = 'Geral';
      if (type === 'sc' || type === 'pc') {
         itemCategory = (item as any).category;
      } else if (type === 'inventory') {
         const keys = Object.keys((item as any)._raw || {});
         const key = keys.find(k => k.toLowerCase().trim() === 'tipo' || k.toLowerCase().trim() === 'tp' || k.toLowerCase().trim() === 'grupo');
         if (key && (item as any)._raw) itemCategory = String((item as any)._raw[key]).trim();
      }
      
      const matchesCategory = filterCategory === 'All' || itemCategory === filterCategory;
      const matchesFilial = filterFilial === 'All' || (() => {
         const keys = Object.keys((item as any)._raw || {});
         let key = keys.find(k => k.toLowerCase().trim() === 'filial');
         if (!key) key = keys.find(k => k.toLowerCase().trim() === 'armazém' || k.toLowerCase().trim() === 'armazem' || k.toLowerCase().trim() === 'local');
         return key && (item as any)._raw && String((item as any)._raw[key]).trim() === filterFilial;
      })();
      
      return matchesSearch && matchesCategory && matchesFilial;
    }).sort((a, b) => {
      const aDate = (a as any).date || '';
      const bDate = (b as any).date || '';
      const aCategory = (type === 'inventory' ? (a as InventoryItem).warehouse : (a as any).category) || '';
      const bCategory = (type === 'inventory' ? (b as InventoryItem).warehouse : (b as any).category) || '';
      
      if (sortBy === 'date') return new Date(aDate).getTime() - new Date(bDate).getTime();
      if (sortBy === 'date_desc') return new Date(bDate).getTime() - new Date(aDate).getTime();
      if (sortBy === 'category') return aCategory.localeCompare(bCategory);
      if (sortBy === 'filial') {
         const filialA = String((a as any)._raw?.['Filial'] || aCategory || '').toLowerCase();
         const filialB = String((b as any)._raw?.['Filial'] || bCategory || '').toLowerCase();
         return filialA.localeCompare(filialB);
      }
      return 0;
    });
  }, [data, searchTerm, filterFilial, filterCategory, sortBy, type]);

  const dynamicColumns = useMemo(() => {
    if (data.length > 0) {
      const keys = new Set<string>();
      data.slice(0, 50).forEach(item => {
        if (item._raw) {
          Object.keys(item._raw).forEach(k => {
             const keyLower = k.trim().toLowerCase();
             if (!keyLower.includes('empty') && !keyLower.includes('listagem do browse') && !k.startsWith('_') && keyLower !== '') {
                keys.add(k.trim());
             }
          });
        }
      });
      let arr = Array.from(keys);
      
      if (type === 'inventory') {
        const INVENTORY_ORDER = [
          "Filial", "Codigo", "Descricao", "Desc. Cientifica", "Tp", "Grupo", 
          "UM", "Saldo Atual", "Empenho", "SCsColocadas", "PCsColocados", 
          "OPsColocadas", "PVsColocados", "Ponto Pedido", "Lote Econom.", 
          "Entrega", "Estoqueem Meses", "Med. Consumo", "DT.Ult.Saida", 
          "CL", "Contr.Endere", "Classe ABC"
        ];
        
        arr.sort((a, b) => {
          const indexA = INVENTORY_ORDER.indexOf(a);
          const indexB = INVENTORY_ORDER.indexOf(b);
          
          if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
          }
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.localeCompare(b);
        });
      }

      if (arr.length > 0) return arr;
      
      // Fallback
      if (type === 'inventory') {
         return ['id', 'description', 'warehouse', 'quantity', 'unitValue', 'totalValue', 'date'];
      }
    }
    return null;
  }, [data, type]);

  const inventoryGroups = useMemo(() => {
    if (type !== 'inventory' || !filteredData || filteredData.length === 0) return [];
    
    const groupsMap = new Map<string, any[]>();
    
    // Find keys once if possible, or cache them per variation of item._raw keys
    const filialKeyCache = new Map<string, string | undefined>();
    const tipoKeyCache = new Map<string, string | undefined>();

    for (const item of filteredData) {
        let filial = 'Sem Filial';
        let tipo = 'Geral';
        if (item._raw) {
            const rawKeysStr = Object.keys(item._raw).join(',');
            
            let filialKey = filialKeyCache.get(rawKeysStr);
            let tipoKey = tipoKeyCache.get(rawKeysStr);

            if (!filialKeyCache.has(rawKeysStr)) {
                const keys = Object.keys(item._raw);
                filialKey = keys.find(k => { const l = k.toLowerCase().trim(); return l === 'filial' || l === 'armazem' || l === 'armazém' || l === 'local'; });
                tipoKey = keys.find(k => { const l = k.toLowerCase().trim(); return l === 'tp' || l === 'tipo' || l === 'grupo'; });
                filialKeyCache.set(rawKeysStr, filialKey);
                tipoKeyCache.set(rawKeysStr, tipoKey);
            }
            
            if (filialKey && item._raw[filialKey]) filial = String(item._raw[filialKey]).trim();
            if (tipoKey && item._raw[tipoKey]) tipo = String(item._raw[tipoKey]).trim();
        }
        const key = filial;
        
        let arr = groupsMap.get(key);
        if (!arr) {
            arr = [];
            groupsMap.set(key, arr);
        }
        arr.push(item);
    }
    
    return Array.from(groupsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredData, type]);

  const columnMetadata = useMemo(() => {
    if (!dynamicColumns) return {};
    const meta: Record<string, { isDateCol: boolean; isCurrencyCol: boolean; isNumericCol: boolean }> = {};
    dynamicColumns.forEach(col => {
      const colLower = col.toLowerCase();
      const isDateCol = colLower.includes('dt') || colLower.includes('data') || colLower.includes('emissão') || colLower.includes('emissao') || colLower.includes('entrega') || colLower.includes('previsao');
      const isCurrencyCol = colLower.includes('valor') || colLower.includes('custo') || colLower.includes('empenho');
      const isNumericCol = colLower.includes('saldo') || isCurrencyCol || colLower.includes('ponto') || colLower.includes('meses') || colLower.includes('med.') || colLower.includes('quant') || colLower.includes('lote econom.');
      
      meta[col] = { isDateCol, isCurrencyCol, isNumericCol };
    });
    return meta;
  }, [dynamicColumns]);

  const handleExport = () => {
    if (!filteredData || filteredData.length === 0) return;
    
    // Converte os dados filtrados para um formato para o Excel.
    // Iremos usar as chaves originais do ._raw se disponível
    const exportData = filteredData.map(item => {
      const rawData = item._raw || {};
      const formattedRow: any = {};
      
      // Aqui usamos dynamicColumns para extrair os campos que estão aparecendo na tabela
      if (dynamicColumns) {
        dynamicColumns.forEach(col => {
           const value = rawData[col];
           let displayValue: any = value;
           
           if (value !== undefined && value !== null) {
              const colLower = col.toLowerCase();
              const isDateCol = colLower.includes('dt') || colLower.includes('data') || colLower.includes('emissão') || colLower.includes('emissao') || colLower.includes('entrega') || colLower.includes('previsao');
              
              if (isDateCol && typeof value === 'number' && value > 10000) {
                 displayValue = new Date(Math.round((value - 25569) * 86400 * 1000)).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
              }
           } else {
             displayValue = ''; // Preenche com vazio se for undefined
           }
           
           formattedRow[col] = displayValue;
        });
      } else {
        // Fallback case sem _raw
        Object.assign(formattedRow, item);
      }
      return formattedRow;
    });

    const ws = xlsx.utils.json_to_sheet(exportData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Resultados");
    
    const fileName = `Exportacao_${type.toUpperCase()}_${new Date().getTime()}.xlsx`;
    xlsx.writeFile(wb, fileName);
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    if (!filteredData || filteredData.length === 0) return;

    const doc = new jsPDF('landscape');
    const title = `Relatório de ${type === 'sc' ? 'Solicitações de Compra' : 'Pedidos de Compra'}`;
    const subtitle = `Total de Registros: ${filteredData.length} | Gerado em: ${new Date().toLocaleString('pt-BR')}`;

    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 22);

    const exportData = filteredData.map(item => {
      const rawData = item._raw || {};
      const formattedRow: any = {};
      
      if (dynamicColumns) {
        dynamicColumns.forEach(col => {
           const value = rawData[col];
           let displayValue: any = value;
           
           if (value !== undefined && value !== null) {
              const colLower = col.toLowerCase();
              const isDateCol = colLower.includes('dt') || colLower.includes('data') || colLower.includes('emissão') || colLower.includes('emissao') || colLower.includes('entrega') || colLower.includes('previsao');
              
              if (isDateCol && typeof value === 'number' && value > 10000) {
                 displayValue = new Date(Math.round((value - 25569) * 86400 * 1000)).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
              }
           } else {
             displayValue = ''; 
           }
           
           formattedRow[col] = String(displayValue);
        });
      } else {
        Object.assign(formattedRow, item);
      }
      return formattedRow;
    });

    if (dynamicColumns && dynamicColumns.length > 0) {
      const head = [dynamicColumns];
      const body = exportData.map(row => dynamicColumns.map(col => row[col] || '-'));
      
      autoTable(doc, {
        head: head,
        body: body,
        startY: 28,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229] },
        horizontalPageBreak: true,
      });
    }

    doc.save(`Relatorio_${type.toUpperCase()}_${new Date().getTime()}.pdf`);
    setShowExportMenu(false);
  };

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 shadow-sm overflow-hidden flex flex-col h-full relative">
      {/* Header & Filters */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-950 space-y-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="relative flex-1 max-w-md flex flex-row items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-5 h-5" />
              <input
                type="text"
                placeholder={`Pesquisar ${type === 'sc' ? 'solicitações...' : 'pedidos...'}`}
                className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-neutral-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <button
                 onClick={() => setShowExportMenu(!showExportMenu)}
                 className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shrink-0"
                 title="Exportar Relatório"
              >
                 <Download className="w-4 h-4" />
                 <span className="hidden sm:inline text-sm font-medium">Exportar Relatório</span>
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-20 top-full">
                  <div className="py-1">
                    <button
                      onClick={handleExportPDF}
                      className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700 hover:text-white flex items-center gap-2 transition"
                    >
                      <FileText className="w-4 h-4 text-rose-500" />
                      Relatório em PDF
                    </button>
                    <button
                      onClick={handleExport}
                      className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700 hover:text-white flex items-center gap-2 transition"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                      Planilha Excel
                    </button>
                  </div>
                </div>
              )}
            </div>
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
                 <option value="date_desc">Ordenar por Data (Mais Novo)</option>
                 <option value="date">Ordenar por Data (Mais Antigo)</option>
                 <option value="filial">Ordenar por Filial</option>
                 <option value="category">Ordenar por Categoria</option>
               </select>
         </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {type === 'inventory' ? (
           <div className="flex flex-col space-y-8 p-1">
             {inventoryGroups.map(([groupKey, filialData]) => {
                const filialPart = groupKey;
                
                return (
                  <div key={groupKey} className="bg-neutral-900 border border-neutral-700 w-full overflow-hidden rounded-md flex flex-col">
                    <div className="bg-neutral-800/80 text-cyan-400 font-bold px-4 py-3 border-b border-neutral-700 flex justify-between items-center whitespace-nowrap">
                       <span className="uppercase tracking-wide">
                          F I L I A L : {filialPart}
                       </span>
                       <span className="text-xs font-normal text-neutral-400 bg-neutral-900 px-2 py-1 rounded border border-neutral-700">
                         {filialData.length} Itens
                       </span>
                    </div>
                    <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-900">
                    <table className="w-full text-left border-collapse whitespace-nowrap min-w-max">
                      <thead>
                        <tr className="bg-neutral-950/20 border-b border-neutral-800 text-neutral-400 text-[11px] uppercase tracking-wider">
                          {dynamicColumns ? (
                            dynamicColumns.map((col, idx) => (
                              <th key={idx} className="py-2.5 px-4 font-semibold">{col}</th>
                            ))
                          ) : null}
                        </tr>
                      </thead>
                      <tbody className="align-middle">
                        {filialData.map((item, index) => (
                          <tr 
                            key={index} 
                            className="border-b border-neutral-800/50 hover:bg-neutral-800/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedItem(item)}
                          >
                            {dynamicColumns ? (
                                dynamicColumns.map((col, idx) => {
                                  const value = item._raw && col in item._raw ? item._raw[col] : (item as any)[col];
                                  let displayValue = '-';
                                 
                                 if (value !== undefined && value !== null) {
                                    const meta = columnMetadata[col] || {};
                                    
                                    if (meta.isDateCol && typeof value === 'number' && value > 10000) {
                                       const date = new Date(Math.round((value - 25569) * 86400 * 1000));
                                       displayValue = date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                                    } else if (typeof value === 'number' && !meta.isDateCol && meta.isNumericCol) {
                                       // Format numeric properly for amounts
                                       if (meta.isCurrencyCol) {
                                          displayValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                                       } else {
                                          displayValue = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value);
                                       }
                                    } else {
                                       displayValue = String(value);
                                    }
                                 }

                                 return (
                                   <td key={idx} className="py-2.5 px-4 text-xs text-neutral-300">
                                     {displayValue}
                                   </td>
                                 );
                              })
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                );
             })}
             {filteredData.length === 0 && (
                <div className="py-8 text-center text-neutral-500 w-full">
                    Nenhum registro encontrado.
                </div>
             )}
           </div>
        ) : (
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
             <tbody className="align-middle">
                {filteredData.length === 0 ? (
                   <tr>
                      <td colSpan={dynamicColumns ? dynamicColumns.length : 1} className="py-8 text-center text-neutral-500">
                         Nenhum registro encontrado.
                      </td>
                   </tr>
                ) : (
                   filteredData.map((item, index) => (
                     <tr 
                       key={index} 
                       className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors cursor-pointer"
                       onClick={() => setSelectedItem(item)}
                     >
                       {dynamicColumns ? (
                         dynamicColumns.map((col, idx) => {
                            const value = item._raw?.[col];
                            let displayValue = '-';
                            
                            if (value !== undefined && value !== null) {
                               const meta = columnMetadata[col] || {};
                               
                               if (meta.isDateCol && typeof value === 'number' && value > 10000) {
                                  const date = new Date(Math.round((value - 25569) * 86400 * 1000));
                                  displayValue = date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                               } else if (typeof value === 'number' && !meta.isDateCol && meta.isCurrencyCol) {
                                  displayValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                               } else {
                                  displayValue = String(value);
                               }
                            }

                            return (
                              <td key={idx} className="py-2.5 px-4 text-xs text-neutral-300 whitespace-nowrap">
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
        )}
      </div>
      <div className="p-4 border-t border-neutral-800 bg-neutral-950 text-xs text-neutral-500 text-right">
        Total Exibido: {filteredData.length}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden w-full max-w-3xl max-h-[85vh] flex flex-col motion-preset-slide-down" onClick={(e) => e.stopPropagation()}>
             <div className="p-5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  Detalhes do {type === 'sc' ? 'Solicitação' : 'Pedido'}
                  <span className="ml-3 px-2.5 py-1 text-xs bg-neutral-800 text-neutral-400 rounded-md whitespace-nowrap">
                    ID: {selectedItem.id}
                  </span>
                </h3>
                <button onClick={() => setSelectedItem(null)} className="p-2 text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-800 rounded-full transition-colors">
                   <X className="w-5 h-5" />
                </button>
             </div>
             <div className="p-6 overflow-y-auto w-full grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {selectedItem._raw && Object.entries(selectedItem._raw).filter(([key, val]) => {
                    const keyLower = key.trim().toLowerCase();
                    return !keyLower.includes('empty') && !keyLower.includes('listagem do browse') && val !== undefined && val !== null && val !== '';
                }).map(([key, val], idx) => {
                   let displayVal = String(val);
                   const isDateCol = key.toLowerCase().includes('dt') || key.toLowerCase().includes('data') || key.toLowerCase().includes('emissão') || key.toLowerCase().includes('emissao') || key.toLowerCase().includes('entrega') || key.toLowerCase().includes('previsao');
                   if (isDateCol && typeof val === 'number' && val > 10000) {
                      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                      displayVal = date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                   }
                   return (
                     <div key={idx} className="flex flex-col border-b border-neutral-800/50 pb-3">
                        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">{key}</span>
                        <span className="text-sm text-neutral-200 break-words">{displayVal}</span>
                     </div>
                   )
                })}
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
