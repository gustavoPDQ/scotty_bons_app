export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from "./database.types";

export type ActionResult<T> = {
  data: T | null;
  error: string | null;
};

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "factory" | "store";
  store_id: string | null;
  store_name: string | null;
  is_active: boolean;
};

export type StoreRow = {
  id: string;
  name: string;
};

export type CategoryRow = {
  id: string;
  name: string;
  product_count: number;
};

export type ProductRow = {
  id: string;
  name: string;
  price: number;
  unit_of_measure: string;
  category_id: string;
  category_name?: string;
  image_url?: string | null;
};

export type OrderStatus = "submitted" | "under_review" | "approved" | "declined" | "fulfilled";

export type OrderRow = {
  id: string;
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
  unit_of_measure: string;
  unit_price: number;
  quantity: number;
};
