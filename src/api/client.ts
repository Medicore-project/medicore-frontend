import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getBookingToken, isBookingTokenRequest } from './bookingToken';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: Error | AxiosError) => void;
}> = [];

const processQueue = (error: Error | AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Booking is the one path that may be reached by a patient with no account, so it takes the
    // booking token when there is one. Everything else keeps using the signed-in staff token —
    // see BOOKING_TOKEN_ROUTES for why this is an allow-list and not "whichever token exists".
    const bookingToken = isBookingTokenRequest(config.method, config.url) ? getBookingToken() : null;

    if (bookingToken) {
      config.headers.Authorization = `Bearer ${bookingToken}`;
    } else {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    config.headers['X-Correlation-Id'] = crypto.randomUUID();
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (originalRequest.url?.includes('/auth/login')) {
      return Promise.reject(error);
    }

    // A booking token is minted by /api/patients/identify and cannot be refreshed — an anonymous
    // visitor has no refresh token. Falling through to the refresh path below would run
    // `localStorage.clear()` and hard-redirect to /login: useless for a patient who has no account,
    // and destructive for a receptionist whose *staff* session would be thrown away because their
    // *booking* token expired. The booking flow handles its own 401 by asking the patient to
    // identify again.
    if (isBookingTokenRequest(originalRequest.method, originalRequest.url)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        isRefreshing = false;
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${baseURL}/auth/refresh`, {
          refreshToken,
        });

        const data = response.data;
        const newAccessToken = data.accessToken || data.access_token || data.token;
        const newRefreshToken = data.refreshToken || data.refresh_token;

        if (newAccessToken) {
          localStorage.setItem('access_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('refresh_token', newRefreshToken);
          }
          apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          return apiClient(originalRequest);
        } else {
          throw new Error('Refresh token exchange failed');
        }
      } catch (refreshError) {
        processQueue(refreshError as AxiosError | Error, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
