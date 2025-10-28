export interface TargetTrade {
  Id: string;
  AccountName: string;
  ContractName: string;
  Status: string;
  Type: string;
  Size: string;
  Side: string;
  CreatedAt: string;
  TradeDay: string;
  FilledAt: string;
  CancelledAt: string;
  StopPrice: string;
  LimitPrice: string;
  ExecutePrice: string;
  PositionDisposition: string;
  CreationDisposition: string;
  RejectionReason: string;
  ExchangeOrderId: string;
  PlatformOrderId: string;
}
