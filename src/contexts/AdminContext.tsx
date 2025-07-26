"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
  Dispatch,
} from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface AdminState {
  isAuthenticated: boolean;
  isLoading: boolean;
  adminId: string | null;
  username: string | null;
  email: string | null;
  error: string | null;
}

const initialState: AdminState = {
  isAuthenticated: false,
  isLoading: true,
  adminId: null,
  username: null,
  email: null,
  error: null,
};

type AdminAction =
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_AUTHENTICATED"; adminId: string; username: string; email: string }
  | { type: "SET_UNAUTHENTICATED" }
  | { type: "SET_ERROR"; error: string }
  | { type: "CLEAR_ERROR" };

interface AdminContextType extends AdminState {
  dispatch: Dispatch<AdminAction>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const adminReducer = (state: AdminState, action: AdminAction): AdminState => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };

    case "SET_AUTHENTICATED":
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        adminId: action.adminId,
        username: action.username,
        email: action.email,
        error: null,
      };

    case "SET_UNAUTHENTICATED":
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        adminId: null,
        username: null,
        email: null,
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

    default:
      return state;
  }
};

// Simple hash function (same as bootstrap script)
const simpleHash = (password: string): string => {
  return btoa(password); // Base64 encoding for MVP
};

export const AdminProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(adminReducer, initialState);
  const loginAdminMutation = useMutation(api.admins.loginAdmin);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const checkAuthState = () => {
      try {
        const adminId = localStorage.getItem("admin_id");
        const username = localStorage.getItem("admin_username");
        const email = localStorage.getItem("admin_email");

        if (adminId && username && email) {
          dispatch({
            type: "SET_AUTHENTICATED",
            adminId,
            username,
            email,
          });
        } else {
          dispatch({ type: "SET_UNAUTHENTICATED" });
        }
      } catch (error) {
        console.error("Error checking admin auth state:", error);
        dispatch({
          type: "SET_ERROR",
          error: "Failed to load authentication state",
        });
      }
    };

    checkAuthState();
  }, []);

  const login = async (username: string, password: string) => {
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "CLEAR_ERROR" });

    try {
      const passwordHash = simpleHash(password);
      const result = await loginAdminMutation({ username, passwordHash });

      localStorage.setItem("admin_id", result.adminId);
      localStorage.setItem("admin_username", result.username);
      localStorage.setItem("admin_email", result.email);

      dispatch({
        type: "SET_AUTHENTICATED",
        adminId: result.adminId,
        username: result.username,
        email: result.email,
      });
    } catch (error) {
      console.error("Error during admin login:", error);
      dispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "Login failed",
      });
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem("admin_id");
      localStorage.removeItem("admin_username");
      localStorage.removeItem("admin_email");
      dispatch({ type: "SET_UNAUTHENTICATED" });
    } catch (error) {
      console.error("Error during admin logout:", error);
      dispatch({
        type: "SET_ERROR",
        error: "Failed to clear authentication data",
      });
    }
  };

  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  const contextValue: AdminContextType = {
    ...state,
    dispatch,
    login,
    logout,
    clearError,
  };

  return (
    <AdminContext.Provider value={contextValue}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = (): AdminContextType => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
};

export default AdminContext;