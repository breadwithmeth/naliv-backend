/**
 * Интерфейсы для работы с пользователями
 */

/**
 * Интерфейс для сохранения FCM токена
 * userId извлекается из JWT токена
 */
export interface SaveFcmTokenRequest {
  /** FCM токен для push-уведомлений */
  fcmToken: string;
}

/**
 * Интерфейс ответа при сохранении FCM токена
 */
export interface SaveFcmTokenResponse {
  user: {
    user_id: number;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    OneSignalId: string | null;
  };
  message: string;
}

/**
 * Интерфейс для поиска пользователей по телефону
 */
export interface SearchUsersByPhoneRequest {
  /** Номер телефона для поиска */
  phone: string;
}
