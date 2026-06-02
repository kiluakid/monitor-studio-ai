import React, { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, PackageSearch } from 'lucide-react';
import { PurchaseRequest, PurchaseOrder, InventoryItem, UrgencyLevel, SCStatus, PCStatus } from '../types';

interface ImportDataProps {
  onImportSC: (data: PurchaseRequest[]) => void;
  onImportPC: (data: PurchaseOrder[]) => void;
  onImportInventory: (data: InventoryItem[]) => void;
}

export function ImportData({ onImportSC, onImportPC, onImportInventory }: ImportDataProps) {
  const [dragActiveSC, setDragActiveSC] = useState(false);
  const [dragActivePC, setDragActivePC] = useState(false);
  const [dragActiveInv, setDragActiveInv] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'sc' | 'pc' | 'inventory'; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRefSC = useRef<HTMLInputElement>(null);
  const inputRefPC = useRef<HTMLInputElement>(null);
  const inputRefInv = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent, setActive: (v: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setActive(true);
    } else if (e.type === "dragleave") {
      setActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent, setActive: (v: boolean) => void, type: 'sc' | 'pc' | 'inventory') => {
    e.preventDefault();
    e.stopPropagation();
    setActive(false);
    setError(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0], type);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'sc' | 'pc' | 'inventory') => {
    e.preventDefault();
    setError(null);
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0], type);
    }
  };

  const parseDateStr = (dateValue: any) => {
    if (!dateValue) return new Date().toISOString();
    if (typeof dateValue === 'number' || (!isNaN(Number(dateValue)) && Number(dateValue) > 20000)) {
       const numDate = Number(dateValue);
       return new Date(Math.round((numDate - 25569) * 86400 * 1000)).toISOString();
    }
    if (typeof dateValue === 'string') {
      if (dateValue.includes('/')) {
        const parts = dateValue.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts;
          let parsedYear = Number(year.split(' ')[0]); // Handle cases like 12/03/2025 10:00
          if (parsedYear < 100) {
            parsedYear += parsedYear < 50 ? 2000 : 1900;
          }
          const parsed = new Date(parsedYear, Number(month) - 1, Number(day));
          if (!isNaN(parsed.getTime())) return parsed.toISOString();
        }
      }
      if (dateValue.includes('-')) {
        const d = new Date(dateValue);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
      const d = new Date(dateValue);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    return new Date().toISOString();
  };

  const getEmissaoValue = (row: any) => {
    const keys = Object.keys(row);
    const emissaoKey = keys.find(k => k.toLowerCase().includes('emiss') || k.toLowerCase().includes('emisão'));
    if (emissaoKey && row[emissaoKey]) return row[emissaoKey];
    
    const dataKey = keys.find(k => k.toLowerCase().includes('data'));
    if (dataKey && row[dataKey]) return row[dataKey];
    
    return null;
  };

  const processFile = async (file: File, targetType: 'sc' | 'pc' | 'inventory') => {
    try {
      const data = await file.arrayBuffer();
      const workbook = xlsx.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Obter os dados como array bidimensional para encontrar o cabeçalho real
      const rawData = xlsx.utils.sheet_to_json<any>(worksheet, { header: 1 });
      
      // Procurar o índice da linha de cabeçalho
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(rawData.length, 20); i++) {
        const row = rawData[i];
        if (row && Array.isArray(row)) {
          const rowText = row.join(' ').toLowerCase();
          if (rowText.includes('filial') || rowText.includes('numero da sc') || rowText.includes('solicitacao') || rowText.includes('produto') || rowText.includes('fornecedor') || rowText.includes('num. pc') || rowText.includes('pedido') || rowText.includes('armazem') || rowText.includes('local') || rowText.includes('codigo') || rowText.includes('cód')) {
            headerRowIndex = i;
            break;
          }
        }
      }

      const headers = rawData[headerRowIndex] || [];
      
      // Mapear os dados usando o cabeçalho correto
      const json = rawData.slice(headerRowIndex + 1).map(row => {
        const obj: any = {};
        if (Array.isArray(row)) {
          headers.forEach((header: any, index: number) => {
            if (header && typeof header === 'string') {
              obj[header.trim()] = row[index];
            }
          });
        }
        return obj;
      }).filter(row => Object.keys(row).length > 0);

      if (!json || json.length === 0) {
        throw new Error('Planilha vazia ou formato inválido.');
      }
      
      if (targetType === 'inventory') {
        const mappedInventory: InventoryItem[] = json.map((row: any) => ({
          id: String(row['Codigo'] || row['Cód'] || row['Produto'] || row['ID'] || Math.random().toString(36).substring(7)),
          description: row['Descricao'] || row['Descrição'] || 'Produto não especificado',
          warehouse: row['Armazem'] || row['Armazém'] || row['Local'] || '01',
          quantity: parseFloat(row['Quantidade'] || row['Qtd'] || '0') || 0,
          unitValue: parseFloat(row['Custo Unitario'] || row['Custo'] || row['Valor Unitario']),
          totalValue: parseFloat(row['Custo Total'] || row['Valor Total']),
          date: new Date().toISOString(),
          _raw: row,
        }));
        await onImportInventory(mappedInventory);
        setImportStatus({ type: 'inventory', count: mappedInventory.length });
      } else if (targetType === 'pc') {
        const mappedOrders: PurchaseOrder[] = json.map((row: any) => ({
          id: String(row['Num. PC'] || row['Pedido'] || row['ID'] || Math.random().toString(36).substring(7)),
          sc_id: String(row['Num. SC'] || row['Sol. Compra'] || row['SC'] || ''),
          date: parseDateStr(getEmissaoValue(row) || row['Emissao'] || row['Data'] || row['Emissão'] || row['Data Emissão']),
          supplier: row['Fornecedor'] || 'Não informado',
          category: row['Categoria'] || row['Grupo'] || 'Geral',
          totalValue: parseFloat(row['Valor Total'] || row['Total'] || '0') || 0,
          status: (row['Status'] || 'Aberto') as PCStatus,
          deliveryDate: row['Entrega'] || row['Previsao'] || row['Data'] || '',
        }));
        await onImportPC(mappedOrders);
        setImportStatus({ type: 'pc', count: mappedOrders.length });
      } else {
        const mappedReqs: PurchaseRequest[] = json.map((row: any) => ({
          id: String(row['Numero da SC'] || row['Num. SC'] || row['Solicitacao'] || row['ID'] || Math.random().toString(36).substring(7)),
          date: parseDateStr(getEmissaoValue(row) || row['DT Emissao'] || row['Emissao'] || row['Data'] || row['Emissão']),
          product: row['Produto'] || row['Descricao'] || 'Produto não especificado',
          category: row['Filial'] || row['Categoria'] || row['Grupo'] || 'Geral',
          quantity: parseFloat(row['Quantidade'] || row['Qtd'] || '0') || 0,
          urgency: (row['Urgencia'] || 'Normal') as UrgencyLevel,
          status: (row['Status'] || 'Pendente') as SCStatus,
          requester: row['Solicitante'] || row['Usuario'] || 'Sistema',
          observations: row['Observacoes'] || row['Obs'] || '',
        }));
        await onImportSC(mappedReqs);
        setImportStatus({ type: 'sc', count: mappedReqs.length });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao processar o arquivo. Verifique o formato exportado pelo Protheus.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Importar Dados do Protheus</h2>
        <p className="text-neutral-400">Selecione o tipo de arquivo que você deseja importar.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Import SC */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-neutral-800 bg-blue-900/20">
            <h3 className="text-xl font-bold text-blue-400 mb-1">MATA110</h3>
            <p className="text-blue-500/70 text-sm">Solicitações de Compras (SC)</p>
          </div>
          <div className="p-6 flex-grow flex flex-col">
            <div
              className={`flex-grow border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center
                ${dragActiveSC ? 'border-blue-500 bg-blue-900/10' : 'border-neutral-700 hover:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900'}`}
              onDragEnter={(e) => handleDrag(e, setDragActiveSC)}
              onDragLeave={(e) => handleDrag(e, setDragActiveSC)}
              onDragOver={(e) => handleDrag(e, setDragActiveSC)}
              onDrop={(e) => handleDrop(e, setDragActiveSC, 'sc')}
              onClick={() => inputRefSC.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  inputRefSC.current?.click();
                }
              }}
            >
              <input
                ref={inputRefSC}
                type="file"
                className="hidden"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={(e) => handleChange(e, 'sc')}
              />
              <div className="mx-auto flex justify-center mb-4 text-neutral-500">
                <FileSpreadsheet className="w-12 h-12" />
              </div>
              <p className="text-base font-medium text-neutral-300 mb-1">
                Clique ou arraste a planilha MATA110 aqui
              </p>
              <p className="text-xs text-neutral-500">
                Formatos suportados: CSV, XLSX, XLS
              </p>
            </div>
          </div>
        </div>

        {/* Import PC */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-neutral-800 bg-emerald-900/20">
            <h3 className="text-xl font-bold text-emerald-400 mb-1">MATA121</h3>
            <p className="text-emerald-500/70 text-sm">Pedidos de Compras (PC)</p>
          </div>
          <div className="p-6 flex-grow flex flex-col">
            <div
              className={`flex-grow border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center
                ${dragActivePC ? 'border-emerald-500 bg-emerald-900/10' : 'border-neutral-700 hover:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-900'}`}
              onDragEnter={(e) => handleDrag(e, setDragActivePC)}
              onDragLeave={(e) => handleDrag(e, setDragActivePC)}
              onDragOver={(e) => handleDrag(e, setDragActivePC)}
              onDrop={(e) => handleDrop(e, setDragActivePC, 'pc')}
              onClick={() => inputRefPC.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  inputRefPC.current?.click();
                }
              }}
            >
              <input
                ref={inputRefPC}
                type="file"
                className="hidden"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={(e) => handleChange(e, 'pc')}
              />
              <div className="mx-auto flex justify-center mb-4 text-neutral-500">
                <Upload className="w-12 h-12" />
              </div>
              <p className="text-base font-medium text-neutral-300 mb-1">
                Clique ou arraste a planilha MATA121 aqui
              </p>
              <p className="text-xs text-neutral-500">
                Formatos suportados: CSV, XLSX, XLS
              </p>
            </div>
          </div>
        </div>

        {/* Import MATR290 */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-neutral-800 bg-purple-900/20">
            <h3 className="text-xl font-bold text-purple-400 mb-1">MATR290</h3>
            <p className="text-purple-500/70 text-sm">Análise de Estoque</p>
          </div>
          <div className="p-6 flex-grow flex flex-col">
            <div
              className={`flex-grow border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center
                ${dragActiveInv ? 'border-purple-500 bg-purple-900/10' : 'border-neutral-700 hover:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-neutral-900'}`}
              onDragEnter={(e) => handleDrag(e, setDragActiveInv)}
              onDragLeave={(e) => handleDrag(e, setDragActiveInv)}
              onDragOver={(e) => handleDrag(e, setDragActiveInv)}
              onDrop={(e) => handleDrop(e, setDragActiveInv, 'inventory')}
              onClick={() => inputRefInv.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  inputRefInv.current?.click();
                }
              }}
            >
              <input
                ref={inputRefInv}
                type="file"
                className="hidden"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={(e) => handleChange(e, 'inventory')}
              />
              <div className="mx-auto flex justify-center mb-4 text-neutral-500">
                <PackageSearch className="w-12 h-12" />
              </div>
              <p className="text-base font-medium text-neutral-300 mb-1">
                Clique ou arraste o MATR290 aqui
              </p>
              <p className="text-xs text-neutral-500">
                Formatos suportados: CSV, XLSX, XLS
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-rose-950/50 rounded-lg flex items-start space-x-3 text-rose-400 border border-rose-900/50">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Erro na importação</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {importStatus && !error && (
        <div className="mt-6 p-4 bg-emerald-950/50 rounded-lg flex items-center justify-between text-emerald-400 border border-emerald-900/50">
          <div className="flex items-center space-x-3">
             <CheckCircle2 className="w-5 h-5 shrink-0" />
             <p className="font-medium">
                {importStatus.type === 'pc' 
                  ? `${importStatus.count} Pedidos de Compra (MATA121) importados.` 
                  : `${importStatus.count} Solicitações de Compra (MATA110) importadas.`}
             </p>
          </div>
          <button 
            onClick={() => setImportStatus(null)}
            className="text-sm font-medium hover:text-emerald-300 focus:outline-none focus:underline"
          >
            Limpar
          </button>
        </div>
      )}

    </div>
  );
}
