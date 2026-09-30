import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import * as transactionService from '../../services/transactionService'

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async ({ filters = {}, page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const data = await transactionService.getTransactions(filters, page, limit)
      return data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch transactions')
    }
  }
)

export const createTransaction = createAsyncThunk(
  'transactions/createTransaction',
  async (transactionData, { rejectWithValue }) => {
    try {
      const data = await transactionService.createTransaction(transactionData)
      return data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create transaction')
    }
  }
)

export const updateTransaction = createAsyncThunk(
  'transactions/updateTransaction',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const result = await transactionService.updateTransaction(id, data)
      return result
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update transaction')
    }
  }
)

export const deleteTransaction = createAsyncThunk(
  'transactions/deleteTransaction',
  async (id, { rejectWithValue }) => {
    try {
      await transactionService.deleteTransaction(id)
      return id
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete transaction')
    }
  }
)

const initialState = {
  items: [],
  total: 0,
  page: 1,
  limit: 20,
  filters: {},
  loading: false,
  error: null,
}

const transactionSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = action.payload
      state.page = 1
    },
    setPage: (state, action) => {
      state.page = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload.transactions
        state.total = action.payload.total
        state.page = action.payload.page
        state.limit = action.payload.limit
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        state.items.unshift(action.payload)
        state.total += 1
      })
      .addCase(updateTransaction.fulfilled, (state, action) => {
        const index = state.items.findIndex((t) => t.id === action.payload.id)
        if (index !== -1) {
          state.items[index] = action.payload
        }
      })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.items = state.items.filter((t) => t.id !== action.payload)
        state.total -= 1
      })
  },
})

export const { setFilters, setPage, clearError } = transactionSlice.actions
export default transactionSlice.reducer
