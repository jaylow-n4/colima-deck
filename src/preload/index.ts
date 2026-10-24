import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type ColimaDeckApi, type OperationEvent } from '@shared/types'

const api: ColimaDeckApi = {
  info: () => ipcRenderer.invoke(IPC.info),
  listProfiles: () => ipcRenderer.invoke(IPC.listProfiles),
  status: (profile) => ipcRenderer.invoke(IPC.status, profile),
  vmUsage: (profile) => ipcRenderer.invoke(IPC.vmUsage, profile),
  run: (action, profile, options) => ipcRenderer.invoke(IPC.run, action, profile, options),
  cancel: (opId) => ipcRenderer.invoke(IPC.cancel, opId),
  dockerOverview: (profile) => ipcRenderer.invoke(IPC.dockerOverview, profile),
  containerAction: (profile, action, target) =>
    ipcRenderer.invoke(IPC.containerAction, profile, action, target),
  removeResource: (profile, target) => ipcRenderer.invoke(IPC.removeResource, profile, target),
  readConfig: (profile) => ipcRenderer.invoke(IPC.readConfig, profile),
  writeConfig: (profile, values) => ipcRenderer.invoke(IPC.writeConfig, profile, values),
  writeRawConfig: (profile, raw) => ipcRenderer.invoke(IPC.writeRawConfig, profile, raw),
  onOperationEvent: (listener) => {
    const wrapped = (_e: Electron.IpcRendererEvent, event: OperationEvent): void => listener(event)
    ipcRenderer.on(IPC.operationEvent, wrapped)
    return () => ipcRenderer.removeListener(IPC.operationEvent, wrapped)
  }
}

contextBridge.exposeInMainWorld('colimaDeck', api)
