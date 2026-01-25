-- Создание таблицы для developer API keys
-- Ключи храним в виде sha256-хэша (hex, 64 символа)

CREATE TABLE IF NOT EXISTS `developer_keys` (
  `developer_key_id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NULL,
  `key_hash` CHAR(64) NOT NULL,
  `key_prefix` VARCHAR(12) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` TIMESTAMP NULL DEFAULT NULL,
  `revoked_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`developer_key_id`),
  UNIQUE KEY `developer_keys_key_hash_uq` (`key_hash`),
  KEY `developer_keys_key_prefix_idx` (`key_prefix`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
