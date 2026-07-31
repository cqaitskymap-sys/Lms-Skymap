# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useCreateUser, useUpdateUser, useDeleteUser, useGetCurrentUser, useListUsers, useCreateFoodItem, useUpdateFoodItem, useDeleteFoodItem, useGetFoodItem, useListFoodItems } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useCreateUser(createUserVars);

const { data, isPending, isSuccess, isError, error } = useUpdateUser(updateUserVars);

const { data, isPending, isSuccess, isError, error } = useDeleteUser();

const { data, isPending, isSuccess, isError, error } = useGetCurrentUser();

const { data, isPending, isSuccess, isError, error } = useListUsers();

const { data, isPending, isSuccess, isError, error } = useCreateFoodItem(createFoodItemVars);

const { data, isPending, isSuccess, isError, error } = useUpdateFoodItem(updateFoodItemVars);

const { data, isPending, isSuccess, isError, error } = useDeleteFoodItem(deleteFoodItemVars);

const { data, isPending, isSuccess, isError, error } = useGetFoodItem(getFoodItemVars);

const { data, isPending, isSuccess, isError, error } = useListFoodItems();

```

Here's an example from a different generated SDK:

```ts
import { useListAllMovies } from '@dataconnect/generated/react';

function MyComponent() {
  const { isLoading, data, error } = useListAllMovies();
  if(isLoading) {
    return <div>Loading...</div>
  }
  if(error) {
    return <div> An Error Occurred: {error} </div>
  }
}

// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyComponent from './my-component';

function App() {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>
    <MyComponent />
  </QueryClientProvider>
}
```



## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createUser, updateUser, deleteUser, getCurrentUser, listUsers, createFoodItem, updateFoodItem, deleteFoodItem, getFoodItem, listFoodItems } from '@dataconnect/generated';


// Operation CreateUser:  For variables, look at type CreateUserVars in ../index.d.ts
const { data } = await CreateUser(dataConnect, createUserVars);

// Operation UpdateUser:  For variables, look at type UpdateUserVars in ../index.d.ts
const { data } = await UpdateUser(dataConnect, updateUserVars);

// Operation DeleteUser: 
const { data } = await DeleteUser(dataConnect);

// Operation GetCurrentUser: 
const { data } = await GetCurrentUser(dataConnect);

// Operation ListUsers: 
const { data } = await ListUsers(dataConnect);

// Operation CreateFoodItem:  For variables, look at type CreateFoodItemVars in ../index.d.ts
const { data } = await CreateFoodItem(dataConnect, createFoodItemVars);

// Operation UpdateFoodItem:  For variables, look at type UpdateFoodItemVars in ../index.d.ts
const { data } = await UpdateFoodItem(dataConnect, updateFoodItemVars);

// Operation DeleteFoodItem:  For variables, look at type DeleteFoodItemVars in ../index.d.ts
const { data } = await DeleteFoodItem(dataConnect, deleteFoodItemVars);

// Operation GetFoodItem:  For variables, look at type GetFoodItemVars in ../index.d.ts
const { data } = await GetFoodItem(dataConnect, getFoodItemVars);

// Operation ListFoodItems: 
const { data } = await ListFoodItems(dataConnect);


```