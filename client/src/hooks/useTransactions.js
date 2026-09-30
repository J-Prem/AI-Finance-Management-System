import { useQuery, useMutation, useQueryClient } from 'react-query'
import * as transactionService from '../services/transactionService'

export const useTransactions = (filters = {}, page = 1, limit = 20) => {
  return useQuery(
    ['transactions', filters, page, limit],
    () => transactionService.getTransactions(filters, page, limit),
    {
      keepPreviousData: true,
    }
  )
}

export const useTransaction = (id) => {
  return useQuery(
    ['transaction', id],
    () => transactionService.getTransaction(id),
    {
      enabled: !!id,
    }
  )
}

export const useCreateTransaction = () => {
  const queryClient = useQueryClient()

  return useMutation(
    (data) => transactionService.createTransaction(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('transactions')
        queryClient.invalidateQueries('analytics')
      },
    }
  )
}

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient()

  return useMutation(
    ({ id, data }) => transactionService.updateTransaction(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('transactions')
        queryClient.invalidateQueries('analytics')
      },
    }
  )
}

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient()

  return useMutation(
    (id) => transactionService.deleteTransaction(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('transactions')
        queryClient.invalidateQueries('analytics')
      },
    }
  )
}

export const useImportTransactions = () => {
  const queryClient = useQueryClient()

  return useMutation(
    (file) => transactionService.importTransactions(file),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('transactions')
      },
    }
  )
}

export const useTransactionStats = (filters = {}) => {
  return useQuery(
    ['transactionStats', filters],
    () => transactionService.getTransactionStats(filters)
  )
}
