# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetCurrentUser*](#getcurrentuser)
  - [*ListUsers*](#listusers)
  - [*GetFoodItem*](#getfooditem)
  - [*ListFoodItems*](#listfooditems)
  - [*GetLogEntry*](#getlogentry)
  - [*ListMyLogEntries*](#listmylogentries)
  - [*GetGoal*](#getgoal)
  - [*ListMyGoals*](#listmygoals)
  - [*GetFavorite*](#getfavorite)
  - [*ListMyFavorites*](#listmyfavorites)
- [**Mutations**](#mutations)
  - [*CreateUser*](#createuser)
  - [*UpdateUser*](#updateuser)
  - [*DeleteUser*](#deleteuser)
  - [*CreateFoodItem*](#createfooditem)
  - [*UpdateFoodItem*](#updatefooditem)
  - [*DeleteFoodItem*](#deletefooditem)
  - [*CreateLogEntry*](#createlogentry)
  - [*UpdateLogEntry*](#updatelogentry)
  - [*DeleteLogEntry*](#deletelogentry)
  - [*CreateGoal*](#creategoal)
  - [*UpdateGoal*](#updategoal)
  - [*DeleteGoal*](#deletegoal)
  - [*CreateFavorite*](#createfavorite)
  - [*DeleteFavorite*](#deletefavorite)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetCurrentUser
You can execute the `GetCurrentUser` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getCurrentUser(options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;

interface GetCurrentUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetCurrentUserData, undefined>;
}
export const getCurrentUserRef: GetCurrentUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getCurrentUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetCurrentUserData, undefined>;

interface GetCurrentUserRef {
  ...
  (dc: DataConnect): QueryRef<GetCurrentUserData, undefined>;
}
export const getCurrentUserRef: GetCurrentUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getCurrentUserRef:
```typescript
const name = getCurrentUserRef.operationName;
console.log(name);
```

### Variables
The `GetCurrentUser` query has no variables.
### Return Type
Recall that executing the `GetCurrentUser` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetCurrentUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetCurrentUserData {
  user?: {
    username: string;
    email: string;
    dailyCalorieGoal?: number | null;
    weightGoal?: number | null;
  };
}
```
### Using `GetCurrentUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getCurrentUser } from '@dataconnect/generated';


// Call the `getCurrentUser()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getCurrentUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getCurrentUser(dataConnect);

console.log(data.user);

// Or, you can use the `Promise` API.
getCurrentUser().then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetCurrentUser`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getCurrentUserRef } from '@dataconnect/generated';


// Call the `getCurrentUserRef()` function to get a reference to the query.
const ref = getCurrentUserRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getCurrentUserRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.user);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

## ListUsers
You can execute the `ListUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listUsersRef:
```typescript
const name = listUsersRef.operationName;
console.log(name);
```

### Variables
The `ListUsers` query has no variables.
### Return Type
Recall that executing the `ListUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListUsersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListUsersData {
  users: ({
    username: string;
  })[];
}
```
### Using `ListUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listUsers } from '@dataconnect/generated';


// Call the `listUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listUsers(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
listUsers().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `ListUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listUsersRef } from '@dataconnect/generated';


// Call the `listUsersRef()` function to get a reference to the query.
const ref = listUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listUsersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## GetFoodItem
You can execute the `GetFoodItem` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getFoodItem(vars: GetFoodItemVariables, options?: ExecuteQueryOptions): QueryPromise<GetFoodItemData, GetFoodItemVariables>;

interface GetFoodItemRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetFoodItemVariables): QueryRef<GetFoodItemData, GetFoodItemVariables>;
}
export const getFoodItemRef: GetFoodItemRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getFoodItem(dc: DataConnect, vars: GetFoodItemVariables, options?: ExecuteQueryOptions): QueryPromise<GetFoodItemData, GetFoodItemVariables>;

interface GetFoodItemRef {
  ...
  (dc: DataConnect, vars: GetFoodItemVariables): QueryRef<GetFoodItemData, GetFoodItemVariables>;
}
export const getFoodItemRef: GetFoodItemRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getFoodItemRef:
```typescript
const name = getFoodItemRef.operationName;
console.log(name);
```

### Variables
The `GetFoodItem` query requires an argument of type `GetFoodItemVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetFoodItemVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetFoodItem` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetFoodItemData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetFoodItemData {
  foodItem?: {
    name: string;
    calories: number;
    protein: number;
  };
}
```
### Using `GetFoodItem`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getFoodItem, GetFoodItemVariables } from '@dataconnect/generated';

// The `GetFoodItem` query requires an argument of type `GetFoodItemVariables`:
const getFoodItemVars: GetFoodItemVariables = {
  id: ..., 
};

// Call the `getFoodItem()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getFoodItem(getFoodItemVars);
// Variables can be defined inline as well.
const { data } = await getFoodItem({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getFoodItem(dataConnect, getFoodItemVars);

console.log(data.foodItem);

// Or, you can use the `Promise` API.
getFoodItem(getFoodItemVars).then((response) => {
  const data = response.data;
  console.log(data.foodItem);
});
```

### Using `GetFoodItem`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getFoodItemRef, GetFoodItemVariables } from '@dataconnect/generated';

// The `GetFoodItem` query requires an argument of type `GetFoodItemVariables`:
const getFoodItemVars: GetFoodItemVariables = {
  id: ..., 
};

// Call the `getFoodItemRef()` function to get a reference to the query.
const ref = getFoodItemRef(getFoodItemVars);
// Variables can be defined inline as well.
const ref = getFoodItemRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getFoodItemRef(dataConnect, getFoodItemVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.foodItem);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.foodItem);
});
```

## ListFoodItems
You can execute the `ListFoodItems` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listFoodItems(options?: ExecuteQueryOptions): QueryPromise<ListFoodItemsData, undefined>;

interface ListFoodItemsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListFoodItemsData, undefined>;
}
export const listFoodItemsRef: ListFoodItemsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listFoodItems(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListFoodItemsData, undefined>;

interface ListFoodItemsRef {
  ...
  (dc: DataConnect): QueryRef<ListFoodItemsData, undefined>;
}
export const listFoodItemsRef: ListFoodItemsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listFoodItemsRef:
```typescript
const name = listFoodItemsRef.operationName;
console.log(name);
```

### Variables
The `ListFoodItems` query has no variables.
### Return Type
Recall that executing the `ListFoodItems` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListFoodItemsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListFoodItemsData {
  foodItems: ({
    name: string;
    brand?: string | null;
  })[];
}
```
### Using `ListFoodItems`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listFoodItems } from '@dataconnect/generated';


// Call the `listFoodItems()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listFoodItems();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listFoodItems(dataConnect);

console.log(data.foodItems);

// Or, you can use the `Promise` API.
listFoodItems().then((response) => {
  const data = response.data;
  console.log(data.foodItems);
});
```

### Using `ListFoodItems`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listFoodItemsRef } from '@dataconnect/generated';


// Call the `listFoodItemsRef()` function to get a reference to the query.
const ref = listFoodItemsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listFoodItemsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.foodItems);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.foodItems);
});
```

## GetLogEntry
You can execute the `GetLogEntry` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getLogEntry(vars: GetLogEntryVariables, options?: ExecuteQueryOptions): QueryPromise<GetLogEntryData, GetLogEntryVariables>;

interface GetLogEntryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetLogEntryVariables): QueryRef<GetLogEntryData, GetLogEntryVariables>;
}
export const getLogEntryRef: GetLogEntryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getLogEntry(dc: DataConnect, vars: GetLogEntryVariables, options?: ExecuteQueryOptions): QueryPromise<GetLogEntryData, GetLogEntryVariables>;

interface GetLogEntryRef {
  ...
  (dc: DataConnect, vars: GetLogEntryVariables): QueryRef<GetLogEntryData, GetLogEntryVariables>;
}
export const getLogEntryRef: GetLogEntryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getLogEntryRef:
```typescript
const name = getLogEntryRef.operationName;
console.log(name);
```

### Variables
The `GetLogEntry` query requires an argument of type `GetLogEntryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetLogEntryVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetLogEntry` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetLogEntryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetLogEntryData {
  logEntry?: {
    mealType: string;
    portionMultiplier?: number | null;
  };
}
```
### Using `GetLogEntry`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getLogEntry, GetLogEntryVariables } from '@dataconnect/generated';

// The `GetLogEntry` query requires an argument of type `GetLogEntryVariables`:
const getLogEntryVars: GetLogEntryVariables = {
  id: ..., 
};

// Call the `getLogEntry()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getLogEntry(getLogEntryVars);
// Variables can be defined inline as well.
const { data } = await getLogEntry({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getLogEntry(dataConnect, getLogEntryVars);

console.log(data.logEntry);

// Or, you can use the `Promise` API.
getLogEntry(getLogEntryVars).then((response) => {
  const data = response.data;
  console.log(data.logEntry);
});
```

### Using `GetLogEntry`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getLogEntryRef, GetLogEntryVariables } from '@dataconnect/generated';

// The `GetLogEntry` query requires an argument of type `GetLogEntryVariables`:
const getLogEntryVars: GetLogEntryVariables = {
  id: ..., 
};

// Call the `getLogEntryRef()` function to get a reference to the query.
const ref = getLogEntryRef(getLogEntryVars);
// Variables can be defined inline as well.
const ref = getLogEntryRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getLogEntryRef(dataConnect, getLogEntryVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.logEntry);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.logEntry);
});
```

## ListMyLogEntries
You can execute the `ListMyLogEntries` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMyLogEntries(options?: ExecuteQueryOptions): QueryPromise<ListMyLogEntriesData, undefined>;

interface ListMyLogEntriesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyLogEntriesData, undefined>;
}
export const listMyLogEntriesRef: ListMyLogEntriesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMyLogEntries(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyLogEntriesData, undefined>;

interface ListMyLogEntriesRef {
  ...
  (dc: DataConnect): QueryRef<ListMyLogEntriesData, undefined>;
}
export const listMyLogEntriesRef: ListMyLogEntriesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMyLogEntriesRef:
```typescript
const name = listMyLogEntriesRef.operationName;
console.log(name);
```

### Variables
The `ListMyLogEntries` query has no variables.
### Return Type
Recall that executing the `ListMyLogEntries` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMyLogEntriesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListMyLogEntriesData {
  logEntries: ({
    mealType: string;
    timestamp: TimestampString;
  })[];
}
```
### Using `ListMyLogEntries`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMyLogEntries } from '@dataconnect/generated';


// Call the `listMyLogEntries()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMyLogEntries();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMyLogEntries(dataConnect);

console.log(data.logEntries);

// Or, you can use the `Promise` API.
listMyLogEntries().then((response) => {
  const data = response.data;
  console.log(data.logEntries);
});
```

### Using `ListMyLogEntries`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMyLogEntriesRef } from '@dataconnect/generated';


// Call the `listMyLogEntriesRef()` function to get a reference to the query.
const ref = listMyLogEntriesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMyLogEntriesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.logEntries);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.logEntries);
});
```

## GetGoal
You can execute the `GetGoal` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getGoal(vars: GetGoalVariables, options?: ExecuteQueryOptions): QueryPromise<GetGoalData, GetGoalVariables>;

interface GetGoalRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetGoalVariables): QueryRef<GetGoalData, GetGoalVariables>;
}
export const getGoalRef: GetGoalRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getGoal(dc: DataConnect, vars: GetGoalVariables, options?: ExecuteQueryOptions): QueryPromise<GetGoalData, GetGoalVariables>;

interface GetGoalRef {
  ...
  (dc: DataConnect, vars: GetGoalVariables): QueryRef<GetGoalData, GetGoalVariables>;
}
export const getGoalRef: GetGoalRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getGoalRef:
```typescript
const name = getGoalRef.operationName;
console.log(name);
```

### Variables
The `GetGoal` query requires an argument of type `GetGoalVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetGoalVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetGoal` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetGoalData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetGoalData {
  goal?: {
    targetWeight?: number | null;
    targetCalories?: number | null;
  };
}
```
### Using `GetGoal`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getGoal, GetGoalVariables } from '@dataconnect/generated';

// The `GetGoal` query requires an argument of type `GetGoalVariables`:
const getGoalVars: GetGoalVariables = {
  id: ..., 
};

// Call the `getGoal()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getGoal(getGoalVars);
// Variables can be defined inline as well.
const { data } = await getGoal({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getGoal(dataConnect, getGoalVars);

console.log(data.goal);

// Or, you can use the `Promise` API.
getGoal(getGoalVars).then((response) => {
  const data = response.data;
  console.log(data.goal);
});
```

### Using `GetGoal`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getGoalRef, GetGoalVariables } from '@dataconnect/generated';

// The `GetGoal` query requires an argument of type `GetGoalVariables`:
const getGoalVars: GetGoalVariables = {
  id: ..., 
};

// Call the `getGoalRef()` function to get a reference to the query.
const ref = getGoalRef(getGoalVars);
// Variables can be defined inline as well.
const ref = getGoalRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getGoalRef(dataConnect, getGoalVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.goal);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.goal);
});
```

## ListMyGoals
You can execute the `ListMyGoals` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMyGoals(options?: ExecuteQueryOptions): QueryPromise<ListMyGoalsData, undefined>;

interface ListMyGoalsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyGoalsData, undefined>;
}
export const listMyGoalsRef: ListMyGoalsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMyGoals(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyGoalsData, undefined>;

interface ListMyGoalsRef {
  ...
  (dc: DataConnect): QueryRef<ListMyGoalsData, undefined>;
}
export const listMyGoalsRef: ListMyGoalsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMyGoalsRef:
```typescript
const name = listMyGoalsRef.operationName;
console.log(name);
```

### Variables
The `ListMyGoals` query has no variables.
### Return Type
Recall that executing the `ListMyGoals` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMyGoalsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListMyGoalsData {
  goals: ({
    startDate: DateString;
    targetWeight?: number | null;
  })[];
}
```
### Using `ListMyGoals`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMyGoals } from '@dataconnect/generated';


// Call the `listMyGoals()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMyGoals();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMyGoals(dataConnect);

console.log(data.goals);

// Or, you can use the `Promise` API.
listMyGoals().then((response) => {
  const data = response.data;
  console.log(data.goals);
});
```

### Using `ListMyGoals`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMyGoalsRef } from '@dataconnect/generated';


// Call the `listMyGoalsRef()` function to get a reference to the query.
const ref = listMyGoalsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMyGoalsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.goals);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.goals);
});
```

## GetFavorite
You can execute the `GetFavorite` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getFavorite(vars: GetFavoriteVariables, options?: ExecuteQueryOptions): QueryPromise<GetFavoriteData, GetFavoriteVariables>;

interface GetFavoriteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetFavoriteVariables): QueryRef<GetFavoriteData, GetFavoriteVariables>;
}
export const getFavoriteRef: GetFavoriteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getFavorite(dc: DataConnect, vars: GetFavoriteVariables, options?: ExecuteQueryOptions): QueryPromise<GetFavoriteData, GetFavoriteVariables>;

interface GetFavoriteRef {
  ...
  (dc: DataConnect, vars: GetFavoriteVariables): QueryRef<GetFavoriteData, GetFavoriteVariables>;
}
export const getFavoriteRef: GetFavoriteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getFavoriteRef:
```typescript
const name = getFavoriteRef.operationName;
console.log(name);
```

### Variables
The `GetFavorite` query requires an argument of type `GetFavoriteVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetFavoriteVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetFavorite` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetFavoriteData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetFavoriteData {
  favorite?: {
    foodItem: {
      name: string;
    };
  };
}
```
### Using `GetFavorite`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getFavorite, GetFavoriteVariables } from '@dataconnect/generated';

// The `GetFavorite` query requires an argument of type `GetFavoriteVariables`:
const getFavoriteVars: GetFavoriteVariables = {
  id: ..., 
};

// Call the `getFavorite()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getFavorite(getFavoriteVars);
// Variables can be defined inline as well.
const { data } = await getFavorite({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getFavorite(dataConnect, getFavoriteVars);

console.log(data.favorite);

// Or, you can use the `Promise` API.
getFavorite(getFavoriteVars).then((response) => {
  const data = response.data;
  console.log(data.favorite);
});
```

### Using `GetFavorite`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getFavoriteRef, GetFavoriteVariables } from '@dataconnect/generated';

// The `GetFavorite` query requires an argument of type `GetFavoriteVariables`:
const getFavoriteVars: GetFavoriteVariables = {
  id: ..., 
};

// Call the `getFavoriteRef()` function to get a reference to the query.
const ref = getFavoriteRef(getFavoriteVars);
// Variables can be defined inline as well.
const ref = getFavoriteRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getFavoriteRef(dataConnect, getFavoriteVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.favorite);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.favorite);
});
```

## ListMyFavorites
You can execute the `ListMyFavorites` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMyFavorites(options?: ExecuteQueryOptions): QueryPromise<ListMyFavoritesData, undefined>;

interface ListMyFavoritesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyFavoritesData, undefined>;
}
export const listMyFavoritesRef: ListMyFavoritesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMyFavorites(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyFavoritesData, undefined>;

interface ListMyFavoritesRef {
  ...
  (dc: DataConnect): QueryRef<ListMyFavoritesData, undefined>;
}
export const listMyFavoritesRef: ListMyFavoritesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMyFavoritesRef:
```typescript
const name = listMyFavoritesRef.operationName;
console.log(name);
```

### Variables
The `ListMyFavorites` query has no variables.
### Return Type
Recall that executing the `ListMyFavorites` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMyFavoritesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListMyFavoritesData {
  favorites: ({
    foodItem: {
      name: string;
    };
  })[];
}
```
### Using `ListMyFavorites`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMyFavorites } from '@dataconnect/generated';


// Call the `listMyFavorites()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMyFavorites();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMyFavorites(dataConnect);

console.log(data.favorites);

// Or, you can use the `Promise` API.
listMyFavorites().then((response) => {
  const data = response.data;
  console.log(data.favorites);
});
```

### Using `ListMyFavorites`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMyFavoritesRef } from '@dataconnect/generated';


// Call the `listMyFavoritesRef()` function to get a reference to the query.
const ref = listMyFavoritesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMyFavoritesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.favorites);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.favorites);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateUser
You can execute the `CreateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserRef:
```typescript
const name = createUserRef.operationName;
console.log(name);
```

### Variables
The `CreateUser` mutation requires an argument of type `CreateUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateUserVariables {
  username: string;
  email: string;
}
```
### Return Type
Recall that executing the `CreateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserData {
  user_insert: User_Key;
}
```
### Using `CreateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUser, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  username: ..., 
  email: ..., 
};

// Call the `createUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUser(createUserVars);
// Variables can be defined inline as well.
const { data } = await createUser({ username: ..., email: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUser(dataConnect, createUserVars);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
createUser(createUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `CreateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserRef, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  username: ..., 
  email: ..., 
};

// Call the `createUserRef()` function to get a reference to the mutation.
const ref = createUserRef(createUserVars);
// Variables can be defined inline as well.
const ref = createUserRef({ username: ..., email: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserRef(dataConnect, createUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## UpdateUser
You can execute the `UpdateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateUser(vars?: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface UpdateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
}
export const updateUserRef: UpdateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUser(dc: DataConnect, vars?: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface UpdateUserRef {
  ...
  (dc: DataConnect, vars?: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
}
export const updateUserRef: UpdateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUserRef:
```typescript
const name = updateUserRef.operationName;
console.log(name);
```

### Variables
The `UpdateUser` mutation has an optional argument of type `UpdateUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateUserVariables {
  username?: string | null;
}
```
### Return Type
Recall that executing the `UpdateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUserData {
  user_update?: User_Key | null;
}
```
### Using `UpdateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUser, UpdateUserVariables } from '@dataconnect/generated';

// The `UpdateUser` mutation has an optional argument of type `UpdateUserVariables`:
const updateUserVars: UpdateUserVariables = {
  username: ..., // optional
};

// Call the `updateUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUser(updateUserVars);
// Variables can be defined inline as well.
const { data } = await updateUser({ username: ..., });
// Since all variables are optional for this mutation, you can omit the `UpdateUserVariables` argument.
const { data } = await updateUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUser(dataConnect, updateUserVars);

console.log(data.user_update);

// Or, you can use the `Promise` API.
updateUser(updateUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `UpdateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUserRef, UpdateUserVariables } from '@dataconnect/generated';

// The `UpdateUser` mutation has an optional argument of type `UpdateUserVariables`:
const updateUserVars: UpdateUserVariables = {
  username: ..., // optional
};

// Call the `updateUserRef()` function to get a reference to the mutation.
const ref = updateUserRef(updateUserVars);
// Variables can be defined inline as well.
const ref = updateUserRef({ username: ..., });
// Since all variables are optional for this mutation, you can omit the `UpdateUserVariables` argument.
const ref = updateUserRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUserRef(dataConnect, updateUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

## DeleteUser
You can execute the `DeleteUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteUser(): MutationPromise<DeleteUserData, undefined>;

interface DeleteUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<DeleteUserData, undefined>;
}
export const deleteUserRef: DeleteUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteUser(dc: DataConnect): MutationPromise<DeleteUserData, undefined>;

interface DeleteUserRef {
  ...
  (dc: DataConnect): MutationRef<DeleteUserData, undefined>;
}
export const deleteUserRef: DeleteUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteUserRef:
```typescript
const name = deleteUserRef.operationName;
console.log(name);
```

### Variables
The `DeleteUser` mutation has no variables.
### Return Type
Recall that executing the `DeleteUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteUserData {
  user_delete?: User_Key | null;
}
```
### Using `DeleteUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteUser } from '@dataconnect/generated';


// Call the `deleteUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteUser(dataConnect);

console.log(data.user_delete);

// Or, you can use the `Promise` API.
deleteUser().then((response) => {
  const data = response.data;
  console.log(data.user_delete);
});
```

### Using `DeleteUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteUserRef } from '@dataconnect/generated';


// Call the `deleteUserRef()` function to get a reference to the mutation.
const ref = deleteUserRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteUserRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_delete);
});
```

## CreateFoodItem
You can execute the `CreateFoodItem` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createFoodItem(vars: CreateFoodItemVariables): MutationPromise<CreateFoodItemData, CreateFoodItemVariables>;

interface CreateFoodItemRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateFoodItemVariables): MutationRef<CreateFoodItemData, CreateFoodItemVariables>;
}
export const createFoodItemRef: CreateFoodItemRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createFoodItem(dc: DataConnect, vars: CreateFoodItemVariables): MutationPromise<CreateFoodItemData, CreateFoodItemVariables>;

interface CreateFoodItemRef {
  ...
  (dc: DataConnect, vars: CreateFoodItemVariables): MutationRef<CreateFoodItemData, CreateFoodItemVariables>;
}
export const createFoodItemRef: CreateFoodItemRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createFoodItemRef:
```typescript
const name = createFoodItemRef.operationName;
console.log(name);
```

### Variables
The `CreateFoodItem` mutation requires an argument of type `CreateFoodItemVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateFoodItemVariables {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
```
### Return Type
Recall that executing the `CreateFoodItem` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateFoodItemData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateFoodItemData {
  foodItem_insert: FoodItem_Key;
}
```
### Using `CreateFoodItem`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createFoodItem, CreateFoodItemVariables } from '@dataconnect/generated';

// The `CreateFoodItem` mutation requires an argument of type `CreateFoodItemVariables`:
const createFoodItemVars: CreateFoodItemVariables = {
  name: ..., 
  calories: ..., 
  protein: ..., 
  carbs: ..., 
  fat: ..., 
};

// Call the `createFoodItem()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createFoodItem(createFoodItemVars);
// Variables can be defined inline as well.
const { data } = await createFoodItem({ name: ..., calories: ..., protein: ..., carbs: ..., fat: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createFoodItem(dataConnect, createFoodItemVars);

console.log(data.foodItem_insert);

// Or, you can use the `Promise` API.
createFoodItem(createFoodItemVars).then((response) => {
  const data = response.data;
  console.log(data.foodItem_insert);
});
```

### Using `CreateFoodItem`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createFoodItemRef, CreateFoodItemVariables } from '@dataconnect/generated';

// The `CreateFoodItem` mutation requires an argument of type `CreateFoodItemVariables`:
const createFoodItemVars: CreateFoodItemVariables = {
  name: ..., 
  calories: ..., 
  protein: ..., 
  carbs: ..., 
  fat: ..., 
};

// Call the `createFoodItemRef()` function to get a reference to the mutation.
const ref = createFoodItemRef(createFoodItemVars);
// Variables can be defined inline as well.
const ref = createFoodItemRef({ name: ..., calories: ..., protein: ..., carbs: ..., fat: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createFoodItemRef(dataConnect, createFoodItemVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.foodItem_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.foodItem_insert);
});
```

## UpdateFoodItem
You can execute the `UpdateFoodItem` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateFoodItem(vars: UpdateFoodItemVariables): MutationPromise<UpdateFoodItemData, UpdateFoodItemVariables>;

interface UpdateFoodItemRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateFoodItemVariables): MutationRef<UpdateFoodItemData, UpdateFoodItemVariables>;
}
export const updateFoodItemRef: UpdateFoodItemRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateFoodItem(dc: DataConnect, vars: UpdateFoodItemVariables): MutationPromise<UpdateFoodItemData, UpdateFoodItemVariables>;

interface UpdateFoodItemRef {
  ...
  (dc: DataConnect, vars: UpdateFoodItemVariables): MutationRef<UpdateFoodItemData, UpdateFoodItemVariables>;
}
export const updateFoodItemRef: UpdateFoodItemRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateFoodItemRef:
```typescript
const name = updateFoodItemRef.operationName;
console.log(name);
```

### Variables
The `UpdateFoodItem` mutation requires an argument of type `UpdateFoodItemVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateFoodItemVariables {
  id: UUIDString;
  calories?: number | null;
}
```
### Return Type
Recall that executing the `UpdateFoodItem` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateFoodItemData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateFoodItemData {
  foodItem_update?: FoodItem_Key | null;
}
```
### Using `UpdateFoodItem`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateFoodItem, UpdateFoodItemVariables } from '@dataconnect/generated';

// The `UpdateFoodItem` mutation requires an argument of type `UpdateFoodItemVariables`:
const updateFoodItemVars: UpdateFoodItemVariables = {
  id: ..., 
  calories: ..., // optional
};

// Call the `updateFoodItem()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateFoodItem(updateFoodItemVars);
// Variables can be defined inline as well.
const { data } = await updateFoodItem({ id: ..., calories: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateFoodItem(dataConnect, updateFoodItemVars);

console.log(data.foodItem_update);

// Or, you can use the `Promise` API.
updateFoodItem(updateFoodItemVars).then((response) => {
  const data = response.data;
  console.log(data.foodItem_update);
});
```

### Using `UpdateFoodItem`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateFoodItemRef, UpdateFoodItemVariables } from '@dataconnect/generated';

// The `UpdateFoodItem` mutation requires an argument of type `UpdateFoodItemVariables`:
const updateFoodItemVars: UpdateFoodItemVariables = {
  id: ..., 
  calories: ..., // optional
};

// Call the `updateFoodItemRef()` function to get a reference to the mutation.
const ref = updateFoodItemRef(updateFoodItemVars);
// Variables can be defined inline as well.
const ref = updateFoodItemRef({ id: ..., calories: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateFoodItemRef(dataConnect, updateFoodItemVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.foodItem_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.foodItem_update);
});
```

## DeleteFoodItem
You can execute the `DeleteFoodItem` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteFoodItem(vars: DeleteFoodItemVariables): MutationPromise<DeleteFoodItemData, DeleteFoodItemVariables>;

interface DeleteFoodItemRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteFoodItemVariables): MutationRef<DeleteFoodItemData, DeleteFoodItemVariables>;
}
export const deleteFoodItemRef: DeleteFoodItemRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteFoodItem(dc: DataConnect, vars: DeleteFoodItemVariables): MutationPromise<DeleteFoodItemData, DeleteFoodItemVariables>;

interface DeleteFoodItemRef {
  ...
  (dc: DataConnect, vars: DeleteFoodItemVariables): MutationRef<DeleteFoodItemData, DeleteFoodItemVariables>;
}
export const deleteFoodItemRef: DeleteFoodItemRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteFoodItemRef:
```typescript
const name = deleteFoodItemRef.operationName;
console.log(name);
```

### Variables
The `DeleteFoodItem` mutation requires an argument of type `DeleteFoodItemVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteFoodItemVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteFoodItem` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteFoodItemData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteFoodItemData {
  foodItem_delete?: FoodItem_Key | null;
}
```
### Using `DeleteFoodItem`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteFoodItem, DeleteFoodItemVariables } from '@dataconnect/generated';

// The `DeleteFoodItem` mutation requires an argument of type `DeleteFoodItemVariables`:
const deleteFoodItemVars: DeleteFoodItemVariables = {
  id: ..., 
};

// Call the `deleteFoodItem()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteFoodItem(deleteFoodItemVars);
// Variables can be defined inline as well.
const { data } = await deleteFoodItem({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteFoodItem(dataConnect, deleteFoodItemVars);

console.log(data.foodItem_delete);

// Or, you can use the `Promise` API.
deleteFoodItem(deleteFoodItemVars).then((response) => {
  const data = response.data;
  console.log(data.foodItem_delete);
});
```

### Using `DeleteFoodItem`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteFoodItemRef, DeleteFoodItemVariables } from '@dataconnect/generated';

// The `DeleteFoodItem` mutation requires an argument of type `DeleteFoodItemVariables`:
const deleteFoodItemVars: DeleteFoodItemVariables = {
  id: ..., 
};

// Call the `deleteFoodItemRef()` function to get a reference to the mutation.
const ref = deleteFoodItemRef(deleteFoodItemVars);
// Variables can be defined inline as well.
const ref = deleteFoodItemRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteFoodItemRef(dataConnect, deleteFoodItemVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.foodItem_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.foodItem_delete);
});
```

## CreateLogEntry
You can execute the `CreateLogEntry` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createLogEntry(vars: CreateLogEntryVariables): MutationPromise<CreateLogEntryData, CreateLogEntryVariables>;

interface CreateLogEntryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateLogEntryVariables): MutationRef<CreateLogEntryData, CreateLogEntryVariables>;
}
export const createLogEntryRef: CreateLogEntryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createLogEntry(dc: DataConnect, vars: CreateLogEntryVariables): MutationPromise<CreateLogEntryData, CreateLogEntryVariables>;

interface CreateLogEntryRef {
  ...
  (dc: DataConnect, vars: CreateLogEntryVariables): MutationRef<CreateLogEntryData, CreateLogEntryVariables>;
}
export const createLogEntryRef: CreateLogEntryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createLogEntryRef:
```typescript
const name = createLogEntryRef.operationName;
console.log(name);
```

### Variables
The `CreateLogEntry` mutation requires an argument of type `CreateLogEntryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateLogEntryVariables {
  foodItemId: UUIDString;
  mealType: string;
  portionMultiplier: number;
}
```
### Return Type
Recall that executing the `CreateLogEntry` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateLogEntryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateLogEntryData {
  logEntry_insert: LogEntry_Key;
}
```
### Using `CreateLogEntry`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createLogEntry, CreateLogEntryVariables } from '@dataconnect/generated';

// The `CreateLogEntry` mutation requires an argument of type `CreateLogEntryVariables`:
const createLogEntryVars: CreateLogEntryVariables = {
  foodItemId: ..., 
  mealType: ..., 
  portionMultiplier: ..., 
};

// Call the `createLogEntry()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createLogEntry(createLogEntryVars);
// Variables can be defined inline as well.
const { data } = await createLogEntry({ foodItemId: ..., mealType: ..., portionMultiplier: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createLogEntry(dataConnect, createLogEntryVars);

console.log(data.logEntry_insert);

// Or, you can use the `Promise` API.
createLogEntry(createLogEntryVars).then((response) => {
  const data = response.data;
  console.log(data.logEntry_insert);
});
```

### Using `CreateLogEntry`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createLogEntryRef, CreateLogEntryVariables } from '@dataconnect/generated';

// The `CreateLogEntry` mutation requires an argument of type `CreateLogEntryVariables`:
const createLogEntryVars: CreateLogEntryVariables = {
  foodItemId: ..., 
  mealType: ..., 
  portionMultiplier: ..., 
};

// Call the `createLogEntryRef()` function to get a reference to the mutation.
const ref = createLogEntryRef(createLogEntryVars);
// Variables can be defined inline as well.
const ref = createLogEntryRef({ foodItemId: ..., mealType: ..., portionMultiplier: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createLogEntryRef(dataConnect, createLogEntryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.logEntry_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.logEntry_insert);
});
```

## UpdateLogEntry
You can execute the `UpdateLogEntry` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateLogEntry(vars: UpdateLogEntryVariables): MutationPromise<UpdateLogEntryData, UpdateLogEntryVariables>;

interface UpdateLogEntryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateLogEntryVariables): MutationRef<UpdateLogEntryData, UpdateLogEntryVariables>;
}
export const updateLogEntryRef: UpdateLogEntryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateLogEntry(dc: DataConnect, vars: UpdateLogEntryVariables): MutationPromise<UpdateLogEntryData, UpdateLogEntryVariables>;

interface UpdateLogEntryRef {
  ...
  (dc: DataConnect, vars: UpdateLogEntryVariables): MutationRef<UpdateLogEntryData, UpdateLogEntryVariables>;
}
export const updateLogEntryRef: UpdateLogEntryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateLogEntryRef:
```typescript
const name = updateLogEntryRef.operationName;
console.log(name);
```

### Variables
The `UpdateLogEntry` mutation requires an argument of type `UpdateLogEntryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateLogEntryVariables {
  id: UUIDString;
  portionMultiplier: number;
}
```
### Return Type
Recall that executing the `UpdateLogEntry` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateLogEntryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateLogEntryData {
  logEntry_update?: LogEntry_Key | null;
}
```
### Using `UpdateLogEntry`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateLogEntry, UpdateLogEntryVariables } from '@dataconnect/generated';

// The `UpdateLogEntry` mutation requires an argument of type `UpdateLogEntryVariables`:
const updateLogEntryVars: UpdateLogEntryVariables = {
  id: ..., 
  portionMultiplier: ..., 
};

// Call the `updateLogEntry()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateLogEntry(updateLogEntryVars);
// Variables can be defined inline as well.
const { data } = await updateLogEntry({ id: ..., portionMultiplier: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateLogEntry(dataConnect, updateLogEntryVars);

console.log(data.logEntry_update);

// Or, you can use the `Promise` API.
updateLogEntry(updateLogEntryVars).then((response) => {
  const data = response.data;
  console.log(data.logEntry_update);
});
```

### Using `UpdateLogEntry`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateLogEntryRef, UpdateLogEntryVariables } from '@dataconnect/generated';

// The `UpdateLogEntry` mutation requires an argument of type `UpdateLogEntryVariables`:
const updateLogEntryVars: UpdateLogEntryVariables = {
  id: ..., 
  portionMultiplier: ..., 
};

// Call the `updateLogEntryRef()` function to get a reference to the mutation.
const ref = updateLogEntryRef(updateLogEntryVars);
// Variables can be defined inline as well.
const ref = updateLogEntryRef({ id: ..., portionMultiplier: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateLogEntryRef(dataConnect, updateLogEntryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.logEntry_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.logEntry_update);
});
```

## DeleteLogEntry
You can execute the `DeleteLogEntry` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteLogEntry(vars: DeleteLogEntryVariables): MutationPromise<DeleteLogEntryData, DeleteLogEntryVariables>;

interface DeleteLogEntryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteLogEntryVariables): MutationRef<DeleteLogEntryData, DeleteLogEntryVariables>;
}
export const deleteLogEntryRef: DeleteLogEntryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteLogEntry(dc: DataConnect, vars: DeleteLogEntryVariables): MutationPromise<DeleteLogEntryData, DeleteLogEntryVariables>;

interface DeleteLogEntryRef {
  ...
  (dc: DataConnect, vars: DeleteLogEntryVariables): MutationRef<DeleteLogEntryData, DeleteLogEntryVariables>;
}
export const deleteLogEntryRef: DeleteLogEntryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteLogEntryRef:
```typescript
const name = deleteLogEntryRef.operationName;
console.log(name);
```

### Variables
The `DeleteLogEntry` mutation requires an argument of type `DeleteLogEntryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteLogEntryVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteLogEntry` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteLogEntryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteLogEntryData {
  logEntry_delete?: LogEntry_Key | null;
}
```
### Using `DeleteLogEntry`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteLogEntry, DeleteLogEntryVariables } from '@dataconnect/generated';

// The `DeleteLogEntry` mutation requires an argument of type `DeleteLogEntryVariables`:
const deleteLogEntryVars: DeleteLogEntryVariables = {
  id: ..., 
};

// Call the `deleteLogEntry()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteLogEntry(deleteLogEntryVars);
// Variables can be defined inline as well.
const { data } = await deleteLogEntry({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteLogEntry(dataConnect, deleteLogEntryVars);

console.log(data.logEntry_delete);

// Or, you can use the `Promise` API.
deleteLogEntry(deleteLogEntryVars).then((response) => {
  const data = response.data;
  console.log(data.logEntry_delete);
});
```

### Using `DeleteLogEntry`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteLogEntryRef, DeleteLogEntryVariables } from '@dataconnect/generated';

// The `DeleteLogEntry` mutation requires an argument of type `DeleteLogEntryVariables`:
const deleteLogEntryVars: DeleteLogEntryVariables = {
  id: ..., 
};

// Call the `deleteLogEntryRef()` function to get a reference to the mutation.
const ref = deleteLogEntryRef(deleteLogEntryVars);
// Variables can be defined inline as well.
const ref = deleteLogEntryRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteLogEntryRef(dataConnect, deleteLogEntryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.logEntry_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.logEntry_delete);
});
```

## CreateGoal
You can execute the `CreateGoal` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createGoal(vars: CreateGoalVariables): MutationPromise<CreateGoalData, CreateGoalVariables>;

interface CreateGoalRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateGoalVariables): MutationRef<CreateGoalData, CreateGoalVariables>;
}
export const createGoalRef: CreateGoalRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createGoal(dc: DataConnect, vars: CreateGoalVariables): MutationPromise<CreateGoalData, CreateGoalVariables>;

interface CreateGoalRef {
  ...
  (dc: DataConnect, vars: CreateGoalVariables): MutationRef<CreateGoalData, CreateGoalVariables>;
}
export const createGoalRef: CreateGoalRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createGoalRef:
```typescript
const name = createGoalRef.operationName;
console.log(name);
```

### Variables
The `CreateGoal` mutation requires an argument of type `CreateGoalVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateGoalVariables {
  startDate: DateString;
  targetWeight: number;
}
```
### Return Type
Recall that executing the `CreateGoal` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateGoalData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateGoalData {
  goal_insert: Goal_Key;
}
```
### Using `CreateGoal`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createGoal, CreateGoalVariables } from '@dataconnect/generated';

// The `CreateGoal` mutation requires an argument of type `CreateGoalVariables`:
const createGoalVars: CreateGoalVariables = {
  startDate: ..., 
  targetWeight: ..., 
};

// Call the `createGoal()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createGoal(createGoalVars);
// Variables can be defined inline as well.
const { data } = await createGoal({ startDate: ..., targetWeight: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createGoal(dataConnect, createGoalVars);

console.log(data.goal_insert);

// Or, you can use the `Promise` API.
createGoal(createGoalVars).then((response) => {
  const data = response.data;
  console.log(data.goal_insert);
});
```

### Using `CreateGoal`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createGoalRef, CreateGoalVariables } from '@dataconnect/generated';

// The `CreateGoal` mutation requires an argument of type `CreateGoalVariables`:
const createGoalVars: CreateGoalVariables = {
  startDate: ..., 
  targetWeight: ..., 
};

// Call the `createGoalRef()` function to get a reference to the mutation.
const ref = createGoalRef(createGoalVars);
// Variables can be defined inline as well.
const ref = createGoalRef({ startDate: ..., targetWeight: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createGoalRef(dataConnect, createGoalVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.goal_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.goal_insert);
});
```

## UpdateGoal
You can execute the `UpdateGoal` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateGoal(vars: UpdateGoalVariables): MutationPromise<UpdateGoalData, UpdateGoalVariables>;

interface UpdateGoalRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateGoalVariables): MutationRef<UpdateGoalData, UpdateGoalVariables>;
}
export const updateGoalRef: UpdateGoalRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateGoal(dc: DataConnect, vars: UpdateGoalVariables): MutationPromise<UpdateGoalData, UpdateGoalVariables>;

interface UpdateGoalRef {
  ...
  (dc: DataConnect, vars: UpdateGoalVariables): MutationRef<UpdateGoalData, UpdateGoalVariables>;
}
export const updateGoalRef: UpdateGoalRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateGoalRef:
```typescript
const name = updateGoalRef.operationName;
console.log(name);
```

### Variables
The `UpdateGoal` mutation requires an argument of type `UpdateGoalVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateGoalVariables {
  id: UUIDString;
  targetWeight: number;
}
```
### Return Type
Recall that executing the `UpdateGoal` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateGoalData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateGoalData {
  goal_update?: Goal_Key | null;
}
```
### Using `UpdateGoal`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateGoal, UpdateGoalVariables } from '@dataconnect/generated';

// The `UpdateGoal` mutation requires an argument of type `UpdateGoalVariables`:
const updateGoalVars: UpdateGoalVariables = {
  id: ..., 
  targetWeight: ..., 
};

// Call the `updateGoal()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateGoal(updateGoalVars);
// Variables can be defined inline as well.
const { data } = await updateGoal({ id: ..., targetWeight: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateGoal(dataConnect, updateGoalVars);

console.log(data.goal_update);

// Or, you can use the `Promise` API.
updateGoal(updateGoalVars).then((response) => {
  const data = response.data;
  console.log(data.goal_update);
});
```

### Using `UpdateGoal`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateGoalRef, UpdateGoalVariables } from '@dataconnect/generated';

// The `UpdateGoal` mutation requires an argument of type `UpdateGoalVariables`:
const updateGoalVars: UpdateGoalVariables = {
  id: ..., 
  targetWeight: ..., 
};

// Call the `updateGoalRef()` function to get a reference to the mutation.
const ref = updateGoalRef(updateGoalVars);
// Variables can be defined inline as well.
const ref = updateGoalRef({ id: ..., targetWeight: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateGoalRef(dataConnect, updateGoalVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.goal_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.goal_update);
});
```

## DeleteGoal
You can execute the `DeleteGoal` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteGoal(vars: DeleteGoalVariables): MutationPromise<DeleteGoalData, DeleteGoalVariables>;

interface DeleteGoalRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteGoalVariables): MutationRef<DeleteGoalData, DeleteGoalVariables>;
}
export const deleteGoalRef: DeleteGoalRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteGoal(dc: DataConnect, vars: DeleteGoalVariables): MutationPromise<DeleteGoalData, DeleteGoalVariables>;

interface DeleteGoalRef {
  ...
  (dc: DataConnect, vars: DeleteGoalVariables): MutationRef<DeleteGoalData, DeleteGoalVariables>;
}
export const deleteGoalRef: DeleteGoalRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteGoalRef:
```typescript
const name = deleteGoalRef.operationName;
console.log(name);
```

### Variables
The `DeleteGoal` mutation requires an argument of type `DeleteGoalVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteGoalVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteGoal` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteGoalData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteGoalData {
  goal_delete?: Goal_Key | null;
}
```
### Using `DeleteGoal`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteGoal, DeleteGoalVariables } from '@dataconnect/generated';

// The `DeleteGoal` mutation requires an argument of type `DeleteGoalVariables`:
const deleteGoalVars: DeleteGoalVariables = {
  id: ..., 
};

// Call the `deleteGoal()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteGoal(deleteGoalVars);
// Variables can be defined inline as well.
const { data } = await deleteGoal({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteGoal(dataConnect, deleteGoalVars);

console.log(data.goal_delete);

// Or, you can use the `Promise` API.
deleteGoal(deleteGoalVars).then((response) => {
  const data = response.data;
  console.log(data.goal_delete);
});
```

### Using `DeleteGoal`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteGoalRef, DeleteGoalVariables } from '@dataconnect/generated';

// The `DeleteGoal` mutation requires an argument of type `DeleteGoalVariables`:
const deleteGoalVars: DeleteGoalVariables = {
  id: ..., 
};

// Call the `deleteGoalRef()` function to get a reference to the mutation.
const ref = deleteGoalRef(deleteGoalVars);
// Variables can be defined inline as well.
const ref = deleteGoalRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteGoalRef(dataConnect, deleteGoalVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.goal_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.goal_delete);
});
```

## CreateFavorite
You can execute the `CreateFavorite` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createFavorite(vars: CreateFavoriteVariables): MutationPromise<CreateFavoriteData, CreateFavoriteVariables>;

interface CreateFavoriteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateFavoriteVariables): MutationRef<CreateFavoriteData, CreateFavoriteVariables>;
}
export const createFavoriteRef: CreateFavoriteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createFavorite(dc: DataConnect, vars: CreateFavoriteVariables): MutationPromise<CreateFavoriteData, CreateFavoriteVariables>;

interface CreateFavoriteRef {
  ...
  (dc: DataConnect, vars: CreateFavoriteVariables): MutationRef<CreateFavoriteData, CreateFavoriteVariables>;
}
export const createFavoriteRef: CreateFavoriteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createFavoriteRef:
```typescript
const name = createFavoriteRef.operationName;
console.log(name);
```

### Variables
The `CreateFavorite` mutation requires an argument of type `CreateFavoriteVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateFavoriteVariables {
  foodItemId: UUIDString;
}
```
### Return Type
Recall that executing the `CreateFavorite` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateFavoriteData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateFavoriteData {
  favorite_insert: Favorite_Key;
}
```
### Using `CreateFavorite`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createFavorite, CreateFavoriteVariables } from '@dataconnect/generated';

// The `CreateFavorite` mutation requires an argument of type `CreateFavoriteVariables`:
const createFavoriteVars: CreateFavoriteVariables = {
  foodItemId: ..., 
};

// Call the `createFavorite()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createFavorite(createFavoriteVars);
// Variables can be defined inline as well.
const { data } = await createFavorite({ foodItemId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createFavorite(dataConnect, createFavoriteVars);

console.log(data.favorite_insert);

// Or, you can use the `Promise` API.
createFavorite(createFavoriteVars).then((response) => {
  const data = response.data;
  console.log(data.favorite_insert);
});
```

### Using `CreateFavorite`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createFavoriteRef, CreateFavoriteVariables } from '@dataconnect/generated';

// The `CreateFavorite` mutation requires an argument of type `CreateFavoriteVariables`:
const createFavoriteVars: CreateFavoriteVariables = {
  foodItemId: ..., 
};

// Call the `createFavoriteRef()` function to get a reference to the mutation.
const ref = createFavoriteRef(createFavoriteVars);
// Variables can be defined inline as well.
const ref = createFavoriteRef({ foodItemId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createFavoriteRef(dataConnect, createFavoriteVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.favorite_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.favorite_insert);
});
```

## DeleteFavorite
You can execute the `DeleteFavorite` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteFavorite(vars: DeleteFavoriteVariables): MutationPromise<DeleteFavoriteData, DeleteFavoriteVariables>;

interface DeleteFavoriteRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteFavoriteVariables): MutationRef<DeleteFavoriteData, DeleteFavoriteVariables>;
}
export const deleteFavoriteRef: DeleteFavoriteRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteFavorite(dc: DataConnect, vars: DeleteFavoriteVariables): MutationPromise<DeleteFavoriteData, DeleteFavoriteVariables>;

interface DeleteFavoriteRef {
  ...
  (dc: DataConnect, vars: DeleteFavoriteVariables): MutationRef<DeleteFavoriteData, DeleteFavoriteVariables>;
}
export const deleteFavoriteRef: DeleteFavoriteRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteFavoriteRef:
```typescript
const name = deleteFavoriteRef.operationName;
console.log(name);
```

### Variables
The `DeleteFavorite` mutation requires an argument of type `DeleteFavoriteVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteFavoriteVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteFavorite` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteFavoriteData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteFavoriteData {
  favorite_delete?: Favorite_Key | null;
}
```
### Using `DeleteFavorite`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteFavorite, DeleteFavoriteVariables } from '@dataconnect/generated';

// The `DeleteFavorite` mutation requires an argument of type `DeleteFavoriteVariables`:
const deleteFavoriteVars: DeleteFavoriteVariables = {
  id: ..., 
};

// Call the `deleteFavorite()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteFavorite(deleteFavoriteVars);
// Variables can be defined inline as well.
const { data } = await deleteFavorite({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteFavorite(dataConnect, deleteFavoriteVars);

console.log(data.favorite_delete);

// Or, you can use the `Promise` API.
deleteFavorite(deleteFavoriteVars).then((response) => {
  const data = response.data;
  console.log(data.favorite_delete);
});
```

### Using `DeleteFavorite`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteFavoriteRef, DeleteFavoriteVariables } from '@dataconnect/generated';

// The `DeleteFavorite` mutation requires an argument of type `DeleteFavoriteVariables`:
const deleteFavoriteVars: DeleteFavoriteVariables = {
  id: ..., 
};

// Call the `deleteFavoriteRef()` function to get a reference to the mutation.
const ref = deleteFavoriteRef(deleteFavoriteVars);
// Variables can be defined inline as well.
const ref = deleteFavoriteRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteFavoriteRef(dataConnect, deleteFavoriteVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.favorite_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.favorite_delete);
});
```

