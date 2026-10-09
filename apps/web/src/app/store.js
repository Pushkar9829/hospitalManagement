import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './baseApi.js';
import { sessionReducer } from './session.js';

export { baseApi } from './baseApi.js';
export { authApi } from '../modules/auth/api.js';

/** A fresh store (one per test; one for the app in main.jsx). */
export function createStore(preloadedState) {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer, session: sessionReducer },
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
    preloadedState,
  });
}
