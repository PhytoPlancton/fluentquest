import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { transcribe, type TranscribeProgress } from './transcribe.js';
import { uploadSession } from './api-client.js';

// Persistent settings (token, api url, model, language, etc.)
// We avoid electron-store types complexity at import time and use a plain JSON file.
const STORE_PATH = path.join(app.getPath('userData'), 'settings.json');

interface Settings {
  apiUrl?: string;
  token?: string;
  workspaceId?: string;
  defaultLanguage?: 'en' | 'es' | 'fr';
  whisperModel?: string;
}

function loadSettings(): Settings {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(s: Settings): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2), 'utf8');
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    title: 'FluentQuest',
    backgroundColor: '#0c0c12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Allow Web APIs to be granted automatically when the user picks the source.
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      if (permission === 'media' || permission === 'display-capture') {
        callback(true);
        return;
      }
      callback(false);
    },
  );

  // Required for getDisplayMedia on macOS to surface a source picker.
  mainWindow.webContents.session.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      // We forward to the renderer via desktopCapturer in a future iteration.
      // For now, pass loopback audio if available (Electron 30+ on macOS).
      const { desktopCapturer } = await import('electron');
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        fetchWindowIcons: false,
      });
      const screen = sources[0];
      if (!screen) {
        callback({});
        return;
      }
      // 'loopback' = system audio (macOS 13+ via ScreenCaptureKit).
      callback({ video: screen, audio: 'loopback' });
    },
    { useSystemPicker: false },
  );

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  // IPC: settings
  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    const current = loadSettings();
    const merged = { ...current, ...patch };
    saveSettings(merged);
    return merged;
  });

  // IPC: transcribe an audio buffer (Float32Array PCM 16kHz mono from the renderer)
  ipcMain.handle(
    'whisper:transcribe',
    async (
      event,
      payload: { audio: Float32Array; language?: 'en' | 'es' | 'fr' | 'auto'; modelId?: string },
    ) => {
      const send = (p: TranscribeProgress) =>
        event.sender.send('whisper:progress', p);
      return transcribe(payload.audio, {
        language: payload.language ?? 'auto',
        modelId: payload.modelId ?? 'Xenova/whisper-base',
        onProgress: send,
      });
    },
  );

  // IPC: upload a session (segments) to the FluentQuest API
  ipcMain.handle(
    'api:uploadSession',
    async (
      _e,
      payload: {
        title?: string;
        languages: Array<'en' | 'es' | 'fr'>;
        segments: Array<{
          speakerLabel: string;
          startMs: number;
          endMs: number;
          text: string;
          language: 'en' | 'es' | 'fr';
        }>;
      },
    ) => {
      const settings = loadSettings();
      if (!settings.token || !settings.apiUrl || !settings.workspaceId) {
        throw new Error('Missing token, apiUrl, or workspaceId in settings');
      }
      return uploadSession({
        apiUrl: settings.apiUrl,
        token: settings.token,
        workspaceId: settings.workspaceId,
        title: payload.title,
        languages: payload.languages,
        segments: payload.segments,
      });
    },
  );

  // IPC: open external URL (eg. to view the session in the web app)
  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (typeof url !== 'string') return;
    if (!/^https?:\/\//.test(url)) return;
    void shell.openExternal(url);
  });

  // IPC: platform info
  ipcMain.handle('app:info', () => ({
    platform: os.platform(),
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
  }));

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
