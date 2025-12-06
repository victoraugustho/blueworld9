export interface Category {
  id: number;
  name: string;
  created_at?: string;
}

export interface Material {
  id: string;
  title: string;
  description: string;
  file_url: string;
  file_type: "video" | "document";
  category_id: number | null;
  created_at?: string;

  // campos adicionais da query
  category_name?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  approved: boolean;
  created_at?: string;
  updated_at?: string;
  role: string | null;
}

