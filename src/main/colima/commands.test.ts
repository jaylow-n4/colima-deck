import { describe, expect, it } from 'vitest'
import { buildArgs } from './commands'

describe('buildArgs', () => {
  it('プロファイルは --profile= 形式で渡す', () => {
    expect(buildArgs('stop', 'dev')).toEqual(['stop', '--profile=dev'])
  })

  it('delete には --force を付ける', () => {
    expect(buildArgs('delete', 'dev')).toEqual(['delete', '--profile=dev', '--force'])
  })

  it('start のオプションをフラグにする', () => {
    expect(
      buildArgs('start', 'dev', {
        cpu: 4,
        memory: 8,
        disk: 60,
        runtime: 'containerd',
        vmType: 'vz',
        kubernetes: true
      })
    ).toEqual([
      'start',
      '--profile=dev',
      '--cpu=4',
      '--memory=8',
      '--disk=60',
      '--runtime=containerd',
      '--vm-type=vz',
      '--kubernetes'
    ])
  })

  it('start 以外ではオプションを無視する', () => {
    expect(buildArgs('restart', 'dev', { cpu: 4 })).toEqual(['restart', '--profile=dev'])
  })
})
