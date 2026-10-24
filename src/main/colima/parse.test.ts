import { describe, expect, it } from 'vitest'
import { parseList, parseStatus, parseVersion, parseVmUsage } from './parse'

describe('parseList', () => {
  it('1 行 1 JSON の出力を読む', () => {
    const stdout = [
      '{"name":"default","status":"Running","arch":"aarch64","cpus":2,"memory":2147483648,"disk":107374182400,"runtime":"docker","address":"192.168.106.2"}',
      '{"name":"dev","status":"Stopped","arch":"aarch64","cpus":4,"memory":8589934592,"disk":64424509440,"runtime":"containerd"}'
    ].join('\n')
    const profiles = parseList(stdout)
    expect(profiles).toHaveLength(2)
    expect(profiles[0]).toMatchObject({
      name: 'default',
      status: 'Running',
      cpus: 2,
      address: '192.168.106.2'
    })
    expect(profiles[1]).toMatchObject({
      name: 'dev',
      status: 'Stopped',
      runtime: 'containerd',
      address: ''
    })
  })

  it('JSON 以外の行や壊れた行は無視する', () => {
    expect(parseList('time="..." level=warning msg="x"\n{broken\n\n')).toEqual([])
  })
})

describe('parseStatus', () => {
  it('snake_case のキーを変換する', () => {
    const status = parseStatus(
      '{"display_name":"colima","driver":"macOS Virtualization.Framework","arch":"aarch64","runtime":"docker","mount_type":"virtiofs","docker_socket":"unix:///Users/me/.colima/default/docker.sock","kubernetes":false,"cpu":2,"memory":2147483648,"disk":107374182400}'
    )
    expect(status).toMatchObject({
      displayName: 'colima',
      mountType: 'virtiofs',
      dockerSocket: 'unix:///Users/me/.colima/default/docker.sock',
      kubernetes: false,
      cpu: 2
    })
  })
})

describe('parseVersion', () => {
  it('バージョンを取り出す', () => {
    expect(parseVersion('colima version 0.8.1\ngit commit: abc\n')).toBe('0.8.1')
  })
})

describe('parseVmUsage', () => {
  const output = [
    '## mem',
    '               total        used        free      shared  buff/cache   available',
    'Mem:      8308359168   494538752  1932374016      749568  6090444800  7813820416',
    'Swap:              0           0           0',
    '## disk',
    'Filesystem       1B-blocks       Used   Available Use% Mounted on',
    '/dev/root      19682557952 1252413440 18413367296   7% /',
    '## load',
    '0.10 0.03 0.50 1/143 889969'
  ].join('\n')

  it('メモリ・ディスク・負荷を読む', () => {
    expect(parseVmUsage(output)).toEqual({
      memTotal: 8308359168,
      memUsed: 8308359168 - 7813820416,
      diskTotal: 19682557952,
      diskUsed: 1252413440,
      load1: 0.1,
      load5: 0.03,
      load15: 0.5
    })
  })

  it('解釈できない出力はエラーにする', () => {
    expect(() => parseVmUsage('bash: free: not found')).toThrow()
  })
})
