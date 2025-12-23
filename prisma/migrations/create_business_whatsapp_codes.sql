-- Лог отправок одноразовых кодов бизнесом через WhatsApp (Cloud API)
-- MySQL

CREATE TABLE IF NOT EXISTS business_whatsapp_codes (
  business_whatsapp_code_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  business_id INT NOT NULL,
  user_id INT NULL,
  user_login VARCHAR(255) NULL,
  phone_number VARCHAR(30) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  template_name VARCHAR(64) NOT NULL DEFAULT 'r2',
  status VARCHAR(20) NOT NULL,
  message_id VARCHAR(128) NULL,
  error_message TEXT NULL,
  log_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (business_whatsapp_code_id),
  INDEX idx_business_ts (business_id, log_timestamp),
  INDEX idx_user_ts (user_id, log_timestamp),
  INDEX idx_phone_ts (phone_number, log_timestamp)
);
