export interface Executive {
  name: string;
  title: string;
}

export interface Source {
  crd_number: number;
  legal_name: string;
  city: string;
  state: string;
  executives: Executive[];
  vc_fund_count: number;
  vc_total_aum: number;
  activity_score: number;
}

export interface ApiResponse {
  answer: string;
  sources: Source[];
  metadata?: { plan?: any };
}

export interface ApiError {
  error: string;
  errorId?: string;
  status?: number;
  backend?: string;
  details?: unknown;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  isLoading?: boolean;
}
