export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from "./database.types";

export type ActionResult<T> = {
  data: T | null;
  error: string | null;
};

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "commissary" | "store";
  store_id: string | null;
  store_name: string | null;
  is_active: boolean;
};

export type StoreRow = {
  id: string;
  name: string;
  business_name?: string;
  address?: string;
  postal_code?: string;
  phone?: string;
};

export type CategoryRow = {
  id: string;
  name: string;
  product_count: number;
  sort_order: number;
};

export type ProductModifierRow = {
  id: string;
  product_id: string;
  label: string;
  price: number;
  sort_order: number;
};

export type ProductImageRow = {
  id: string;
  url: string;
  sort_order: number;
};

export type ProductRow = {
  id: string;
  name: string;
  category_id: string;
  category_name?: string;
  images: ProductImageRow[];
  sort_order: number;
  in_stock: boolean;
  modifiers: ProductModifierRow[];
};

export type OrderStatus = "submitted" | "approved" | "declined" | "fulfilled";

export type OrderRow = {
  id: string;
  order_number: string;
  store_id: string;
  store_name?: string;
  submitted_by: string;
  status: OrderStatus;
  decline_reason: string | null;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
  total?: number;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  modifier: string;
  unit_price: number;
  quantity: number;
};

export type InvoiceRow = {
  id: string;
  order_id: string;
  invoice_number: string;
  store_id: string;
  store_name: string;
  company_name: string;
  company_address: string;
  company_tax_id: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  ad_royalties_fee: number;
  grand_total: number;
  created_at: string;
};

export type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  product_name: string;
  modifier: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type AuditTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  rating_labels: RatingOption[];
  item_count: number;
  created_at: string;
  updated_at: string;
};

export type AuditTemplateCategoryRow = {
  id: string;
  template_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type AuditTemplateItemRow = {
  id: string;
  template_id: string;
  category_id: string;
  label: string;
  description: string | null;
  sort_order: number;
  rating_labels: RatingOption[];
  created_at: string;
};

export type AuditRow = {
  id: string;
  template_id: string;
  store_id: string;
  store_name?: string;
  template_name?: string;
  conducted_by: string;
  conducted_by_name?: string;
  score: number | null;
  notes: string | null;
  conducted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RatingOption = {
  key: string;
  label: string;
  weight: number;
};

export const DEFAULT_RATING_OPTIONS: RatingOption[] = [
  { key: "poor", label: "Poor", weight: 0 },
  { key: "satisfactory", label: "Satisfactory", weight: 0.5 },
  { key: "good", label: "Good", weight: 1 },
];

export type AuditResponseRow = {
  id: string;
  audit_id: string;
  template_item_id: string;
  rating: string;
  notes: string | null;
};

export type AuditEvidenceRow = {
  id: string;
  audit_response_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
};
