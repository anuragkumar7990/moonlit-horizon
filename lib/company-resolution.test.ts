import { describe, it, expect } from 'vitest'
import {
  toTitleCase,
  inferCompanyFromDomain,
  isJunkAccountName,
  isJunkCallResult,
  untaggedCompanyName,
  resolveFallbackAccountName,
} from './company-resolution'

describe('toTitleCase', () => {
  it('capitalises a plain lowercase word', () => {
    expect(toTitleCase('acme')).toBe('Acme')
  })

  it('preserves all-caps abbreviations', () => {
    expect(toTitleCase('KPMG')).toBe('KPMG')
    expect(toTitleCase('ABB')).toBe('ABB')
  })

  it('title-cases each word in a multi-word name', () => {
    expect(toTitleCase('applied data finance')).toBe('Applied Data Finance')
  })

  it('returns falsy input unchanged', () => {
    expect(toTitleCase('')).toBe('')
  })
})

describe('inferCompanyFromDomain', () => {
  it('returns empty string for free email providers', () => {
    expect(inferCompanyFromDomain('someone@gmail.com')).toBe('')
    expect(inferCompanyFromDomain('someone@yahoo.co.in')).toBe('')
  })

  it('uppercases short domain labels (likely abbreviations)', () => {
    expect(inferCompanyFromDomain('a@abb.com')).toBe('ABB')
  })

  it('title-cases longer domain labels', () => {
    expect(inferCompanyFromDomain('a@example.com')).toBe('Example')
  })

  it('returns empty string for a malformed email', () => {
    expect(inferCompanyFromDomain('not-an-email')).toBe('')
  })
})

describe('isJunkAccountName / isJunkCallResult', () => {
  it('matches known junk account names case-insensitively', () => {
    expect(isJunkAccountName('The Test Tribe')).toBe(true)
    expect(isJunkAccountName('  test call  ')).toBe(true)
    expect(isJunkAccountName('Acme Corp')).toBe(false)
  })

  it('matches AI-auto-processed call results case-insensitively', () => {
    expect(isJunkCallResult('AI Processed')).toBe(true)
    expect(isJunkCallResult('Meeting Scheduled')).toBe(false)
  })
})

describe('untaggedCompanyName', () => {
  it('builds a deterministic placeholder from the last 6 chars of an id', () => {
    expect(untaggedCompanyName('1234567890abcdef')).toBe('Untagged Company #ABCDEF')
  })
})

describe('resolveFallbackAccountName', () => {
  it('prefers a domain-inferred name when the email is on a real company domain', () => {
    expect(resolveFallbackAccountName('a@example.com', 'callid123456')).toBe('Example')
  })

  it('falls back to the Untagged placeholder for free email domains', () => {
    expect(resolveFallbackAccountName('a@gmail.com', 'callid123456')).toBe('Untagged Company #123456')
  })

  it('falls back to the Untagged placeholder when there is no email at all', () => {
    expect(resolveFallbackAccountName(undefined, 'callid123456')).toBe('Untagged Company #123456')
  })
})
