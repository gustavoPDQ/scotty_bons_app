-- Add sort_order columns to product_categories and products for custom ordering.

ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill categories: assign sequential sort_order based on current alphabetical name order.
UPDATE product_categories SET sort_order = sub.rn - 1
FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn FROM product_categories) sub
WHERE product_categories.id = sub.id;

-- Backfill products: assign sequential sort_order within each category based on name.
UPDATE products SET sort_order = sub.rn - 1
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY name) AS rn FROM products) sub
WHERE products.id = sub.id;
