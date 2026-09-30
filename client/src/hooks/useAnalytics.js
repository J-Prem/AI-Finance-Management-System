import { useQuery } from 'react-query'
import * as analyticsService from '../services/analyticsService'

export const useSpendingTrend = (days = 180) => {
  return useQuery(
    ['spendingTrend', days],
    () => analyticsService.getSpendingTrend(days),
    { staleTime: 1000 * 60 * 15 }
  )
}

export const useCategoryBreakdown = (days = 30) => {
  return useQuery(
    ['categoryBreakdown', days],
    () => analyticsService.getCategoryBreakdown(days),
    { staleTime: 1000 * 60 * 15 }
  )
}

export const useIncomeExpense = (days = 180) => {
  return useQuery(
    ['incomeExpense', days],
    () => analyticsService.getIncomeExpense(days),
    { staleTime: 1000 * 60 * 15 }
  )
}

export const useFinancialHealth = () => {
  return useQuery(
    ['financialHealth'],
    () => analyticsService.getFinancialHealth(),
    {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  )
}

export const useBudgetAnalysis = () => {
  return useQuery(
    ['budgetAnalysis'],
    () => analyticsService.getBudgetAnalysis(),
    { staleTime: 1000 * 60 * 15 }
  )
}

export const useMonthlyComparison = () => {
  return useQuery(
    ['monthlyComparison'],
    () => analyticsService.getMonthlyComparison(),
    { staleTime: 1000 * 60 * 15 }
  )
}

export const useDashboardStats = () => {
  return useQuery(
    ['dashboardStats'],
    () => analyticsService.getDashboardStats(),
    { staleTime: 1000 * 60 * 10 }
  )
}
