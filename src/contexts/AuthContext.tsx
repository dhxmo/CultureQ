"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  Dispatch,
  ReactNode,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getAttachedBrandsForMerchants, isQlooCacheExpired, isCacheInvalidatedByPreferences } from "../lib/qloo";

interface TransactionRequest {
  userId: string;
  startDate?: string; // ISO date string (YYYY-MM-DD)
  endDate?: string; // ISO date string (YYYY-MM-DD)
  count?: number; // Number of transactions to fetch
}

// Utility functions for date handling
const formatDateToISO = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

const getDefaultStartDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 90); // 90 days ago
  return formatDateToISO(date);
};

const getDefaultEndDate = (): string => {
  return formatDateToISO(new Date()); // Today
};

const validateDateRange = (
  startDate: string,
  endDate: string,
): { isValid: boolean; error?: string } => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { isValid: false, error: "Invalid date format" };
  }

  if (start > today) {
    return { isValid: false, error: "Start date cannot be in the future" };
  }

  if (end > today) {
    return { isValid: false, error: "End date cannot be in the future" };
  }

  if (start > end) {
    return { isValid: false, error: "Start date must be before end date" };
  }

  return { isValid: true };
};

interface TransactionData {
  merchants: Array<{
    name: string;
    displayName: string;
    category: string;
    amount: number;
    date: string;
  }>;
  categories: string[];
  totalTransactions: number;
  lastFetched?: number;
  attachedBrands?: Array<{
    merchantName: string;
    brands: Array<{
      name: string;
      entity_id: string;
      popularity: number;
      affinity: number;
      audience_growth: number;
    }>;
  }> | null;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  plaidItemId: string | null;
  error: string | null;
  transactions: TransactionData | null;
  isLoadingTransactions: boolean;
  currentPage: number;
  itemsPerPage: number;
}

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  userId: null,
  plaidItemId: null,
  error: null,
  transactions: null,
  isLoadingTransactions: false,
  currentPage: 1,
  itemsPerPage: 10,
};

type AuthAction =
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_AUTHENTICATED"; userId: string; plaidItemId: string }
  | { type: "SET_UNAUTHENTICATED" }
  | { type: "SET_ERROR"; error: string }
  | { type: "CLEAR_ERROR" }
  | { type: "UPDATE_STATE"; state: Partial<AuthState> }
  | { type: "SET_TRANSACTIONS_LOADING"; loading: boolean }
  | { type: "SET_TRANSACTIONS"; transactions: TransactionData }
  | { type: "CLEAR_TRANSACTIONS" }
  | { type: "SET_PAGE"; page: number }
  | { type: "SET_ITEMS_PER_PAGE"; itemsPerPage: number };

