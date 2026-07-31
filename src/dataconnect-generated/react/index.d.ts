import { CreateUserData, CreateUserVariables, UpdateUserData, UpdateUserVariables, DeleteUserData, GetCurrentUserData, ListUsersData, CreateFoodItemData, CreateFoodItemVariables, UpdateFoodItemData, UpdateFoodItemVariables, DeleteFoodItemData, DeleteFoodItemVariables, GetFoodItemData, GetFoodItemVariables, ListFoodItemsData, CreateLogEntryData, CreateLogEntryVariables, UpdateLogEntryData, UpdateLogEntryVariables, DeleteLogEntryData, DeleteLogEntryVariables, GetLogEntryData, GetLogEntryVariables, ListMyLogEntriesData, CreateGoalData, CreateGoalVariables, UpdateGoalData, UpdateGoalVariables, DeleteGoalData, DeleteGoalVariables, GetGoalData, GetGoalVariables, ListMyGoalsData, CreateFavoriteData, CreateFavoriteVariables, DeleteFavoriteData, DeleteFavoriteVariables, GetFavoriteData, GetFavoriteVariables, ListMyFavoritesData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateUser(options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, CreateUserVariables>): UseDataConnectMutationResult<CreateUserData, CreateUserVariables>;
export function useCreateUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, CreateUserVariables>): UseDataConnectMutationResult<CreateUserData, CreateUserVariables>;

export function useUpdateUser(options?: useDataConnectMutationOptions<UpdateUserData, FirebaseError, UpdateUserVariables | void>): UseDataConnectMutationResult<UpdateUserData, UpdateUserVariables>;
export function useUpdateUser(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateUserData, FirebaseError, UpdateUserVariables | void>): UseDataConnectMutationResult<UpdateUserData, UpdateUserVariables>;

export function useDeleteUser(options?: useDataConnectMutationOptions<DeleteUserData, FirebaseError, void>): UseDataConnectMutationResult<DeleteUserData, undefined>;
export function useDeleteUser(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteUserData, FirebaseError, void>): UseDataConnectMutationResult<DeleteUserData, undefined>;

export function useGetCurrentUser(options?: useDataConnectQueryOptions<GetCurrentUserData>): UseDataConnectQueryResult<GetCurrentUserData, undefined>;
export function useGetCurrentUser(dc: DataConnect, options?: useDataConnectQueryOptions<GetCurrentUserData>): UseDataConnectQueryResult<GetCurrentUserData, undefined>;

