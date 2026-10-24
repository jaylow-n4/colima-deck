import { describe, expect, it } from 'vitest'
import {
  assertAction,
  assertConfigValues,
  assertContainerAction,
  assertContainerTarget,
  assertProfileName,
  assertResourceTarget,
  assertStartOptions
} from './validate'

describe('assertProfileName', () => {
  it.each(['default', 'dev-1', 'my_profile', 'A1'])('%s を許可する', (name) => {
    expect(assertProfileName(name)).toBe(name)
  })

  it.each(['', '-p', '_x', 'a b', 'a;rm -rf /', '../etc', 'a/b', 'x'.repeat(65), 42, null])(
    '%s を拒否する',
    (name) => {
      expect(() => assertProfileName(name)).toThrow()
    }
  )
})

describe('assertAction', () => {
  it('未知の操作を拒否する', () => {
    expect(() => assertAction('ssh')).toThrow()
    expect(assertAction('start')).toBe('start')
  })
})

describe('assertStartOptions', () => {
  it('未指定なら空オブジェクト', () => {
    expect(assertStartOptions(undefined)).toEqual({})
  })

  it('範囲外や不正な値を拒否する', () => {
    expect(() => assertStartOptions({ cpu: 0 })).toThrow()
    expect(() => assertStartOptions({ memory: 1.5 })).toThrow()
    expect(() => assertStartOptions({ runtime: 'docker --foo' })).toThrow()
    expect(() => assertStartOptions({ kubernetes: 'yes' })).toThrow()
  })

  it('未知のキーは落とす', () => {
    expect(assertStartOptions({ cpu: 2, extra: '--evil' })).toEqual({ cpu: 2 })
  })
})

describe('assertConfigValues', () => {
  it('正しい値を通す', () => {
    const values = {
      cpu: 2,
      memory: 4,
      disk: 60,
      runtime: 'docker',
      vmType: 'vz',
      kubernetes: false
    }
    expect(assertConfigValues(values)).toEqual(values)
  })
})

describe('assertContainerAction', () => {
  it('許可した操作のみ通す', () => {
    expect(assertContainerAction('remove')).toBe('remove')
    expect(() => assertContainerAction('exec')).toThrow()
    expect(() => assertContainerAction(undefined)).toThrow()
  })
})

describe('assertContainerTarget', () => {
  it('コンテナ ID とプロジェクト名を検証する', () => {
    expect(assertContainerTarget({ type: 'container', id: 'abc123def456' })).toEqual({
      type: 'container',
      id: 'abc123def456'
    })
    expect(assertContainerTarget({ type: 'project', name: 'my-app_1' })).toEqual({
      type: 'project',
      name: 'my-app_1'
    })
  })

  it.each([
    null,
    'x',
    { type: 'container', id: '--all' },
    { type: 'container', id: 'abc' },
    { type: 'container', id: 'ABC123DEF456' },
    { type: 'project', name: '-x' },
    { type: 'project', name: 'a b' },
    { type: 'project', name: '' },
    { type: 'other' }
  ])('%j を拒否する', (target) => {
    expect(() => assertContainerTarget(target)).toThrow()
  })
})

describe('assertResourceTarget', () => {
  it('ボリューム名とネットワーク ID を検証する', () => {
    expect(assertResourceTarget({ type: 'volume', name: 'app_data-1.x' })).toEqual({
      type: 'volume',
      name: 'app_data-1.x'
    })
    expect(assertResourceTarget({ type: 'network', id: 'a'.repeat(64) })).toEqual({
      type: 'network',
      id: 'a'.repeat(64)
    })
  })

  it.each(['postgres:17', 'ghcr.io/org/app:1.2', 'localhost:5000/a/b:latest', 'a1b2c3d4e5f6'])(
    'イメージ %s を許可する',
    (reference) => {
      expect(assertResourceTarget({ type: 'image', reference })).toEqual({
        type: 'image',
        reference
      })
    }
  )

  it.each([
    null,
    { type: 'image', reference: '-f' },
    { type: 'image', reference: 'a b' },
    { type: 'image', reference: 'a;b' },
    { type: 'image', reference: '' },
    { type: 'volume', name: '-f' },
    { type: 'volume', name: 'a b' },
    { type: 'volume', name: '/etc' },
    { type: 'network', id: 'bridge' },
    { type: 'network', id: '--all' },
    { type: 'container', id: 'abc123def456' }
  ])('%j を拒否する', (target) => {
    expect(() => assertResourceTarget(target)).toThrow()
  })
})
