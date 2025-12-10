-- Увеличение размера поля onetime_code для хранения bcrypt хеша
-- Bcrypt хеш имеет длину 60 символов, увеличиваем до 255 для безопасности

ALTER TABLE phone_number_verify 
MODIFY COLUMN onetime_code VARCHAR(255) NOT NULL;
