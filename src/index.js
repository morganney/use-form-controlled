import { useReducer, useRef, useMemo, useCallback } from 'react'

const getValidators = config => {
  if (config.validators) {
    return config.validators
  }

  if (config.initialValues) {
    return {}
  }

  return config
}
const init = config => {
  const validators = getValidators(config)
  const formFields = Object.keys(validators)
  const defaultInitial = {}
  const defaultParsers = {}
  const reducerInitialState = {}

  formFields.forEach(field => {
    defaultInitial[field] = undefined
    defaultParsers[field] = val => val
  })

  reducerInitialState.value = defaultInitial
  reducerInitialState.error = defaultInitial
  reducerInitialState.required = defaultInitial

  if (config.initialValues) {
    reducerInitialState.value = {
      ...defaultInitial,
      ...config.initialValues
    }
  }

  return {
    validators,
    reducerInitialState,
    parsers: defaultParsers
  }
}
const reducer = (state, action) => {
  switch (action.type) {
    case 'update':
      return { ...state, value: { ...state.value, ...action.payload } }
    case 'validate':
      return { ...state, error: { ...state.error, ...action.payload } }
    case 'required':
      return { ...state, required: { ...state.required, ...action.payload } }
    default:
      throw new Error(`useForm reducer unrecognized action.type: ${action.type}`)
  }
}
const defaultRegisterOptions = {
  binary: false,
  required: false,
  runAsyncCheck: false,
  parser: val => val,
  parseAsInt: false,
  parseAsNumber: false
}
const getParse = options => {
  const { parseAsInt, parseAsNumber } = options

  if (parseAsInt) {
    return val => parseInt(val, 10)
  }

  if (parseAsNumber) {
    return val => Number(val)
  }

  return options.parser
}
/**
 * Custom hook responsible for managing forms data, submission, validations and errors.
 *
 * The `config` parameter is an object of validators whose keys correspond to form field names,
 * or an object with either a `validators`, or `initialValues` key, or both.
 *
 * @param {object} config
 *   config.validators: An object of validation functions whose keys correspond to form field names.
 *   config.initialValues: An object form values whose keys correspond to form field names.
 */
