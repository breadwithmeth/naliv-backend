/**
 * Интерфейсы для работы с уведомлениями
 */

/**
 * Интерфейс для отправки уведомления одному пользователю
 */
export interface SendNotificationRequest {
  /** ID пользователя */
  userId: number;
  /** Заголовок уведомления */
  title: string;
  /** Текст уведомления */
  body: string;
  /** Дополнительные данные (JSON) */
  data?: Record<string, string>;
}

/**
 * Интерфейс для отправки группового уведомления
 */
export interface SendBulkNotificationRequest {
  /** Массив ID пользователей */
  userIds: number[];
  /** Заголовок уведомления */
  title: string;
  /** Текст уведомления */
  body: string;
  /** Дополнительные данные (JSON) */
  data?: Record<string, string>;
}

/**
 * Интерфейс уведомления
 */
export interface NotificationData {
  /** ID уведомления */
  id: number;
  /** ID пользователя */
  user_id: number;
  /** Заголовок */
  title: string;
  /** Текст */
  body: string;
  /** Дополнительные данные */
  data: Record<string, any> | null;
  /** Время отправки */
  sent_at: Date;
  /** Прочитано ли */
  is_read: boolean;
}

/**
 * Интерфейс пагинации для уведомлений
 */
export interface NotificationsPagination {
  /** Текущая страница */
  current_page: number;
  /** Общее количество страниц */
  total_pages: number;
  /** Общее количество уведомлений */
  total_count: number;
  /** Количество на странице */
  per_page: number;
  /** Есть ли следующая страница */
  has_next: boolean;
  /** Есть ли предыдущая страница */
  has_prev: boolean;
}

/**
 * Интерфейс ответа с уведомлениями пользователя
 */
export interface GetUserNotificationsResponse {
  /** Список уведомлений */
  notifications: NotificationData[];
  /** Информация о пагинации */
  pagination: NotificationsPagination;
  /** Количество непрочитанных уведомлений */
  unread_count: number;
}

/**
 * Интерфейс результата отправки уведомления
 */
export interface NotificationSendResult {
  /** ID пользователя */
  user_id: number;
  /** Успешно ли отправлено */
  success: boolean;
  /** Результат push-уведомления */
  push_result?: any;
  /** Ошибка, если есть */
  error?: string;
}

/**
 * Интерфейс сводки массовой отправки
 */
export interface BulkNotificationSummary {
  /** Общее количество пользователей */
  total_users: number;
  /** Количество пользователей с токенами */
  users_with_tokens: number;
  /** Количество успешных отправок */
  success_count: number;
  /** Количество неудачных отправок */
  failure_count: number;
}

/**
 * Интерфейс ответа FCM
 */
export interface FCMResponse {
  /** Количество успешных отправок */
  success: number;
  /** Количество неудачных отправок */
  failure: number;
  /** Количество canonical_ids */
  canonical_ids?: number;
  /** Детальные результаты */
  results?: Array<{
    message_id?: string;
    registration_id?: string;
    error?: string;
  }>;
}