export function useListUsers(options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;
export function useListUsers(dc: DataConnect, options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;

export function useCreateFoodItem(options?: useDataConnectMutationOptions<CreateFoodItemData, FirebaseError, CreateFoodItemVariables>): UseDataConnectMutationResult<CreateFoodItemData, CreateFoodItemVariables>;
export function useCreateFoodItem(dc: DataConnect, options?: useDataConnectMutationOptions<CreateFoodItemData, FirebaseError, CreateFoodItemVariables>): UseDataConnectMutationResult<CreateFoodItemData, CreateFoodItemVariables>;

export function useUpdateFoodItem(options?: useDataConnectMutationOptions<UpdateFoodItemData, FirebaseError, UpdateFoodItemVariables>): UseDataConnectMutationResult<UpdateFoodItemData, UpdateFoodItemVariables>;
export function useUpdateFoodItem(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateFoodItemData, FirebaseError, UpdateFoodItemVariables>): UseDataConnectMutationResult<UpdateFoodItemData, UpdateFoodItemVariables>;

export function useDeleteFoodItem(options?: useDataConnectMutationOptions<DeleteFoodItemData, FirebaseError, DeleteFoodItemVariables>): UseDataConnectMutationResult<DeleteFoodItemData, DeleteFoodItemVariables>;
export function useDeleteFoodItem(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteFoodItemData, FirebaseError, DeleteFoodItemVariables>): UseDataConnectMutationResult<DeleteFoodItemData, DeleteFoodItemVariables>;

export function useGetFoodItem(vars: GetFoodItemVariables, options?: useDataConnectQueryOptions<GetFoodItemData>): UseDataConnectQueryResult<GetFoodItemData, GetFoodItemVariables>;
export function useGetFoodItem(dc: DataConnect, vars: GetFoodItemVariables, options?: useDataConnectQueryOptions<GetFoodItemData>): UseDataConnectQueryResult<GetFoodItemData, GetFoodItemVariables>;

export function useListFoodItems(options?: useDataConnectQueryOptions<ListFoodItemsData>): UseDataConnectQueryResult<ListFoodItemsData, undefined>;
export function useListFoodItems(dc: DataConnect, options?: useDataConnectQueryOptions<ListFoodItemsData>): UseDataConnectQueryResult<ListFoodItemsData, undefined>;

export function useCreateLogEntry(options?: useDataConnectMutationOptions<CreateLogEntryData, FirebaseError, CreateLogEntryVariables>): UseDataConnectMutationResult<CreateLogEntryData, CreateLogEntryVariables>;
export function useCreateLogEntry(dc: DataConnect, options?: useDataConnectMutationOptions<CreateLogEntryData, FirebaseError, CreateLogEntryVariables>): UseDataConnectMutationResult<CreateLogEntryData, CreateLogEntryVariables>;

export function useUpdateLogEntry(options?: useDataConnectMutationOptions<UpdateLogEntryData, FirebaseError, UpdateLogEntryVariables>): UseDataConnectMutationResult<UpdateLogEntryData, UpdateLogEntryVariables>;
export function useUpdateLogEntry(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateLogEntryData, FirebaseError, UpdateLogEntryVariables>): UseDataConnectMutationResult<UpdateLogEntryData, UpdateLogEntryVariables>;

export function useDeleteLogEntry(options?: useDataConnectMutationOptions<DeleteLogEntryData, FirebaseError, DeleteLogEntryVariables>): UseDataConnectMutationResult<DeleteLogEntryData, DeleteLogEntryVariables>;
export function useDeleteLogEntry(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteLogEntryData, FirebaseError, DeleteLogEntryVariables>): UseDataConnectMutationResult<DeleteLogEntryData, DeleteLogEntryVariables>;

export function useGetLogEntry(vars: GetLogEntryVariables, options?: useDataConnectQueryOptions<GetLogEntryData>): UseDataConnectQueryResult<GetLogEntryData, GetLogEntryVariables>;
export function useGetLogEntry(dc: DataConnect, vars: GetLogEntryVariables, options?: useDataConnectQueryOptions<GetLogEntryData>): UseDataConnectQueryResult<GetLogEntryData, GetLogEntryVariables>;

export function useListMyLogEntries(options?: useDataConnectQueryOptions<ListMyLogEntriesData>): UseDataConnectQueryResult<ListMyLogEntriesData, undefined>;
export function useListMyLogEntries(dc: DataConnect, options?: useDataConnectQueryOptions<ListMyLogEntriesData>): UseDataConnectQueryResult<ListMyLogEntriesData, undefined>;

export function useCreateGoal(options?: useDataConnectMutationOptions<CreateGoalData, FirebaseError, CreateGoalVariables>): UseDataConnectMutationResult<CreateGoalData, CreateGoalVariables>;
export function useCreateGoal(dc: DataConnect, options?: useDataConnectMutationOptions<CreateGoalData, FirebaseError, CreateGoalVariables>): UseDataConnectMutationResult<CreateGoalData, CreateGoalVariables>;

export function useUpdateGoal(options?: useDataConnectMutationOptions<UpdateGoalData, FirebaseError, UpdateGoalVariables>): UseDataConnectMutationResult<UpdateGoalData, UpdateGoalVariables>;
export function useUpdateGoal(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateGoalData, FirebaseError, UpdateGoalVariables>): UseDataConnectMutationResult<UpdateGoalData, UpdateGoalVariables>;

export function useDeleteGoal(options?: useDataConnectMutationOptions<DeleteGoalData, FirebaseError, DeleteGoalVariables>): UseDataConnectMutationResult<DeleteGoalData, DeleteGoalVariables>;
export function useDeleteGoal(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteGoalData, FirebaseError, DeleteGoalVariables>): UseDataConnectMutationResult<DeleteGoalData, DeleteGoalVariables>;

export function useGetGoal(vars: GetGoalVariables, options?: useDataConnectQueryOptions<GetGoalData>): UseDataConnectQueryResult<GetGoalData, GetGoalVariables>;
export function useGetGoal(dc: DataConnect, vars: GetGoalVariables, options?: useDataConnectQueryOptions<GetGoalData>): UseDataConnectQueryResult<GetGoalData, GetGoalVariables>;

export function useListMyGoals(options?: useDataConnectQueryOptions<ListMyGoalsData>): UseDataConnectQueryResult<ListMyGoalsData, undefined>;
export function useListMyGoals(dc: DataConnect, options?: useDataConnectQueryOptions<ListMyGoalsData>): UseDataConnectQueryResult<ListMyGoalsData, undefined>;

export function useCreateFavorite(options?: useDataConnectMutationOptions<CreateFavoriteData, FirebaseError, CreateFavoriteVariables>): UseDataConnectMutationResult<CreateFavoriteData, CreateFavoriteVariables>;
export function useCreateFavorite(dc: DataConnect, options?: useDataConnectMutationOptions<CreateFavoriteData, FirebaseError, CreateFavoriteVariables>): UseDataConnectMutationResult<CreateFavoriteData, CreateFavoriteVariables>;

export function useDeleteFavorite(options?: useDataConnectMutationOptions<DeleteFavoriteData, FirebaseError, DeleteFavoriteVariables>): UseDataConnectMutationResult<DeleteFavoriteData, DeleteFavoriteVariables>;
export function useDeleteFavorite(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteFavoriteData, FirebaseError, DeleteFavoriteVariables>): UseDataConnectMutationResult<DeleteFavoriteData, DeleteFavoriteVariables>;

export function useGetFavorite(vars: GetFavoriteVariables, options?: useDataConnectQueryOptions<GetFavoriteData>): UseDataConnectQueryResult<GetFavoriteData, GetFavoriteVariables>;
export function useGetFavorite(dc: DataConnect, vars: GetFavoriteVariables, options?: useDataConnectQueryOptions<GetFavoriteData>): UseDataConnectQueryResult<GetFavoriteData, GetFavoriteVariables>;

export function useListMyFavorites(options?: useDataConnectQueryOptions<ListMyFavoritesData>): UseDataConnectQueryResult<ListMyFavoritesData, undefined>;
export function useListMyFavorites(dc: DataConnect, options?: useDataConnectQueryOptions<ListMyFavoritesData>): UseDataConnectQueryResult<ListMyFavoritesData, undefined>;
