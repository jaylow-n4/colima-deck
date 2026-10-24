import { describe, expect, it } from 'vitest'
import {
  parseContainers,
  parseImages,
  parseNetworks,
  parseNetworkSubnets,
  parseVolumes
} from './parse'

const row = (o: Record<string, string>): string =>
  JSON.stringify({
    id: 'a'.repeat(64),
    name: 'c',
    image: 'img',
    state: 'running',
    status: 'Up',
    ports: '',
    networks: '',
    project: '',
    service: '',
    workingDir: '',
    configFiles: '',
    ...o
  })

describe('parseContainers', () => {
  it('compose 管理でないコンテナはプロジェクトに含めない', () => {
    const { containers, projects } = parseContainers(row({ name: 'solo' }))
    expect(containers).toHaveLength(1)
    expect(containers[0]).toMatchObject({ id: 'aaaaaaaaaaaa', name: 'solo', project: '' })
    expect(projects).toEqual([])
  })

  it('ラベルから compose プロジェクトとサービスを組み立てる', () => {
    const base = { project: 'app', workingDir: '/w', configFiles: '/w/a.yml,/w/b.yml' }
    const { projects } = parseContainers(
      [
        row({ ...base, name: 'app-web-1', service: 'web', state: 'running' }),
        row({ ...base, name: 'app-db-1', service: 'db', state: 'exited' }),
        row({ ...base, name: 'app-web-2', service: 'web', state: 'running' })
      ].join('\n')
    )
    expect(projects).toHaveLength(1)
    expect(projects[0]).toMatchObject({
      name: 'app',
      workingDir: '/w',
      configFiles: ['/w/a.yml', '/w/b.yml'],
      running: 2,
      total: 3
    })
    expect(projects[0].services.map((s) => [s.service, s.containers.length])).toEqual([
      ['db', 1],
      ['web', 2]
    ])
  })

  it('JSON 以外の行や壊れた行は無視する', () => {
    expect(parseContainers('warning\n{broken\n\n')).toEqual({ containers: [], projects: [] })
  })
})

describe('parseImages', () => {
  it('docker images の JSON を読む', () => {
    const images = parseImages(
      '{"Containers":"1","CreatedSince":"6 minutes ago","ID":"0ee40b3dd8c8","Repository":"foo","Size":"3.47GB","Tag":"latest"}\n' +
        '{"Containers":"N/A","ID":"sha256:abcdef0123456789","Repository":"<none>","Size":"1MB","Tag":"<none>"}'
    )
    expect(images[0]).toEqual({
      id: '0ee40b3dd8c8',
      reference: 'foo:latest',
      repository: 'foo',
      tag: 'latest',
      size: '3.47GB',
      created: '6 minutes ago',
      containers: 1
    })
    expect(images[1]).toMatchObject({
      id: 'abcdef012345',
      reference: 'abcdef012345',
      containers: null
    })
  })
})

describe('parseVolumes', () => {
  it('どのコンテナからも参照されていないものを未使用にする', () => {
    const volumes = parseVolumes(
      '{"name":"a","driver":"local","project":"app"}\n{"name":"b","driver":"local","project":""}',
      'b\n'
    )
    expect(volumes).toEqual([
      { name: 'a', driver: 'local', project: 'app', inUse: true },
      { name: 'b', driver: 'local', project: '', inUse: false }
    ])
  })
})

describe('parseNetworks', () => {
  it('接続コンテナ数を数え、組み込みネットワークを判別する', () => {
    const { containers } = parseContainers(
      [
        row({ id: 'a'.repeat(64), networks: 'app_default,bridge' }),
        row({ id: 'b'.repeat(64), networks: 'app_default' })
      ].join('\n')
    )
    const networks = parseNetworks(
      [
        '{"id":"1111","name":"bridge","driver":"bridge","scope":"local","internal":"false","project":""}',
        '{"id":"2222","name":"app_default","driver":"bridge","scope":"local","internal":"true","project":"app"}'
      ].join('\n'),
      containers,
      parseNetworkSubnets(
        '{"id":"1111","ipam":[{"Subnet":"172.17.0.0/16","Gateway":"172.17.0.1"}]}\n{"id":"2222","ipam":null}'
      )
    )
    expect(networks[0].subnets).toEqual([{ cidr: '172.17.0.0/16', gateway: '172.17.0.1' }])
    expect(networks[1].subnets).toEqual([])
    expect(networks[0]).toMatchObject({ name: 'bridge', builtin: true, containers: 1 })
    expect(networks[1]).toMatchObject({
      name: 'app_default',
      builtin: false,
      internal: true,
      project: 'app',
      containers: 2
    })
  })
})