const useForm = (config = {}) => {
  const { validators, parsers, reducerInitialState } = useMemo(
    () => init(config),
    [config]
  )
  const validationFields = useMemo(() => Object.keys(validators), [validators])
  const parser = useRef(parsers)
  const parsedFieldValues = useRef({})
  const requiredFields = useRef({})
  const [{ value, error, required }, dispatch] = useReducer(reducer, reducerInitialState)
  const isBlank = useMemo(
    () => Object.keys(value).every(field => value[field] === undefined),
    [value]
  )
  const hasBlankRequired = useMemo(() => {
    return Object.keys(required)
      .filter(field => required[field])
      .some(field => value[field] === undefined)
  }, [required, value])
  const hasValidationError = useMemo(() => {
    return validationFields.some(field => error[field])
  }, [validationFields, error])
  const isInvalid = useMemo(() => {
    return hasBlankRequired || hasValidationError
  }, [hasBlankRequired, hasValidationError])
  const setValidation = useCallback(
    payload => dispatch({ type: 'validate', payload }),
    [dispatch]
  )
  const setValue = useCallback(
    payload => dispatch({ type: 'update', payload }),
    [dispatch]
  )
  /**
   * Clears all or specific field errors.
   *
   * @param {string|array} fields which field names to clear, or all fields if omitted
   */
  const clearErrors = useCallback(
    fields => {
      const payload = {}
      let keys = Object.keys(error)

      if (typeof fields === 'string') {
        keys = [fields]
      }

      if (Array.isArray(fields)) {
        keys = fields
      }

      keys.forEach(key => {
        payload[key] = undefined
      })
      dispatch({ type: 'validate', payload })
    },
    [dispatch, error]
  )
  const handleOnSubmit = useMemo(() => {
    /**
     * Runs validation on all form fields registered during the `useForm` call.
     * Does NOT run async validation checks defined in validators as those should have
     * been triggered during data entry, for example during a blur event.
     *
     * @returns {boolean}
     */
    const isValid = async () => {
      const promises = []
      let foundError = false
      let msgs = null

      validationFields.forEach(field => {
        const parsed = parser.current[field](value[field])

        parsedFieldValues.current[field] = parsed
        /**
         * The generic signature for form validation functions:
         * (formValues, runAsynCheck: bool) => Promise<string | undefined> | string | undefined
         *
         * Where `string` is a validation error message if the form field is invalid.
         */
        promises.push(
          validators[field]({ ...value, ...parsedFieldValues.current }, false)
        )
      })

      msgs = await Promise.all(promises)
      msgs.forEach((msg, idx) => {
        if (msg) {
          foundError = true
          dispatch({
            type: 'validate',
            payload: { [validationFields[idx]]: msg }
          })
        }
      })

      return !foundError
    }

    return onSubmit => async evt => {
      evt.preventDefault()

      if (await isValid()) {
        const parsedValues = {}

        Object.keys(value).forEach(field => {
          if (value[field] !== undefined) {
            parsedValues[field] =
              parsedFieldValues.current[field] ?? parser.current[field](value[field])
          }
        })

        onSubmit({ ...value, ...parsedValues }, evt)
      }
    }
  }, [value, validators, validationFields])
  /**
   * Function to create standard event handlers and values for form fields.
   *
   * The possible options are:
   * required: boolean - Should the field return a validation event handler (defaults to use validationFields)
   * runAsyncCheck: boolean - Whether the validator should run the async validation with the server
   * parseAsNumber: boolean - Whether the form value entered should be parsed as a number before validating. Supersedes `parser` option.
   * parseAsInt: boolean - Whether the form value entered should be parsed as an integer before validationg. Supersedes `parser` option.
   * parser: function - Receives the form field value and should return the parsed representation. Parsed value passed to validator.
   * binary: boolean - Should the field input be read from the evt.target.checked property instead of evt.target.value during onChange (Checkbox, Switch, etc.).
   *
   * @param {string} name The name of the form field which should match a key from API data
   * @param {object} opts Options to configure return values and behavior
   * @returns {object}
   */
  const register = useCallback(
    (name, opts = {}) => {
      const options = { ...defaultRegisterOptions, ...opts }
      const { required: isRequired, binary, runAsyncCheck } = options
      const parse = getParse(options)
      const onChange = async evt => {
        dispatch({
          type: 'update',
          payload: { [name]: evt.target[binary ? 'checked' : 'value'] }
        })

        if (error[name]) {
          const parsed = parse(evt.target[binary ? 'checked' : 'value'])

          parsedFieldValues.current[name] = parsed
          dispatch({
            type: 'validate',
            payload: {
              [name]: await validators[name]({
                ...value,
                ...parsedFieldValues.current
              })
            }
          })
        }
      }
      let onBlur = () => {}

      if (validationFields.includes(name)) {
        onBlur = async () => {
          const parsed = parse(value[name])

          parsedFieldValues.current[name] = parsed
          dispatch({
            type: 'validate',
            payload: {
              [name]: await validators[name](
                { ...value, ...parsedFieldValues.current },
                runAsyncCheck
              )
            }
          })
        }
      }

      // Only add required field if not already added
      if (isRequired && !requiredFields.current[name]) {
        requiredFields.current[name] = true
        dispatch({
          type: 'required',
          payload: { [name]: true }
        })
      }

      // Clear cache and remove previously required field
      if (!isRequired && requiredFields.current[name]) {
        requiredFields.current[name] = false
        dispatch({
          type: 'required',
          payload: { [name]: false }
        })

        // If there is no value in the previously required field, clear any errors
        if ((value[name] === undefined || value[name] === '') && error[name]) {
          clearErrors(name)
        }
      }

      if (typeof parse === 'function') {
        parser.current[name] = parse
      }

      return { value: value[name] ?? '', required: isRequired, onChange, onBlur, name }
    },
    [error, validationFields, validators, value, clearErrors]
  )

  return {
    dispatch,
    value,
    error,
    clearErrors,
    hasValidationError,
    isInvalid,
    isBlank,
    hasBlankRequired,
    register,
    handleOnSubmit,
    setValue,
    setValidation,
    required: requiredFields.current,
    parser: parser.current
  }
}

export { useForm }
