import React, { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PurchaseRequest, PurchaseOrder, UrgencyLevel, SCStatus, PCStatus } from '../types';

interface ImportDataProps {
  onImportSC: (data: PurchaseRequest[]) => void;
  onImportPC: (data: PurchaseOrder[]) => void;
}

export function ImportData({ onImportSC, onImportPC }: ImportDataProps) {
  const [dragActive, setDragActive] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'sc' | 'pc'; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
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
          if (rowText.includes('filial') || rowText.includes('numero da sc') || rowText.includes('solicitacao') || rowText.includes('produto') || rowText.includes('fornecedor')) {
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

      // Detect type (SC vs PC) based on column headers of the first row
      const sampleRow = json[0] || {};
      const keys = Object.keys(sampleRow).map(k => k.toLowerCase());

      const isPC = keys.some(k => k.includes('fornecedor') || k.includes('pedido') || k.includes('pc') || k.includes('valor'));
      
      if (isPC) {
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
    <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-slate-100 text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Importar Dados do Protheus</h2>
        <p className="text-slate-500">Faça o upload do relatório exportado (MATA110 ou MATA121) em formato Excel (.xlsx, .xls) ou CSV.</p>
      </div>

      <div className="p-8">
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer
            ${dragActive ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              inputRef.current?.click();
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleChange}
          />
          <div className="mx-auto flex justify-center mb-4 text-slate-400">
             <Upload className="w-12 h-12" />
          </div>
          <p className="text-lg font-medium text-slate-700">
            Clique para selecionar ou arraste o arquivo aqui
          </p>
          <p className="text-sm text-slate-500 mt-2">
             Formatos suportados: CSV, XLSX, XLS
          </p>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-rose-50 rounded-lg flex items-start space-x-3 text-rose-700">
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
    </div>
  );
}
