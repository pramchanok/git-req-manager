import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('splashAPI', {
  onUpdateStatus: (callback: (text: string) => void) => {
    ipcRenderer.on('update-status', (_event, text) => callback(text));
  },
  onUpdateProgress: (callback: (percent: number) => void) => {
    ipcRenderer.on('update-progress', (_event, percent) => callback(percent));
  },
  onInstallationMode: (callback: () => void) => {
    ipcRenderer.on('installation-mode', () => callback());
  }
});
