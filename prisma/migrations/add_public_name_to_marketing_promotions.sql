-- Добавляем публичное название акции (для отображения пользователю)
-- MySQL

ALTER TABLE marketing_promotions
  ADD COLUMN public_name VARCHAR(255) NULL AFTER name;
