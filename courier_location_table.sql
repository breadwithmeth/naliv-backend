-- Создание таблицы для хранения геолокации курьеров
CREATE TABLE IF NOT EXISTS courier_location (
    courier_id INT PRIMARY KEY,
    lat DECIMAL(10, 8) NOT NULL COMMENT 'Широта (latitude)',
    lon DECIMAL(11, 8) NOT NULL COMMENT 'Долгота (longitude)', 
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Время последнего обновления координат',
    INDEX idx_courier_updated (courier_id, updated_at),
    FOREIGN KEY (courier_id) REFERENCES couriers(courier_id) ON DELETE CASCADE
) COMMENT = 'Таблица для хранения текущих координат курьеров';
