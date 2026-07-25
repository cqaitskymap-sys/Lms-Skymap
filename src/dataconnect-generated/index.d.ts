import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateFavoriteData {
  favorite_insert: Favorite_Key;
}

export interface CreateFavoriteVariables {
  foodItemId: UUIDString;
}

export interface CreateFoodItemData {
  foodItem_insert: FoodItem_Key;
}

export interface CreateFoodItemVariables {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface CreateGoalData {
  goal_insert: Goal_Key;
}

export interface CreateGoalVariables {
  startDate: DateString;
  targetWeight: number;
}

export interface CreateLogEntryData {
  logEntry_insert: LogEntry_Key;
}

export interface CreateLogEntryVariables {
  foodItemId: UUIDString;
  mealType: string;
  portionMultiplier: number;
}

export interface CreateUserData {
  user_insert: User_Key;
}

export interface CreateUserVariables {
  username: string;
  email: string;
}

export interface DeleteFavoriteData {
  favorite_delete?: Favorite_Key | null;
}

export interface DeleteFavoriteVariables {
  id: UUIDString;
}

export interface DeleteFoodItemData {
  foodItem_delete?: FoodItem_Key | null;
}

export interface DeleteFoodItemVariables {
  id: UUIDString;
}

export interface DeleteGoalData {
  goal_delete?: Goal_Key | null;
}

export interface DeleteGoalVariables {
  id: UUIDString;
}

export interface DeleteLogEntryData {
  logEntry_delete?: LogEntry_Key | null;
}

export interface DeleteLogEntryVariables {
  id: UUIDString;
}

export interface DeleteUserData {
  user_delete?: User_Key | null;
}

export interface Favorite_Key {
  id: UUIDString;
  __typename?: 'Favorite_Key';
}

export interface FoodItem_Key {
  id: UUIDString;
  __typename?: 'FoodItem_Key';
}

export interface GetCurrentUserData {
  user?: {
    username: string;
    email: string;
    dailyCalorieGoal?: number | null;
    weightGoal?: number | null;
  };
}

export interface GetFavoriteData {
  favorite?: {
    foodItem: {
      name: string;
    };
  };
}

export interface GetFavoriteVariables {
  id: UUIDString;
}

export interface GetFoodItemData {
  foodItem?: {
    name: string;
    calories: number;
    protein: number;
  };
}

export interface GetFoodItemVariables {
  id: UUIDString;
}

export interface GetGoalData {
  goal?: {
    targetWeight?: number | null;
    targetCalories?: number | null;
  };
}

export interface GetGoalVariables {
  id: UUIDString;
}

export interface GetLogEntryData {
  logEntry?: {
    mealType: string;
    portionMultiplier?: number | null;
  };
}

export interface GetLogEntryVariables {
  id: UUIDString;
}

export interface Goal_Key {
  id: UUIDString;
  __typename?: 'Goal_Key';
}

export interface ListFoodItemsData {
  foodItems: ({
    name: string;
    brand?: string | null;
  })[];
}

export interface ListMyFavoritesData {
  favorites: ({
    foodItem: {
      name: string;
    };
  })[];
}

export interface ListMyGoalsData {
  goals: ({
    startDate: DateString;
    targetWeight?: number | null;
  })[];
}

export interface ListMyLogEntriesData {
  logEntries: ({
    mealType: string;
    timestamp: TimestampString;
  })[];
}

export interface ListUsersData {
  users: ({
    username: string;
  })[];
}

export interface LogEntry_Key {
  id: UUIDString;
  __typename?: 'LogEntry_Key';
}

export interface UpdateFoodItemData {
  foodItem_update?: FoodItem_Key | null;
}

export interface UpdateFoodItemVariables {
  id: UUIDString;
  calories?: number | null;
}

export interface UpdateGoalData {
  goal_update?: Goal_Key | null;
}

export interface UpdateGoalVariables {
  id: UUIDString;
  targetWeight: number;
}

export interface UpdateLogEntryData {
  logEntry_update?: LogEntry_Key | null;
}

export interface UpdateLogEntryVariables {
  id: UUIDString;
  portionMultiplier: number;
}

export interface UpdateUserData {
  user_update?: User_Key | null;
}

export interface UpdateUserVariables {
  username?: string | null;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;
export function createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface UpdateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  operationName: string;
}
export const updateUserRef: UpdateUserRef;

export function updateUser(vars?: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;
export function updateUser(dc: DataConnect, vars?: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface DeleteUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<DeleteUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<DeleteUserData, undefined>;
  operationName: string;
}
export const deleteUserRef: DeleteUserRef;

export function deleteUser(): MutationPromise<DeleteUserData, undefined>;
export function deleteUser(dc: DataConnect): MutationPromise<DeleteUserData, undefined>;

interface GetCurrentUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetCurrentUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetCurrentUserData, undefined>;
  operationName: string;
}
export const getCurrentUserRef: GetCurrentUserRef;

export function getCurrentUser(options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;
export function getCurrentUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;

interface ListUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
  operationName: string;
}
export const listUsersRef: ListUsersRef;

export function listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;
export function listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface CreateFoodItemRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateFoodItemVariables): MutationRef<CreateFoodItemData, CreateFoodItemVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateFoodItemVariables): MutationRef<CreateFoodItemData, CreateFoodItemVariables>;
  operationName: string;
}
export const createFoodItemRef: CreateFoodItemRef;

