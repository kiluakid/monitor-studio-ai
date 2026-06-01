export type UrgencyLevel = 'Baixa' | 'Normal' | 'Alta' | 'Crítica';
export type SCStatus = 'Pendente' | 'Aprovada' | 'Em Cotação' | 'Atendida' | 'Cancelada';
export type PCStatus = 'Aberto' | 'Faturado' | 'Recebido' | 'Cancelado';

export interface PurchaseRequest {
  id: string; // Numero SC
  date: string; // Data
  product: string; // Produto
  category: string; // Categoria
  quantity: number; // Quantidade
  urgency: UrgencyLevel; // Urgência
  status: SCStatus; // Status
  requester: string; // Solicitante
  observations?: string; // Obs
}

export interface PurchaseOrder {
  id: string; // Numero PC
  sc_id: string; // Numero SC relacionada
  date: string;
  supplier: string; // Fornecedor
  category: string;
  totalValue: number; // Valor Total
  status: PCStatus;
  deliveryDate: string; // Previsão de Entrega
}

export interface AppState {
  purchaseRequests: PurchaseRequest[];
  purchaseOrders: PurchaseOrder[];
  lastBackupDate: string | null;
}
