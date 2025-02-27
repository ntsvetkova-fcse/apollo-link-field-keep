import { gql } from '@apollo/client'
import { print } from 'graphql/language/printer'
import { removeIgnoreSetsFromDocument } from '../KeepLink'
import { setInObject } from '../utils'

describe('KeepLink', () => {
  const query = gql`
    query someQuery($shouldKeep: Boolean!) {
      test {
        some
      }
      field @keep(if: $shouldKeep) {
        subFieldA
        subFieldB
      }
    }
  `
  it('should remove directives and fields if shouldKeep is false', () => {
    const { modifiedDoc } = removeIgnoreSetsFromDocument(query, {
      shouldKeep: false,
    })
    expect(print(modifiedDoc)).toMatchSnapshot()
  })
  it('should should keep fields, but remove directives if shouldKeep is true', () => {
    const { modifiedDoc } = removeIgnoreSetsFromDocument(query, {
      shouldKeep: true,
    })
    expect(print(modifiedDoc)).toMatchSnapshot()
  })

  describe('Field Arguments', () => {
    const queryWithArgument = gql`
      query someQuery($argValue: String!, $shouldKeep: Boolean!) {
        someOther {
          subFieldOther
        }
        field(someArg: $argValue) @keep(if: $shouldKeep) {
          subFieldA
          subFieldB
        }
      }
    `
    const queryWithArgumentAndUsedElsewhere = gql`
      query someQuery($argValue: String!, $shouldKeep: Boolean!) {
        someOther {
          subFieldOther(someArg: $argValue) {
            subSubFieldOther
          }
        }
        field(someArg: $argValue) @keep(if: $shouldKeep) {
          subFieldA
          subFieldB
        }
      }
    `

    it('should remove argument variables if exists', () => {
      const { modifiedDoc } = removeIgnoreSetsFromDocument(queryWithArgument, {
        shouldKeep: false,
        argValue: 'test',
      })
      expect(print(modifiedDoc)).toMatchSnapshot()
    })
    it('should keep variables if they are used elsewhere', () => {
      const { modifiedDoc } = removeIgnoreSetsFromDocument(
        queryWithArgumentAndUsedElsewhere,
        { shouldKeep: false, argValue: 'test' }
      )
      expect(print(modifiedDoc)).toMatchSnapshot()
    })
  })

  describe('Deep Fields', () => {
    const deeperQuery = gql`
      query someQuery($argValue: String!, $shouldKeep: Boolean!) {
        someOther {
          subFieldOther
        }
        field {
          subFieldA
          subFieldB {
            deep(someArg: $argValue) @keep(if: $shouldKeep) {
              test {
                wow
              }
            }
          }
        }
      }
    `
    const { modifiedDoc, nullFields } = removeIgnoreSetsFromDocument(
      deeperQuery,
      { shouldKeep: false, argValue: 'test' }
    )
    expect(nullFields).toEqual([['field', 'subFieldB', 'deep']])
    expect(print(modifiedDoc)).toMatchSnapshot()
  })

  describe('Fragment', () => {
    const someFragment = gql`
      fragment queryFragment on Type {
        arg @keep(if: $shouldKeep) {
          test
        }
      }
    `
    const fragmentQuery = gql`
      query someQuery($shouldKeep: Boolean!) {
        deeply {
          nested {
            ...queryFragment
          }
        }
      }
      ${someFragment}
    `

    it('should work with fragments', () => {
      const { modifiedDoc, nullFields } = removeIgnoreSetsFromDocument(
        fragmentQuery,
        { shouldKeep: false }
      )
      expect(nullFields).toEqual([['deeply', 'nested', 'arg']])
      expect(print(modifiedDoc)).toMatchSnapshot()
    })
  })

  describe('Aliases', () => {
    const someFragment = gql`
      fragment someOtherFragment on Type {
        aliasForSome: some @keep(if: $shouldKeep) {
          test
        }
      }
    `
    const fragmentQuery = gql`
      query someQuery($shouldKeep: Boolean!) {
        aliasForDeeply: deeply {
          nested {
            ...someOtherFragment
          }
        }
      }
      ${someFragment}
    `

    it('should properly map aliases', () => {
      const { modifiedDoc, nullFields } = removeIgnoreSetsFromDocument(
        fragmentQuery,
        { shouldKeep: false }
      )
      expect(nullFields).toEqual([['aliasForDeeply', 'nested', 'aliasForSome']])
      expect(print(modifiedDoc)).toMatchSnapshot()
    })
  })

  describe('Empty documents', () => {
    const queryThatWillBeEmpty = gql`
      query someQuery($argValue: String!, $shouldKeep: Boolean!) {
        field(someArg: $argValue) @keep(if: $shouldKeep) {
          subFieldA
          subFieldB
        }
      }
    `
    const { modifiedDoc, nullFields } = removeIgnoreSetsFromDocument(
      queryThatWillBeEmpty,
      { shouldKeep: false }
    )

    expect(nullFields).toEqual([['field']])
    expect(modifiedDoc).toBe(null)
  })
})

describe('utilities', () => {
  describe('setInObject', () => {
    it('should work for full objects', () => {
      const object: Record<string, any> = {
        a: [
          { b: { wow: 'test' } },
          { b: { wow: 'test' } },
          { b: { wow: 'test' } },
        ],
      }
      setInObject(object, ['a', 'b', 'nice'], null)
      expect(object).toEqual({
        a: [
          { b: { wow: 'test', nice: null } },
          { b: { wow: 'test', nice: null } },
          {
            b: {
              wow: 'test',
              nice: null,
            },
          },
        ],
      })
    })
    it('should work for null paths', () => {
      const object: Record<string, any> = { a: null }
      setInObject(object, ['a', 'b', 'nice'], null)
      expect(object).toEqual({ a: null })
    })
    it('should work for undefined paths', () => {
      const object: Record<string, any> = {}
      setInObject(object, ['a', 'b', 'nice'], null)
      expect(object).toEqual({})
    })
  })
})