export function createFoodItem(vars: CreateFoodItemVariables): MutationPromise<CreateFoodItemData, CreateFoodItemVariables>;
export function createFoodItem(dc: DataConnect, vars: CreateFoodItemVariables): MutationPromise<CreateFoodItemData, CreateFoodItemVariables>;

interface UpdateFoodItemRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateFoodItemVariables): MutationRef<UpdateFoodItemData, UpdateFoodItemVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateFoodItemVariables): MutationRef<UpdateFoodItemData, UpdateFoodItemVariables>;
  operationName: string;
}
export const updateFoodItemRef: UpdateFoodItemRef;

export function updateFoodItem(vars: UpdateFoodItemVariables): MutationPromise<UpdateFoodItemData, UpdateFoodItemVariables>;
export function updateFoodItem(dc: DataConnect, vars: UpdateFoodItemVariables): MutationPromise<UpdateFoodItemData, UpdateFoodItemVariables>;

interface DeleteFoodItemRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteFoodItemVariables): MutationRef<DeleteFoodItemData, DeleteFoodItemVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteFoodItemVariables): MutationRef<DeleteFoodItemData, DeleteFoodItemVariables>;
  operationName: string;
}
export const deleteFoodItemRef: DeleteFoodItemRef;

export function deleteFoodItem(vars: DeleteFoodItemVariables): MutationPromise<DeleteFoodItemData, DeleteFoodItemVariables>;
export function deleteFoodItem(dc: DataConnect, vars: DeleteFoodItemVariables): MutationPromise<DeleteFoodItemData, DeleteFoodItemVariables>;

interface GetFoodItemRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetFoodItemVariables): QueryRef<GetFoodItemData, GetFoodItemVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetFoodItemVariables): QueryRef<GetFoodItemData, GetFoodItemVariables>;
  operationName: string;
}
export const getFoodItemRef: GetFoodItemRef;

export function getFoodItem(vars: GetFoodItemVariables, options?: ExecuteQueryOptions): QueryPromise<GetFoodItemData, GetFoodItemVariables>;
export function getFoodItem(dc: DataConnect, vars: GetFoodItemVariables, options?: ExecuteQueryOptions): QueryPromise<GetFoodItemData, GetFoodItemVariables>;

interface ListFoodItemsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListFoodItemsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListFoodItemsData, undefined>;
  operationName: string;
}
export const listFoodItemsRef: ListFoodItemsRef;

