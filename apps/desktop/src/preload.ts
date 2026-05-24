import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('fluentquest', {
  version: '0.0.0',
});
