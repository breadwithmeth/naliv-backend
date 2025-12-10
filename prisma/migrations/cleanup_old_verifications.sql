-- Очистка старых записей верификации с неправильными хешами
-- Выполните эту команду если хотите удалить все старые коды

DELETE FROM phone_number_verify WHERE LENGTH(onetime_code) < 50;

-- Или удалите все записи:
-- DELETE FROM phone_number_verify;
