# [`use-form-controlled`](https://www.npmjs.com/package/use-form-controlled)

![CI](https://github.com/morganney/use-form-controlled/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/morganney/use-form-controlled/branch/main/graph/badge.svg?token=V3OBK7JF38)](https://codecov.io/gh/morganney/use-form-controlled)

React hook for managing form state, validation, and submission with controlled inputs.

## Usage

First `npm i use-form-controlled react react-dom`.

### Basic

```js
import { useForm } from 'use-form-controlled'

const { register, error, isInvalid, handleOnSubmit } = useForm({
  firstName(form) {
    if (!form.firstName?.trim()) {
      return 'First Name is required'
    }
  }
})

return (
  <form onSubmit={handleOnSubmit(form => console.log(form.firstName))} noValidate>
    <label>
      First Name:
      <input {...register('firstName', { required: true })} />
    </label>
    {error.firstName && <span>{error.firstName}</span>}
    <button type="submit" disabled={isInvalid}>
      Submit
    </button>
  </form>
)
```

### Native HTML Validation

You can have your form use controlled input while also falling back to native HTML form validation. Be sure to NOT use the `noValidate` attribute on your form.

```js
const { register, isInvalid, handleOnSubmit } = useForm()

return (
  <form onSubmit={handleOnSubmit(form => console.log(form))}>
    <input required type="email" {...register('email')} />
    <button type="submit" disabled={isInvalid}>
      Submit
    </button>
  </form>
)
```

### Initialization

You can initialize form values with either `setValue` (inside a `useEffect` most likely), or with the `initialValues` option to `useForm`. The latter will have one less render cycle, but may not satisfy all use cases (like if your form initialization depends on an async process like an API request).

```js
import { useForm } from 'use-form-controlled'
import TextField from '@mui/material/TextField'

const { setValue } = useForm({
  validators: {
    name(form) {
      if (!form?.name.trim()) {
        return 'Name is required'
      }
    }
  },
  initialValues: {
    name: 'First Last'
  }
})

// If your initialization data depends on a fetch
const data = getDataFromAPI()

useEffect(() => {
  if (data?.name) {
    setValue({ name: data.name })
  }
}, [data])
```

### Dependent Validation

Sometimes validation of one form field depends on the value of another. The valdiators defined get passed all form values as their first argument.

```js
const { value, error, isInvalid, handleOnSubmit } = useForm({
  fieldA(form) {
    if (Boolean(form.fieldB) && !form.fieldA) {
      return 'A is required when B is used'
    }
  }
})

return (
  <form onSubmit={handleOnSubmit(form => console.log(form))} noValidate>
    <TextField
      required={Boolean(value.fieldB)}
      label="fieldA"
      error={Boolean(error.fieldA)}
      helperText={error.fieldA}
      {...register('fieldA', { required: Boolean(value.fieldB) })}
    />
    <TextField label="fieldB" {...register('fieldB')} />
    <button type="submit" disabled={isInvalid}>
      Submit
    </button>
  </form>
)
```

### Async Validation

Sometimes you need to check uniqueness or availabilty of a form field value on the server via an API request to validate. In those cases define validators that accept a boolean as the second argument and use `runAsyncCheck` option when calling `register`. Note that by default `register` will only call the validators with the `runAsyncCheck` option during an `onBlur` event. If you want to trigger it during `onChange` or another event you will have to write your own handler overriding the one from `register` (or don't use `register`).

```js
const { register, value, error, isInvalid, handleOnSubmit } = useForm({
  validators: {
    async username(form, checkAvailability = true) {
      if (!form?.username.trim()) {
        return 'Username is required'
      }

      if (checkAvailability) {
        const isAvailable = await api.fetch('/availability', form.username)

        if (!isAvailable) {
          return `Username must be unique, the one chosen is already taken`
        }
      }
    }
  },
  initialValues: {
    // This could come from props, or an API request, etc.
    username: initialUsername
  }
})

return (
  <form onSubmit={handleOnSubmit(form => console.log(form))} noValidate>
    <TextField
      required
      label="username"
      error={Boolean(error.username)}
      helperText={error.username}
      {...register('username', {
        required: true,
        runAsyncCheck: value.username !== initialUsername
      })}
    />
    <button type="submit" disabled={isInvalid}>
      Submit
    </button>
  </form>
)
```

### Data Type Validation and Submission

All form values are cast to strings in the DOM, so if you need to parse a form field to derive an expected type during validation, you can define a custom `parser` as an option to `register` or use one of the built-in parsers via an available option, like `parseAsInt` or `parseAsNumber`. With this configuration your validators and `handleOnSubmit` callback will receive parsed form values.

```js
const { register, error, isInvalid, handleOnSubmit } = useForm({
  age(form) {
    if (!Number.isInteger(form.age)) {
      return `Age must be a whole number`
    }
  }
})

return (
  <form onSubmit={handleOnSubmit(form => console.log(form))} noValidate>
    <input {...register('age', { required: true, parseAsInt: true })} />
    {error.age && <span>{error.age}</span>}
    <button type="submit" diabled={isInvalid}>
      Submit
    </button>
  </form>
)
```

This would be the same as defining a custom `parser` in the options passed to `register`. For example,

```js
register('age', { required: true, parser: val => parseInt(val, 10) })
```