export function listFoodItems(options?: ExecuteQueryOptions): QueryPromise<ListFoodItemsData, undefined>;
export function listFoodItems(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListFoodItemsData, undefined>;

interface CreateLogEntryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateLogEntryVariables): MutationRef<CreateLogEntryData, CreateLogEntryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateLogEntryVariables): MutationRef<CreateLogEntryData, CreateLogEntryVariables>;
  operationName: string;
}
export const createLogEntryRef: CreateLogEntryRef;

export function createLogEntry(vars: CreateLogEntryVariables): MutationPromise<CreateLogEntryData, CreateLogEntryVariables>;
export function createLogEntry(dc: DataConnect, vars: CreateLogEntryVariables): MutationPromise<CreateLogEntryData, CreateLogEntryVariables>;

interface UpdateLogEntryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateLogEntryVariables): MutationRef<UpdateLogEntryData, UpdateLogEntryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateLogEntryVariables): MutationRef<UpdateLogEntryData, UpdateLogEntryVariables>;
  operationName: string;
}
export const updateLogEntryRef: UpdateLogEntryRef;

export function updateLogEntry(vars: UpdateLogEntryVariables): MutationPromise<UpdateLogEntryData, UpdateLogEntryVariables>;
export function updateLogEntry(dc: DataConnect, vars: UpdateLogEntryVariables): MutationPromise<UpdateLogEntryData, UpdateLogEntryVariables>;

interface DeleteLogEntryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteLogEntryVariables): MutationRef<DeleteLogEntryData, DeleteLogEntryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteLogEntryVariables): MutationRef<DeleteLogEntryData, DeleteLogEntryVariables>;
  operationName: string;
}
export const deleteLogEntryRef: DeleteLogEntryRef;

export function deleteLogEntry(vars: DeleteLogEntryVariables): MutationPromise<DeleteLogEntryData, DeleteLogEntryVariables>;
export function deleteLogEntry(dc: DataConnect, vars: DeleteLogEntryVariables): MutationPromise<DeleteLogEntryData, DeleteLogEntryVariables>;

interface GetLogEntryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetLogEntryVariables): QueryRef<GetLogEntryData, GetLogEntryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetLogEntryVariables): QueryRef<GetLogEntryData, GetLogEntryVariables>;
  operationName: string;
}
export const getLogEntryRef: GetLogEntryRef;

export function getLogEntry(vars: GetLogEntryVariables, options?: ExecuteQueryOptions): QueryPromise<GetLogEntryData, GetLogEntryVariables>;
export function getLogEntry(dc: DataConnect, vars: GetLogEntryVariables, options?: ExecuteQueryOptions): QueryPromise<GetLogEntryData, GetLogEntryVariables>;

interface ListMyLogEntriesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyLogEntriesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyLogEntriesData, undefined>;
  operationName: string;
}
export const listMyLogEntriesRef: ListMyLogEntriesRef;

export function listMyLogEntries(options?: ExecuteQueryOptions): QueryPromise<ListMyLogEntriesData, undefined>;
export function listMyLogEntries(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyLogEntriesData, undefined>;

interface CreateGoalRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGoalVariables): MutationRef<CreateGoalData, CreateGoalVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateGoalVariables): MutationRef<CreateGoalData, CreateGoalVariables>;
  operationName: string;
}
export const createGoalRef: CreateGoalRef;

export function createGoal(vars: CreateGoalVariables): MutationPromise<CreateGoalData, CreateGoalVariables>;
export function createGoal(dc: DataConnect, vars: CreateGoalVariables): MutationPromise<CreateGoalData, CreateGoalVariables>;

interface UpdateGoalRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateGoalVariables): MutationRef<UpdateGoalData, UpdateGoalVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateGoalVariables): MutationRef<UpdateGoalData, UpdateGoalVariables>;
  operationName: string;
}
export const updateGoalRef: UpdateGoalRef;

