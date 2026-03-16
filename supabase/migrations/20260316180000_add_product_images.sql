-- Migration: add_product_images
-- Adds image_url column to products and creates a storage bucket for product images.
-- Depends on: create_products (products table must exist)

-- Add nullable image_url column
ALTER TABLE products ADD COLUMN image_url text;

-- Create storage bucket for product images (public so images can be served without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone authenticated can read, only admins can upload/update/delete
CREATE POLICY "product_images_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth_role() = 'admin'
  );

CREATE POLICY "product_images_update_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND auth_role() = 'admin'
  );

CREATE POLICY "product_images_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND auth_role() = 'admin'
  );
