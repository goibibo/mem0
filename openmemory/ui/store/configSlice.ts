import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OpenMemoryConfig {
  custom_instructions: string | null;
}

interface Mem0Config {
  llm: {
    provider: string;
    config: Record<string, any>;
  };
  embedder: {
    provider: string;
    config: Record<string, any>;
  };
}

interface ConfigState {
  openmemory: OpenMemoryConfig;
  mem0: Mem0Config;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: ConfigState = {
  openmemory: {
    custom_instructions: null,
  },
  mem0: {
    llm: {
      provider: '',
      config: {},
    },
    embedder: {
      provider: '',
      config: {},
    },
  },
  status: 'idle',
  error: null,
};

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setConfigLoading: (state) => {
      state.status = 'loading';
      state.error = null;
    },
    setConfigSuccess: (state, action: PayloadAction<{ openmemory: OpenMemoryConfig; mem0: Mem0Config }>) => {
      state.status = 'succeeded';
      state.openmemory = action.payload.openmemory;
      state.mem0 = action.payload.mem0;
      state.error = null;
    },
    setConfigError: (state, action: PayloadAction<string>) => {
      state.status = 'failed';
      state.error = action.payload;
    },
  },
});

export const {
  setConfigLoading,
  setConfigSuccess,
  setConfigError,
} = configSlice.actions;

export default configSlice.reducer; 