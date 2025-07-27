/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admins from "../admins.js";
import type * as brands from "../brands.js";
import type * as cashbacks from "../cashbacks.js";
import type * as conversations from "../conversations.js";
import type * as coupons from "../coupons.js";
import type * as preferences from "../preferences.js";
import type * as qloo from "../qloo.js";
import type * as qlooEntities from "../qlooEntities.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admins: typeof admins;
  brands: typeof brands;
  cashbacks: typeof cashbacks;
  conversations: typeof conversations;
  coupons: typeof coupons;
  preferences: typeof preferences;
  qloo: typeof qloo;
  qlooEntities: typeof qlooEntities;
  transactions: typeof transactions;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
