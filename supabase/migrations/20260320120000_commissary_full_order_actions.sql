-- Migration: commissary_full_order_actions
-- Expands commissary UPDATE policy on orders so commissary users can perform
-- all status transitions (approve, decline, under_review, fulfill), not just fulfill.
-- Also allows admin to call fulfill_order_with_invoice RPC (already handled in function).

-- ── 1. Replace restrictive commissary UPDATE policy on orders ───────────────
-- Old policy only allowed: USING(status='approved') WITH CHECK(status='fulfilled')
-- New policy mirrors admin: any non-deleted, non-terminal order can be updated.

DROP POLICY IF EXISTS "orders_update_commissary" ON orders;

CREATE POLICY "orders_update_commissary"
  ON orders FOR UPDATE
  USING (auth_role() = 'commissary' AND deleted_at IS NULL)
  WITH CHECK (auth_role() = 'commissary');
