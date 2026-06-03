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
      
      let allCombinedJson: any[] = [];
      
      for (const sheetName of workbook.SheetNames) {
         // Skip common configuration or parameter sheets
         if (sheetName.toLowerCase().includes('parâmetro') || sheetName.toLowerCase().includes('parametro')) {
             continue;
         }

         const worksheet = workbook.Sheets[sheetName];
         
         // Obter os dados como array bidimensional para encontrar o cabeçalho real
         let rawData = xlsx.utils.sheet_to_json<any>(worksheet, { header: 1 });
         
         if (rawData.length === 0) continue;

         // Protheus frequently exports CSVs with semicolons that get parsed as a single column by the xlsx library
         if (rawData.length > 0) {
            let isSemicolonCSV = true;
            // Check first 10 rows to see if they all have exactly 1 column containing a semicolon
            for(let i=0; i < Math.min(rawData.length, 10); i++) {
                if (rawData[i] && rawData[i].length > 1) {
                    isSemicolonCSV = false;
                    break;
                }
            }
            
            if (isSemicolonCSV) {
                rawData = rawData.map(row => {
                    if (row && row.length > 0 && typeof row[0] === 'string' && row[0].includes(';')) {
                        // Remover aspas para evitar problemas em CSV exportado do Protheus
                        return row[0].replace(/"/g, '').split(';');
                    }
                    return row;
                });
            }
         }

         // Procurar o índice da linha de cabeçalho
         let headerRowIndex = -1;
         let maxCols = 0;
         let bestRowIndex = 0;

         for (let i = 0; i < Math.min(rawData.length, 50); i++) {
           const row = rawData[i];
           if (row && Array.isArray(row)) {
             if (row.length > maxCols) {
                maxCols = row.length;
                bestRowIndex = i;
             }
             const rowText = row.join(' ').toLowerCase().replace(/"/g, '');
             
             // Count how many known header keywords are in this row
             const knownKeywords = ['filial', 'codigo', 'cód', 'descricao', 'descrição', 'produto', 'saldo', 'empenho', 'armazem', 'local', 'fornecedor', 'numero da sc', 'num. pc', 'pedido', 'solicitacao', 'um', 'grupo', 'classe', 'ponto pedido', 'med. consumo'];
             
             let matchCount = 0;
             for (const keyword of knownKeywords) {
                if (rowText.includes(keyword)) {
                   matchCount++;
                }
             }

             // We need at least 3 known keywords to confidently consider this a data header row (avoiding cover sheets with a simple "Filial" title)
             if (matchCount >= 3 && row.length >= 4) {
                  headerRowIndex = i;
                   bestRowIndex = i; // Save this as absolute best
                  break;
             }
           }
         }
         
         // Se não encontrou cabeçalho confiável e há múltiplas abas, pule esta aba (provavelmente é aba de parâmetros ou capa)
         if (headerRowIndex === -1 && workbook.SheetNames.length > 1) {
             continue;
         }
         
         if (headerRowIndex === -1) headerRowIndex = bestRowIndex;

         const headers = rawData[headerRowIndex] || [];
         const cleanHeaders = headers.map((h: any) => typeof h === 'string' ? h.replace(/^["'\s]+|["'\s]+$/g, '').trim() : h);
         
         // Mapear os dados usando o cabeçalho correto
         const json = rawData.slice(headerRowIndex + 1).map(row => {
           const obj: any = {};
           if (Array.isArray(row)) {
             cleanHeaders.forEach((header: any, index: number) => {
               if (header && typeof header === 'string' && header !== '') {
                 let val = row[index];
                 if (typeof val === 'string') {
                    val = val.replace(/^["'\s]+|["'\s]+$/g, '').trim();
                    // Try to convert string numbers
                    if (/^-?\d{1,3}(?:\.\d{3})*,\d+$/.test(val)) val = parseFloat(val.replace(/\./g, '').replace(',', '.'));
                    else if (/^-?\d+,\d+$/.test(val)) val = parseFloat(val.replace(',', '.'));
                    else if (/^-?\d+\.\d+,\d+$/.test(val)) val = parseFloat(val.replace(/\./g, '').replace(',', '.'));
                    else if (/^-?\d+\.\d+$/.test(val)) val = parseFloat(val);
                    else if (/^-?\d+$/.test(val) && val.length < 16) val = parseInt(val, 10);
                 }
                 if (val !== undefined && val !== null && val !== '') {
                    obj[header] = val;
                 }
               }
             });
             obj['_sheetName'] = sheetName;
             
             // Inject Filial from sheetName if not present
             const hasFilial = Object.keys(obj).some(k => ['filial', 'armazem', 'armazém', 'local'].includes(k.toLowerCase().trim()));
             if (!hasFilial && sheetName) {
                 obj['Filial'] = sheetName;
             }
           }
           return obj;
         }).filter(row => Object.keys(row).length > 1); // Only keep rows that actually parsed something
         
         allCombinedJson = allCombinedJson.concat(json);
      }

      const json = allCombinedJson;

      if (!json || json.length === 0) {
        throw new Error('Planilha vazia ou formato inválido.');
      }

      const getVal = (row: any, searchKeys: string[]) => {
         const keys = Object.keys(row);
         
         // 1. Try exact match (case insensitive)
         for (const sk of searchKeys) {
            const found = keys.find(k => k.trim().toLowerCase() === sk.trim().toLowerCase());
            if (found !== undefined && row[found] !== undefined && row[found] !== null && row[found] !== '') {
               return row[found];
            }
         }
         
         // 2. Try partial match
         for (const sk of searchKeys) {
            const found = keys.find(k => k.trim().toLowerCase().includes(sk.trim().toLowerCase()));
            if (found !== undefined && row[found] !== undefined && row[found] !== null && row[found] !== '') {
               return row[found];
            }
         }
         
         return null;
      };
      
      if (targetType === 'inventory') {
        let mappedInventory: InventoryItem[] = json.map((row: any) => ({
          id: String(getVal(row, ['Codigo', 'Cód', 'Código', 'Produto', 'ID']) || Math.random().toString(36).substring(7)),
          description: String(getVal(row, ['Descricao', 'Descrição', 'Desc.']) || 'Produto não especificado'),
          warehouse: String(getVal(row, ['Armazem', 'Armazém', 'Local', 'Filial']) || '01'),
          quantity: parseFloat(String(getVal(row, ['Saldo Atual', 'Quantidade', 'Qtd', 'Saldo'])) || '0') || 0,
          unitValue: parseFloat(String(getVal(row, ['Custo Unitario', 'Custo Unitário', 'Custo', 'Valor Unitario'])) || '0') || 0,
          totalValue: parseFloat(String(getVal(row, ['Custo Total', 'Valor Total', 'Valor', 'Empenho'])) || '0') || 0,
          date: new Date().toISOString(),
          _raw: row,
        }));
        
        // Filter to only bring products that have Ponto Pedido
        mappedInventory = mappedInventory.filter(item => {
           const ppRaw = getVal(item._raw, ['Ponto Pedido', 'Ponto de pedido']);
           if (ppRaw !== null && ppRaw !== undefined) {
             const ppVal = parseFloat(String(ppRaw).replace(',', '.'));
             return !isNaN(ppVal) && ppVal > 0;
           }
           return false;
        });
        
        await onImportInventory(mappedInventory);
        setImportStatus({ type: 'inventory', count: mappedInventory.length });
      } else if (targetType === 'pc') {
        const mappedOrders: PurchaseOrder[] = json.map((row: any) => ({
          id: String(getVal(row, ['Num. PC', 'Pedido', 'ID']) || Math.random().toString(36).substring(7)),
          sc_id: String(getVal(row, ['Num. SC', 'Sol. Compra', 'SC']) || ''),
          date: parseDateStr(getEmissaoValue(row) || getVal(row, ['Emissao', 'Data', 'Emissão', 'Data Emissão'])),
          supplier: String(getVal(row, ['Fornecedor']) || 'Não informado'),
          category: String(getVal(row, ['Categoria', 'Grupo']) || 'Geral'),
          totalValue: parseFloat(String(getVal(row, ['Valor Total', 'Total'])) || '0') || 0,
          status: String(getVal(row, ['Status']) || 'Aberto') as PCStatus,
          deliveryDate: String(getVal(row, ['Entrega', 'Previsao', 'Data']) || ''),
          _raw: row,
        }));
        await onImportPC(mappedOrders);
        setImportStatus({ type: 'pc', count: mappedOrders.length });
      } else {
        const mappedReqs: PurchaseRequest[] = json.map((row: any) => ({
          id: String(getVal(row, ['Numero da SC', 'Num. SC', 'Solicitacao', 'ID']) || Math.random().toString(36).substring(7)),
          date: parseDateStr(getEmissaoValue(row) || getVal(row, ['DT Emissao', 'Emissao', 'Data', 'Emissão'])),
          product: String(getVal(row, ['Produto', 'Descricao']) || 'Produto não especificado'),
          category: String(getVal(row, ['Filial', 'Categoria', 'Grupo']) || 'Geral'),
          quantity: parseFloat(String(getVal(row, ['Quantidade', 'Qtd'])) || '0') || 0,
          urgency: String(getVal(row, ['Urgencia']) || 'Normal') as UrgencyLevel,
          status: String(getVal(row, ['Status']) || 'Pendente') as SCStatus,
          requester: String(getVal(row, ['Solicitante', 'Usuario']) || 'Sistema'),
          observations: String(getVal(row, ['Observacoes', 'Obs']) || ''),
          _raw: row,
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
                  : importStatus.type === 'inventory' 
                    ? `${importStatus.count} Itens de Estoque (MATR290) importados.`
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
