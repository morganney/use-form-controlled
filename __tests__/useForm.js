import { renderHook, act } from '@testing-library/react-hooks'

import { useForm } from '../src'

describe('useForm', () => {
  it('validates form fields', async () => {
    const { result } = renderHook(() =>
      useForm({
        email(form) {
          if (!form.email?.trim()) {
            return 'Email is required'
          }

          if (!/@/.test(form.email)) {
            return 'Email is invalid'
          }
        }
      })
    )

    expect(result.current.value.email).toBe(undefined)
    expect(result.current.hasValidationError).toBe(false)

    act(() => {
      // Use setValue to update a form value outside of user interaction
      result.current.setValue({ email: null })
    })

    await act(async () => {
      // Blur to run validation
      await result.current.register('email', { required: true }).onBlur()
    })

    expect(result.current.hasValidationError).toBe(true)
    expect(result.current.error.email).toBe('Email is required')

    await act(async () => {
      await result.current
        .register('email', { required: true })
        .onChange({ target: { value: 't' } })
    })

    // Check that validation ran during onChange when there is an error
    expect(result.current.error.email).toBe('Email is invalid')
  })

  it('handles form submissions and passes data to a callback', async () => {
    const { result } = renderHook(() =>
      useForm({
        name(form) {
          if (!form.name?.trim()) {
            return 'Name is required'
          }
        }
      })
    )
    const onSubmit = jest.fn()
    const submitEvt = new Event('submit')

    submitEvt.preventDefault = jest.fn()

    expect(result.current).toHaveProperty('handleOnSubmit', expect.any(Function))
    expect(result.current.handleOnSubmit() instanceof Function).toBe(true)
    expect(result.current.value.name).toBe(undefined)

    await act(async () => {
      // Submit an empty form
      await result.current.handleOnSubmit(onSubmit)(submitEvt)
    })

    expect(onSubmit).not.toHaveBeenCalled()

    act(() => {
      result.current.setValue({ name: 'test' })
    })

    expect(result.current.value.name).toBe('test')

    await act(async () => {
      await result.current.handleOnSubmit(onSubmit)(submitEvt)
    })

    expect(submitEvt.preventDefault).toHaveBeenCalled()
    expect(onSubmit).toHaveBeenCalledWith({ name: 'test' }, submitEvt)
  })

  it('provides function to clear errors on fields', async () => {
    const { result } = renderHook(() => useForm())

    act(() => {
      result.current.setValidation({
        name: 'Name is required',
        email: 'Email is invalid'
      })
    })

    expect(result.current.error.name).toBe('Name is required')
    expect(result.current.error.email).toBe('Email is invalid')

    act(() => {
      result.current.clearErrors('name')
    })

    expect(result.current.error.name).toBe(undefined)

    act(() => {
      result.current.clearErrors(['email'])
    })

    expect(result.current.error.email).toBe(undefined)
  })

  it('provides dispatch for manual control', () => {
    const { result } = renderHook(() => useForm())

    act(() => {
      result.current.dispatch({
        type: 'update',
        payload: { test: true, pass: 'hopefully' }
      })
    })

    expect(result.current.value).toEqual({ test: true, pass: 'hopefully' })

    act(() => {
      result.current.dispatch({ type: 'unknown' })
    })

    expect(result.error).toEqual(
      new Error('useForm reducer unrecognized action.type: unknown')
    )
  })

  it('will register fields with parsers', async () => {
    const age = jest.fn(form => {
      if (isNaN(form.age)) {
        return 'Age must be a number'
      }
    })
    const { result } = renderHook(() => useForm({ age }))

    act(() => {
      result.current.register('age', { required: true, parseAsInt: true })
    })

    await act(async () => {
      await result.current.register('age', { required: true, parseAsInt: true }).onBlur()
    })

    expect(age).toHaveBeenCalledWith({ age: NaN }, false)
    expect(result.current.error.age).toBe('Age must be a number')

    await act(async () => {
      await result.current
        .register('age', { required: true, parseAsNumber: true })
        .onChange({ target: { value: '35.5' } })
      await result.current
        .register('age', { required: true, parseAsNumber: true })
        .onBlur()
    })

    expect(age).toHaveBeenCalledWith({ age: 35.5 }, false)
  })

  it('runs defined validators on fields that are not required', async () => {
    const name = jest.fn(form => {
      if (form.otherField && !form.name?.trim()) {
        return 'Name is required when otherField is used'
      }
    })
    const { result } = renderHook(() => useForm({ name }))

    act(() => {
      result.current.setValue({ otherField: 'not-empty' })
    })

    await act(async () => {
      await result.current
        .register('name', { required: result.current.value.otherField !== undefined })
        .onBlur()
    })

    expect(name).toHaveBeenCalledWith({ otherField: 'not-empty', name: undefined }, false)
    expect(result.current.error.name).toBe('Name is required when otherField is used')

    act(() => {
      result.current.setValue({ otherField: undefined })
    })

    await act(async () => {
      await result.current
        .register('name', { required: result.current.value.otherField !== undefined })
        .onBlur()
    })

    expect(name).toHaveBeenCalledWith({ otherField: undefined, name: undefined }, false)
    expect(result.current.error.name).toBe(undefined)
  })

  it('accepts initialValues', () => {
    const { result, rerender } = renderHook(config => useForm(config), {
      initialProps: {
        validators: {},
        initialValues: {
          field: 'test'
        }
      }
    })

    expect(result.current.value).toEqual({ field: 'test' })

    // Can also pass just initialValues without validators
    rerender({ initialValues: { field: 'test' } })

    expect(result.current.value).toEqual({ field: 'test' })
  })
})
