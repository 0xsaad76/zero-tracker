import {configureStore} from '@reduxjs/toolkit';
import rootReducer from './rootReducer';

// Financial state is RAM-only. Supabase is the sole source of truth.
const store = configureStore({
  reducer: rootReducer,
  enhancers: getDefaultEnhancers => getDefaultEnhancers({autoBatch: {type: 'tick'}}),
});
export type AppDispatch = typeof store.dispatch;
export default store;
