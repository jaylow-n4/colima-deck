import { describe, expect, it } from 'vitest'
import { applyValues, colimaHome, extractValues } from './colimaYaml'

const SAMPLE = `# Number of CPUs to be allocated to the virtual machine.
# Default: 2
cpu: 2

# Size of the disk in GiB to be allocated to the virtual machine.
disk: 100

memory: 2
arch: aarch64
runtime: docker
hostname: colima

kubernetes:
  enabled: false
  version: v1.33.4+k3s1
  k3sArgs:
    - --disable=traefik

vmType: vz
`

describe('extractValues', () => {
  it('フォーム用の値を取り出す', () => {
    expect(extractValues(SAMPLE)).toEqual({
      cpu: 2,
      memory: 2,
      disk: 100,
      runtime: 'docker',
      vmType: 'vz',
      kubernetes: false
    })
  })

  it('構文エラーを報告する', () => {
    expect(() => extractValues('cpu: [1, 2')).toThrow(/YAML/)
  })
})

describe('applyValues', () => {
  it('コメントと他の項目を保ったまま書き換える', () => {
    const out = applyValues(SAMPLE, {
      cpu: 4,
      memory: 8,
      disk: 120,
      runtime: 'containerd',
      vmType: 'qemu',
      kubernetes: true
    })
    expect(out).toContain('# Number of CPUs to be allocated to the virtual machine.')
    expect(out).toContain('cpu: 4')
    expect(out).toContain('memory: 8')
    expect(out).toContain('hostname: colima')
    expect(out).toContain('version: v1.33.4+k3s1')
    expect(out).toContain('- --disable=traefik')
    expect(extractValues(out)).toEqual({
      cpu: 4,
      memory: 8,
      disk: 120,
      runtime: 'containerd',
      vmType: 'qemu',
      kubernetes: true
    })
  })
})

describe('colimaHome', () => {
  it('COLIMA_HOME を優先する', () => {
    expect(colimaHome({ COLIMA_HOME: '/custom' }, '/home/x')).toBe('/custom')
  })

  it('~/.colima が無ければ XDG_CONFIG_HOME を使う', () => {
    expect(colimaHome({ XDG_CONFIG_HOME: '/xdg' }, '/nonexistent-home')).toBe('/xdg/colima')
  })

  it('どちらも無ければ ~/.colima', () => {
    expect(colimaHome({}, '/nonexistent-home')).toBe('/nonexistent-home/.colima')
  })
})
