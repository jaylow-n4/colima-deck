import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { IPC, type OperationEvent, type Result } from '@shared/types'
import { OperationManager, getInfo, getStatus, getVmUsage, listProfiles } from './colima/commands'
import { getDockerOverview, removeResource, runContainerAction } from './docker/overview'
import { readConfig, writeConfig, writeRawConfig } from './config/colimaYaml'
import {
  assertAction,
  assertConfigValues,
  assertContainerAction,
  assertContainerTarget,
  assertResourceTarget,
  assertProfileName,
  assertStartOptions,
  assertString
} from './validate'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> | unknown

/** 例外をそのまま投げると Electron がメッセージを加工するため、Result 型に包んで返す */
function handle(channel: string, handler: Handler): void {
  ipcMain.handle(channel, async (event, ...args): Promise<Result<unknown>> => {
    try {
      return { ok: true, data: await handler(event, ...args) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

export function registerIpc(getTarget: () => WebContents | undefined): OperationManager {
  const operations = new OperationManager((event: OperationEvent) => {
    const target = getTarget()
    if (target && !target.isDestroyed()) target.send(IPC.operationEvent, event)
  })

  handle(IPC.info, () => getInfo())
  handle(IPC.listProfiles, () => listProfiles())
  handle(IPC.status, (_e, profile) => getStatus(assertProfileName(profile)))
  handle(IPC.vmUsage, (_e, profile) => getVmUsage(assertProfileName(profile)))
  handle(IPC.run, (_e, action, profile, options) =>
    operations.start(assertAction(action), assertProfileName(profile), assertStartOptions(options))
  )
  handle(IPC.cancel, (_e, opId) => operations.cancel(assertString(opId, '操作 ID', 64)))
  handle(IPC.dockerOverview, (_e, profile) => getDockerOverview(assertProfileName(profile)))
  handle(IPC.containerAction, (_e, profile, action, target) =>
    runContainerAction(
      assertProfileName(profile),
      assertContainerAction(action),
      assertContainerTarget(target)
    )
  )
  handle(IPC.removeResource, (_e, profile, target) =>
    removeResource(assertProfileName(profile), assertResourceTarget(target))
  )
  handle(IPC.readConfig, (_e, profile) => readConfig(assertProfileName(profile)))
  handle(IPC.writeConfig, (_e, profile, values) =>
    writeConfig(assertProfileName(profile), assertConfigValues(values))
  )
  handle(IPC.writeRawConfig, (_e, profile, raw) =>
    writeRawConfig(assertProfileName(profile), assertString(raw, 'YAML'))
  )

  return operations
}