export function updateGoal(vars: UpdateGoalVariables): MutationPromise<UpdateGoalData, UpdateGoalVariables>;
export function updateGoal(dc: DataConnect, vars: UpdateGoalVariables): MutationPromise<UpdateGoalData, UpdateGoalVariables>;

interface DeleteGoalRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteGoalVariables): MutationRef<DeleteGoalData, DeleteGoalVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteGoalVariables): MutationRef<DeleteGoalData, DeleteGoalVariables>;
  operationName: string;
}
export const deleteGoalRef: DeleteGoalRef;

export function deleteGoal(vars: DeleteGoalVariables): MutationPromise<DeleteGoalData, DeleteGoalVariables>;
export function deleteGoal(dc: DataConnect, vars: DeleteGoalVariables): MutationPromise<DeleteGoalData, DeleteGoalVariables>;

interface GetGoalRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetGoalVariables): QueryRef<GetGoalData, GetGoalVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetGoalVariables): QueryRef<GetGoalData, GetGoalVariables>;
  operationName: string;
}
export const getGoalRef: GetGoalRef;

export function getGoal(vars: GetGoalVariables, options?: ExecuteQueryOptions): QueryPromise<GetGoalData, GetGoalVariables>;
export function getGoal(dc: DataConnect, vars: GetGoalVariables, options?: ExecuteQueryOptions): QueryPromise<GetGoalData, GetGoalVariables>;

interface ListMyGoalsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyGoalsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyGoalsData, undefined>;
  operationName: string;
}
export const listMyGoalsRef: ListMyGoalsRef;

export function listMyGoals(options?: ExecuteQueryOptions): QueryPromise<ListMyGoalsData, undefined>;
export function listMyGoals(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyGoalsData, undefined>;

interface CreateFavoriteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateFavoriteVariables): MutationRef<CreateFavoriteData, CreateFavoriteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateFavoriteVariables): MutationRef<CreateFavoriteData, CreateFavoriteVariables>;
  operationName: string;
}
export const createFavoriteRef: CreateFavoriteRef;

export function createFavorite(vars: CreateFavoriteVariables): MutationPromise<CreateFavoriteData, CreateFavoriteVariables>;
export function createFavorite(dc: DataConnect, vars: CreateFavoriteVariables): MutationPromise<CreateFavoriteData, CreateFavoriteVariables>;

interface DeleteFavoriteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteFavoriteVariables): MutationRef<DeleteFavoriteData, DeleteFavoriteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteFavoriteVariables): MutationRef<DeleteFavoriteData, DeleteFavoriteVariables>;
  operationName: string;
}
export const deleteFavoriteRef: DeleteFavoriteRef;

export function deleteFavorite(vars: DeleteFavoriteVariables): MutationPromise<DeleteFavoriteData, DeleteFavoriteVariables>;
export function deleteFavorite(dc: DataConnect, vars: DeleteFavoriteVariables): MutationPromise<DeleteFavoriteData, DeleteFavoriteVariables>;

interface GetFavoriteRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetFavoriteVariables): QueryRef<GetFavoriteData, GetFavoriteVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetFavoriteVariables): QueryRef<GetFavoriteData, GetFavoriteVariables>;
  operationName: string;
}
export const getFavoriteRef: GetFavoriteRef;

export function getFavorite(vars: GetFavoriteVariables, options?: ExecuteQueryOptions): QueryPromise<GetFavoriteData, GetFavoriteVariables>;
export function getFavorite(dc: DataConnect, vars: GetFavoriteVariables, options?: ExecuteQueryOptions): QueryPromise<GetFavoriteData, GetFavoriteVariables>;

interface ListMyFavoritesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyFavoritesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyFavoritesData, undefined>;
  operationName: string;
}
export const listMyFavoritesRef: ListMyFavoritesRef;

export function listMyFavorites(options?: ExecuteQueryOptions): QueryPromise<ListMyFavoritesData, undefined>;
export function listMyFavorites(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyFavoritesData, undefined>;

