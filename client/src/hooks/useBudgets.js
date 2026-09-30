import { useMutation, useQuery, useQueryClient } from 'react-query'
import {
  getBudgets,
  getBudgetStatus,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetAlerts,
} from '../services/budgetService'

// Status is the most useful read for the dashboard — it merges the Budget
// doc + computed virtuals (remaining, percentSpent, status) in a single call.
export function useBudgetStatus() {
  return useQuery(['budget-status'], async () => {
    const r = await getBudgetStatus()
    return r?.data?.budgets || r?.data || []
  }, {
    staleTime: 15_000,
    refetchInterval: 30_000, // keep live
    refetchOnWindowFocus: true,
  })
}

export function useBudgets() {
  return useQuery(['budgets'], async () => {
    const r = await getBudgets()
    return r?.data?.budgets || r?.data || []
  }, {
    staleTime: 30_000,
  })
}

export function useBudgetAlerts() {
  return useQuery(['budget-alerts'], async () => {
    const r = await getBudgetAlerts()
    return r?.data?.alerts || r?.data || []
  }, {
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation((data) => createBudget(data), {
    onSuccess: () => {
      qc.invalidateQueries(['budgets'])
      qc.invalidateQueries(['budget-status'])
    },
  })
}

export function useUpdateBudget() {
  const qc = useQueryClient()
  return useMutation(({ id, data }) => updateBudget(id, data), {
    onSuccess: () => {
      qc.invalidateQueries(['budgets'])
      qc.invalidateQueries(['budget-status'])
    },
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation((id) => deleteBudget(id), {
    onSuccess: () => {
      qc.invalidateQueries(['budgets'])
      qc.invalidateQueries(['budget-status'])
    },
  })
}
