import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {RootState} from '../rootReducer';
import StorageService from '../../utils/asyncStorageService';

let initialIsOnboarded = false;
try {
  const storedValue = StorageService.getItemSync('isOnboarded');
  if (storedValue) {
    initialIsOnboarded = JSON.parse(storedValue) === true;
  }
} catch {
  // Corrupted MMKV value — safe to re-onboard, data still in SQLite
}

const initialState = {
  isOnboarded: initialIsOnboarded,
};

const isOnboardedSlice = createSlice({
  name: 'userOnboarding',
  initialState,
  reducers: {
    setIsOnboarded: (state, action: PayloadAction<boolean>) => {
      state.isOnboarded = action.payload;
    },
  },
});

export const selectIsOnboarded = (state: RootState) =>
  state.userOnboarding.isOnboarded;

export const {setIsOnboarded} = isOnboardedSlice.actions;

export default isOnboardedSlice.reducer;
