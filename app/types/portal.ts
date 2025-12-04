export interface Category {
  id: number;
  name: string;
  created_at?: string;
}

export interface Material {
  id: number;
  title: string;
  description: string;
  file_url: string;
  file_type: "video" | "document";
  category_id: number | null;
  created_at?: string;

  // campos adicionais da query
  category_name?: string;
}
