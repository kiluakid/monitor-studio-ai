import React, { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PurchaseRequest, PurchaseOrder, UrgencyLevel, SCStatus, PCStatus } from '../types';

interface ImportDataProps {
  onImportSC: (data: PurchaseRequest[]) => void;
  onImportPC: (data: PurchaseOrder[]) => void;
}

export function ImportData({ onImportSC, onImportPC }: ImportDataProps) {
  const [dragActiveSC, setDragActiveSC] = useState(false);
  const [dragActivePC, setDragActivePC] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'sc' | 'pc'; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRefSC = useRef<HTMLInputElement>(null);
  const inputRefPC = useRef<HTMLInputElement>(null);

  const handleDragSC = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveSC(true);
    } else if (e.type === "dragleave") {
      setDragActiveSC(false);
    }
  };

  const handleDragPC = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActivePC(true);
    } else if (e.type === "dragleave") {
      setDragActivePC(false);
    }
  };

  const handleDropSC = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveSC(false);
    setError(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0], 'sc');
    }
  };

  const handleDropPC = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActivePC(false);
    setError(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0], 'pc');
    }
  };

  const handleChangeSC = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0], 'sc');
    }
  };

  const handleChangePC = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0], 'pc');
    }
  };

  const processFile = async (file: File, targetType: 'sc' | 'pc') => {
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
          if (rowText.includes('filial') || rowText.includes('numero da sc') || rowText.includes('solicitacao') || rowText.includes('produto') || rowText.includes('fornecedor') || rowText.includes('num. pc') || rowText.includes('pedido')) {
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
      
      if (targetType === 'pc') {
        const mappedOrders: PurchaseOrder[] = json.map((row: any) => ({
          id: String(row['Num. PC'] || row['Pedido'] || row['ID'] || Math.random().toString(36).substring(7)),
          sc_id: String(row['Num. SC'] || row['Sol. Compra'] || row['SC'] || ''),
          date: row['Emissao'] || row['Data'] || new Date().toISOString(),
          supplier: row['Fornecedor'] || 'Não informado',
          category: row['Categoria'] || row['Grupo'] || 'Geral',
          totalValue: parseFloat(row['Valor Total'] || row['Total'] || '0') || 0,
          status: (row['Status'] || 'Aberto') as PCStatus,
          deliveryDate: row['Entrega'] || row['Previsao'] || row['Data'] || '',
          _raw: row,
        }));
        onImportPC(mappedOrders);
        setImportStatus({ type: 'pc', count: mappedOrders.length });
      } else {
        const mappedReqs: PurchaseRequest[] = json.map((row: any) => ({
          id: String(row['Numero da SC'] || row['Num. SC'] || row['Solicitacao'] || row['ID'] || Math.random().toString(36).substring(7)),
          date: row['DT Emissao'] || row['Emissao'] || row['Data'] || new Date().toISOString(),
          product: row['Produto'] || row['Descricao'] || 'Produto não especificado',
          category: row['Filial'] || row['Categoria'] || row['Grupo'] || 'Geral',
          quantity: parseFloat(row['Quantidade'] || row['Qtd'] || '0') || 0,
          urgency: (row['Urgencia'] || 'Normal') as UrgencyLevel,
          status: (row['Status'] || 'Pendente') as SCStatus,
          requester: row['Solicitante'] || row['Usuario'] || 'Sistema',
          observations: row['Observacoes'] || row['Obs'] || '',
          _raw: row,
        }));
        onImportSC(mappedReqs);
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
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Importar Dados do Protheus</h2>
        <p className="text-slate-500">Selecione o tipo de arquivo que você deseja importar.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Import SC */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 bg-blue-50/50">
            <h3 className="text-xl font-bold text-blue-900 mb-1">MATA110</h3>
            <p className="text-blue-700/70 text-sm">Solicitações de Compras (SC)</p>
          </div>
          <div className="p-6 flex-grow flex flex-col">
            <div
              className={`flex-grow border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center
                ${dragActiveSC ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'}`}
              onDragEnter={handleDragSC}
              onDragLeave={handleDragSC}
              onDragOver={handleDragSC}
              onDrop={handleDropSC}
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
                onChange={handleChangeSC}
              />
              <div className="mx-auto flex justify-center mb-4 text-slate-400">
                <FileSpreadsheet className="w-12 h-12" />
              </div>
              <p className="text-base font-medium text-slate-700 mb-1">
                Clique ou arraste a planilha MATA110 aqui
              </p>
              <p className="text-xs text-slate-500">
                Formatos suportados: CSV, XLSX, XLS
              </p>
            </div>
          </div>
        </div>

        {/* Import PC */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 bg-emerald-50/50">
            <h3 className="text-xl font-bold text-emerald-900 mb-1">MATA121</h3>
            <p className="text-emerald-700/70 text-sm">Pedidos de Compras (PC)</p>
          </div>
          <div className="p-6 flex-grow flex flex-col">
            <div
              className={`flex-grow border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center
                ${dragActivePC ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2'}`}
              onDragEnter={handleDragPC}
              onDragLeave={handleDragPC}
              onDragOver={handleDragPC}
              onDrop={handleDropPC}
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
                onChange={handleChangePC}
              />
              <div className="mx-auto flex justify-center mb-4 text-slate-400">
                <Upload className="w-12 h-12" />
              </div>
              <p className="text-base font-medium text-slate-700 mb-1">
                Clique ou arraste a planilha MATA121 aqui
              </p>
              <p className="text-xs text-slate-500">
                Formatos suportados: CSV, XLSX, XLS
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-rose-50 rounded-lg flex items-start space-x-3 text-rose-700 border border-rose-100">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Erro na importação</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {importStatus && !error && (
        <div className="mt-6 p-4 bg-emerald-50 rounded-lg flex items-center justify-between text-emerald-700 border border-emerald-100">
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
            className="text-sm font-medium hover:text-emerald-800 focus:outline-none focus:underline"
          >
            Limpar
          </button>
        </div>
      )}

    </div>
  );
}
