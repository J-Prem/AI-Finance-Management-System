/**
 * DEPRECATED — the in-memory store has been removed. All data lives in
 * MongoDB via Mongoose models. Any method below throws to surface stale
 * callers loudly at runtime. See SETUP_REAL.md.
 */
const boom = () => {
  throw new Error('memoryStore is deprecated. Use the corresponding Mongoose model instead.');
};

export const getUsers = boom;
export const getUser = boom;
export const addUser = boom;
export const updateUser = boom;
export const deleteUser = boom;

export const getTransactions = boom;
export const getTransaction = boom;
export const addTransaction = boom;
export const updateTransaction = boom;
export const deleteTransaction = boom;

export const getBudgets = boom;
export const getBills = boom;
export const getInvestments = boom;
export const getReceipts = boom;
export const addReceipt = boom;

export default {
  getUsers, getUser, addUser, updateUser, deleteUser,
  getTransactions, getTransaction, addTransaction, updateTransaction, deleteTransaction,
  getBudgets, getBills, getInvestments, getReceipts, addReceipt,
};
