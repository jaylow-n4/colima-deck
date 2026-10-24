import { describe, expect, it } from 'vitest'
import { buildActionArgs, buildRemoveArgs, projectFilterArgs } from './actions'

describe('buildActionArgs', () => {
  it('start / stop / restart はそのまま渡す', () => {
    expect(buildActionArgs('stop', ['a', 'b'])).toEqual(['stop', 'a', 'b'])
    expect(buildActionArgs('restart', ['a'])).toEqual(['restart', 'a'])
  })

  it('削除は docker rm -f にする', () => {
    expect(buildActionArgs('remove', ['a'])).toEqual(['rm', '-f', 'a'])
  })
})

describe('projectFilterArgs', () => {
  it('プロジェクト名のラベルで絞り込む', () => {
    expect(projectFilterArgs('app')).toEqual(['--filter', 'label=com.docker.compose.project=app'])
  })
})

describe('buildRemoveArgs', () => {
  it('ボリュームとネットワークの削除コマンドにする', () => {
    expect(buildRemoveArgs({ type: 'volume', name: 'data' })).toEqual(['volume', 'rm', 'data'])
    expect(buildRemoveArgs({ type: 'image', reference: 'app:1' })).toEqual(['image', 'rm', 'app:1'])
    expect(buildRemoveArgs({ type: 'network', id: 'abc123def456' })).toEqual([
      'network',
      'rm',
      'abc123def456'
    ])
  })
})