interface AuthContextType extends AuthState {
  dispatch: Dispatch<AuthAction>;
  login: (userId: string, plaidItemId: string) => void;
  logout: () => void;
  clearError: () => void;
  fetchTransactions: (
    options?: Partial<Omit<TransactionRequest, "userId">>,
  ) => Promise<void>;
  clearTransactions: () => void;
  setPage: (page: number) => void;
  setItemsPerPage: (itemsPerPage: number) => void;
  getPaginatedTransactions: () => Array<{
    name: string;
    displayName: string;
    category: string;
    amount: number;
    date: string;
  }>;
  getTotalPages: () => number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };

    case "SET_AUTHENTICATED":
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        userId: action.userId,
        plaidItemId: action.plaidItemId,
        error: null,
      };

    case "SET_UNAUTHENTICATED":
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        userId: null,
        plaidItemId: null,
        error: null,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.error,
        isLoading: false,
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };

    case "UPDATE_STATE":
      return { ...state, ...action.state };

    case "SET_TRANSACTIONS_LOADING":
      return { ...state, isLoadingTransactions: action.loading };

    case "SET_TRANSACTIONS":
      return {
        ...state,
        transactions: action.transactions,
        isLoadingTransactions: false,
      };

    case "CLEAR_TRANSACTIONS":
      return {
        ...state,
        transactions: null,
        isLoadingTransactions: false,
      };

    case "SET_PAGE":
      return {
        ...state,
        currentPage: action.page,
      };

    case "SET_ITEMS_PER_PAGE":
      return {
        ...state,
        itemsPerPage: action.itemsPerPage,
        currentPage: 1, // Reset to first page when changing items per page
      };

    default:
      return state;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Convex hooks for Qloo cache management
  const updateQlooCache = useMutation(api.qloo.updateQlooCache);
  const qlooCache = useQuery(
    api.qloo.getQlooCache,
    state.userId ? { userId: state.userId as Id<"users"> } : "skip",
  );

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const checkAuthState = () => {
      try {
        const userId = localStorage.getItem("cultureq_user_id");
        const plaidItemId = localStorage.getItem("cultureq_plaid_item_id");

        if (userId && plaidItemId) {
          dispatch({
            type: "SET_AUTHENTICATED",
            userId,
            plaidItemId,
          });
        } else {
          dispatch({ type: "SET_UNAUTHENTICATED" });
        }
      } catch (error) {
        console.error("Error checking auth state:", error);
        dispatch({
          type: "SET_ERROR",
          error: "Failed to load authentication state",
        });
      }
    };

    checkAuthState();
  }, []);

  const login = (userId: string, plaidItemId: string) => {
    try {
      localStorage.setItem("cultureq_user_id", userId);
      localStorage.setItem("cultureq_plaid_item_id", plaidItemId);
      dispatch({
        type: "SET_AUTHENTICATED",
        userId,
        plaidItemId,
      });
    } catch (error) {
      console.error("Error during login:", error);
      dispatch({
        type: "SET_ERROR",
        error: "Failed to save authentication data",
      });
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem("cultureq_user_id");
      localStorage.removeItem("cultureq_plaid_item_id");
      dispatch({ type: "SET_UNAUTHENTICATED" });
    } catch (error) {
      console.error("Error during logout:", error);
      dispatch({
        type: "SET_ERROR",
        error: "Failed to clear authentication data",
      });
    }
  };

  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  // Get current user data for Qloo API
  const currentUser = useQuery(
    api.users.getUserById,
    state.userId ? { userId: state.userId as Id<"users"> } : "skip",
  );

  // Production-ready Qloo attached brands with caching
  const fetchQlooAttachedBrands = useCallback(
    async (
      userId: string,
      merchantNames: string[],
    ): Promise<Array<{
      merchantName: string;
      brands: Array<{
        name: string;
        entity_id: string;
        popularity: number;
        affinity: number;
        audience_growth: number;
      }>;
    }> | null> => {
      try {
        // Check if user has set required preferences
        const userAge = currentUser?.age;
        const userLocation = currentUser?.location;
        const excludedMerchants = currentUser?.excludedMerchants || [];

        // Validate that user has completed their profile
        if (!userAge || !userLocation) {
          const missingFields = [];
          if (!userAge) missingFields.push("age");
          if (!userLocation) missingFields.push("location");
          
          window.alert(
            `Please complete your profile first!\n\n` +
            `Missing: ${missingFields.join(", ")}\n\n` +
            `Go to Profile → Set your ${missingFields.join(" and ")} to get personalized recommendations.`
          );
          
          console.log(`Skipping Qloo fetch - missing required fields: ${missingFields.join(", ")}`);
          return null;
        }

        // Check if cache exists and is not expired, and preferences haven't changed
        const cacheExpired = isQlooCacheExpired(qlooCache?.lastQlooFetch);
        const preferencesChanged = qlooCache?.hasCachedData ? 
          isCacheInvalidatedByPreferences(
            qlooCache.userAge || 0, // Use 0 as invalid age for comparison
            qlooCache.userLocation || "",
            qlooCache.excludedMerchants,
            userAge,
            userLocation,
            excludedMerchants
          ) : false;

        if (
          qlooCache?.hasCachedData &&
          !cacheExpired &&
          !preferencesChanged
        ) {
          console.log("Using cached Qloo data");
          return qlooCache.attachedBrands || null;
        }

        if (preferencesChanged) {
          console.log("Cache invalidated due to user preference changes");
        }

        console.log("Fetching fresh Qloo data - cache expired or missing");

        // Filter out excluded merchants
        const filteredMerchantNames = merchantNames.filter(
          (merchantName) => !excludedMerchants.includes(merchantName),
        );

        console.log(
          `Using user preferences: Age ${userAge}, Location ${userLocation}`,
        );
        console.log(
          `Excluded merchants: ${excludedMerchants.length} (${excludedMerchants.join(", ")})`,
        );
        console.log(
          `Fetching for ${filteredMerchantNames.length} merchants after filtering`,
        );

        // Fetch fresh data from Qloo API with user's preferences and filtered merchants
        const attachedBrandsData = await getAttachedBrandsForMerchants(
          filteredMerchantNames,
          userAge,
          userLocation,
        );

        // Save to Convex cache
        if (attachedBrandsData && attachedBrandsData.length > 0) {
          await updateQlooCache({
            userId: userId as Id<"users">,
            attachedBrands: attachedBrandsData,
          });
          console.log("Saved fresh Qloo data to cache");
        }

        return attachedBrandsData;
      } catch (error) {
        console.error("Error in fetchQlooAttachedBrands:", error);
        return null;
      }
    },
    [qlooCache, updateQlooCache, currentUser],
  );

  const fetchTransactions = useCallback(
    async (options?: Partial<Omit<TransactionRequest, "userId">>) => {
      if (!state.isAuthenticated || !state.userId) {
        dispatch({ type: "SET_ERROR", error: "User not authenticated" });
        return;
      }

      dispatch({ type: "SET_TRANSACTIONS_LOADING", loading: true });

      try {
        // Set up default parameters
        const startDate = options?.startDate || getDefaultStartDate();
        const endDate = options?.endDate || getDefaultEndDate();
        const count = options?.count || 100;

        // Validate date range
        const validation = validateDateRange(startDate, endDate);
        if (!validation.isValid) {
          throw new Error(validation.error);
        }

        // Validate count
        if (count <= 0 || count > 500) {
          throw new Error("Count must be between 1 and 500");
        }

        // Build complete request body
        const requestBody: TransactionRequest = {
          userId: state.userId,
          startDate,
          endDate,
          count,
        };

        // Fetch transactions using full parameters
        const response = await fetch("/api/plaid/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const transactionData = await response.json();

        // Fetch Qloo attached brands data using our isolated function
        // Limit to first 10 merchants to avoid API rate limiting during testing
        const merchantNames =
          transactionData.merchants?.map((m: { name: string }) => m.name) || [];
        // transactionData.merchants?.map((m: { name: string }) => m.name).slice(0, 2) || [];
        const attachedBrandsData = await fetchQlooAttachedBrands(
          state.userId,
          merchantNames,
        );

        const finalTransactionData: TransactionData = {
          ...transactionData,
          attachedBrands: attachedBrandsData,
          lastFetched: Date.now(),
        };

        dispatch({
          type: "SET_TRANSACTIONS",
          transactions: finalTransactionData,
        });
      } catch (error) {
        console.error("Error fetching transactions:", error);
        dispatch({
          type: "SET_ERROR",
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch transactions",
        });
        dispatch({ type: "SET_TRANSACTIONS_LOADING", loading: false });
      }
    },
    [state.isAuthenticated, state.userId, fetchQlooAttachedBrands],
  );

  const clearTransactions = () => {
    dispatch({ type: "CLEAR_TRANSACTIONS" });
  };

  const setPage = (page: number) => {
    dispatch({ type: "SET_PAGE", page });
  };

  const setItemsPerPage = (itemsPerPage: number) => {
    dispatch({ type: "SET_ITEMS_PER_PAGE", itemsPerPage });
  };

  const getPaginatedTransactions = () => {
    if (!state.transactions?.merchants) return [];

    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;

    return state.transactions.merchants.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    if (!state.transactions?.merchants) return 0;
    return Math.ceil(state.transactions.merchants.length / state.itemsPerPage);
  };

  const contextValue: AuthContextType = {
    ...state,
    dispatch,
    login,
    logout,
    clearError,
    fetchTransactions,
    clearTransactions,
    setPage,
    setItemsPerPage,
    getPaginatedTransactions,
    getTotalPages,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
