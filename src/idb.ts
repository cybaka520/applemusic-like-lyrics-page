// 极简 IndexedDB 封装，用于持久化歌单

const DB_NAME = 'amll_db';
const DB_VERSION = 2; // 固定版本号，避免不必要的升级导致数据丢失
const STORE_PLAYLISTS = 'playlists';
const STORE_TRACKS = 'tracks';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => {
      console.error('[IDB] open failed', req.error);
      reject(req.error);
    };
    req.onblocked = () => {
      // 如果旧连接未关闭，等待下一次尝试
      console.warn('[IDB] upgrade blocked');
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        console.warn('[IDB] version change detected, closing old connection');
        try { db.close(); } catch {}
      };
      db.onerror = (e) => {
        console.error('[IDB] database error', e);
      };
      resolve(db);
    };
    req.onupgradeneeded = (e) => {
      console.log('[IDB] upgrade needed, old version:', e.oldVersion, 'new version:', e.newVersion);
      const db = (e.target as IDBOpenDBRequest).result;
      // 只在不存在时创建 store，保留现有数据
      if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
        console.log('[IDB] creating store:', STORE_PLAYLISTS);
        db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        console.log('[IDB] creating store:', STORE_TRACKS);
        db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
      }
    };
  });
}

async function ensureStores(): Promise<void> {
  try {
    const db = await openDB();
    const hasPlaylists = db.objectStoreNames.contains(STORE_PLAYLISTS);
    const hasTracks = db.objectStoreNames.contains(STORE_TRACKS);
    console.log('[IDB] stores check:', { hasPlaylists, hasTracks });
    
    // 如果两个 store 都存在，直接返回
    if (hasPlaylists && hasTracks) {
      db.close();
      return;
    }
    
    // 如果缺少 store，关闭数据库并重新打开以触发升级
    db.close();
    
    // 重新打开数据库，这会触发 onupgradeneeded（如果版本相同但缺少 store）
    // 但由于我们固定了版本号，只有在首次创建或手动升级时才会触发
    const newDb = await openDB();
    const finalHasPlaylists = newDb.objectStoreNames.contains(STORE_PLAYLISTS);
    const finalHasTracks = newDb.objectStoreNames.contains(STORE_TRACKS);
    console.log('[IDB] final stores check:', { finalHasPlaylists, finalHasTracks });
    newDb.close();
    
    // 如果仍然缺少 store，说明需要手动处理
    if (!finalHasPlaylists || !finalHasTracks) {
      console.error('[IDB] stores still missing after ensure:', { finalHasPlaylists, finalHasTracks });
    }
  } catch (e) {
    console.error('[IDB] ensureStores failed', e);
    throw e;
  }
}

export async function idbGetAll<T = any>(storeName: string): Promise<T[]> {
  await ensureStores();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let resolved = false;
    const tx = db.transaction(storeName, 'readonly');
    
    tx.onerror = () => {
      if (!resolved) {
        resolved = true;
        console.error('[IDB] Transaction error in idbGetAll:', tx.error);
        db.close();
        reject(tx.error || new Error('Transaction failed'));
      }
    };
    
    tx.oncomplete = () => {
      db.close();
    };
    
    const st = tx.objectStore(storeName);
    const req = st.getAll();
    
    req.onerror = () => {
      if (!resolved) {
        resolved = true;
        console.error('[IDB] Request error in idbGetAll:', req.error);
        db.close();
        reject(req.error);
      }
    };
    
    req.onsuccess = () => {
      if (!resolved) {
        resolved = true;
        const result = req.result as T[];
        resolve(result);
      }
    };
  });
}

export async function idbPut<T = any>(storeName: string, value: T): Promise<void> {
  await ensureStores();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let resolved = false;
    const tx = db.transaction(storeName, 'readwrite');
    
    tx.onerror = () => {
      if (!resolved) {
        resolved = true;
        console.error('[IDB] Transaction error in idbPut:', tx.error);
        db.close();
        reject(tx.error || new Error('Transaction failed'));
      }
    };
    
    tx.oncomplete = () => {
      if (!resolved) {
        resolved = true;
        db.close();
        resolve();
      }
    };
    
    const st = tx.objectStore(storeName);
    const req = st.put(value as any);
    
    req.onerror = () => {
      if (!resolved) {
        resolved = true;
        console.error('[IDB] Request error in idbPut:', req.error);
        db.close();
        reject(req.error);
      }
    };
    
    req.onsuccess = () => {
      // 等待事务完成，事务完成后会在 tx.oncomplete 中 resolve
    };
  });
}

export async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  await ensureStores();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let resolved = false;
    const tx = db.transaction(storeName, 'readwrite');
    
    tx.onerror = () => {
      if (!resolved) {
        resolved = true;
        console.error('[IDB] Transaction error in idbDelete:', tx.error);
        db.close();
        reject(tx.error || new Error('Transaction failed'));
      }
    };
    
    tx.oncomplete = () => {
      if (!resolved) {
        resolved = true;
        db.close();
        resolve();
      }
    };
    
    const st = tx.objectStore(storeName);
    const req = st.delete(key);
    
    req.onerror = () => {
      if (!resolved) {
        resolved = true;
        console.error('[IDB] Request error in idbDelete:', req.error);
        db.close();
        reject(req.error);
      }
    };
    
    req.onsuccess = () => {
      // 等待事务完成，事务完成后会在 tx.oncomplete 中 resolve
    };
  });
}

export async function idbGet<T = any>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  await ensureStores();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let resolved = false;
    const tx = db.transaction(storeName, 'readonly');
    
    tx.onerror = () => {
      if (!resolved) {
        resolved = true;
        console.error('[IDB] Transaction error in idbGet:', tx.error);
        db.close();
        reject(tx.error || new Error('Transaction failed'));
      }
    };
    
    tx.oncomplete = () => {
      db.close();
    };
    
    const st = tx.objectStore(storeName);
    const req = st.get(key);
    
    req.onerror = () => {
      if (!resolved) {
        resolved = true;
        console.error('[IDB] Request error in idbGet:', req.error);
        db.close();
        reject(req.error);
      }
    };
    
    req.onsuccess = () => {
      if (!resolved) {
        resolved = true;
        const result = req.result as T | undefined;
        resolve(result);
      }
    };
  });
}

export const STORES = { PLAYLISTS: STORE_PLAYLISTS, TRACKS: STORE_TRACKS } as const;

export async function idbInit(): Promise<void> {
  await ensureStores();
}


