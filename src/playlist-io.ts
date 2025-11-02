// 歌单导入导出工具
import JSZip from 'jszip';
import { idbGet, idbGetAll, idbPut, STORES } from './idb';

export type Track = {
  id: string;
  title: string;
  artist?: string;
  duration?: number;
  fileHandleName?: string;
  cacheKey?: string;
  album?: string;
  year?: number;
  coverDataUrl?: string;
  lyricsText?: string;
};

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  tracks: Track[];
};

/**
 * 导出所有歌单为ZIP文件
 */
export async function exportAllPlaylists(): Promise<Blob> {
  const zip = new JSZip();
  
  // 获取所有歌单
  const playlists = await idbGetAll<Playlist>(STORES.PLAYLISTS);
  
  // 收集所有唯一的音频文件
  const audioFiles = new Map<string, { blob: Blob; name: string; type: string }>();
  const trackCacheKeys = new Set<string>();
  
  // 收集所有track的cacheKey
  for (const playlist of playlists) {
    for (const track of playlist.tracks) {
      if (track.cacheKey) {
        trackCacheKeys.add(track.cacheKey);
      }
    }
  }
  
  // 从IndexedDB读取所有音频文件
  for (const cacheKey of trackCacheKeys) {
    try {
      const rec = await idbGet<any>(STORES.TRACKS, cacheKey);
      if (rec && rec.blob instanceof Blob) {
        audioFiles.set(cacheKey, {
          blob: rec.blob,
          name: rec.name || `${cacheKey}.mp3`,
          type: rec.type || 'audio/mpeg'
        });
      }
    } catch (error) {
      console.warn('[导出] 无法读取音频文件:', cacheKey, error);
    }
  }
  
  // 创建文件名映射（cacheKey -> 文件名），用于导入时匹配
  const fileNameMap: Record<string, string> = {};
  
  // 添加音频文件到zip
  const audioDir = zip.folder('audio');
  if (audioDir) {
    for (const [cacheKey, fileData] of audioFiles.entries()) {
      // 使用原始文件名，如果没有则使用cacheKey
      const fileName = fileData.name || `${cacheKey}.mp3`;
      fileNameMap[cacheKey] = fileName;
      audioDir.file(fileName, fileData.blob);
    }
  }
  
  // 添加歌单数据JSON和文件名映射
  zip.file('playlists.json', JSON.stringify(playlists, null, 2));
  zip.file('fileMapping.json', JSON.stringify(fileNameMap, null, 2));
  
  // 生成ZIP文件
  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

/**
 * 导出单个歌单为ZIP文件
 */
export async function exportPlaylist(playlistId: string): Promise<Blob | null> {
  const zip = new JSZip();
  
  // 获取指定歌单
  const playlists = await idbGetAll<Playlist>(STORES.PLAYLISTS);
  const playlist = playlists.find(p => p.id === playlistId);
  
  if (!playlist) {
    return null;
  }
  
  // 收集该歌单的所有音频文件
  const audioFiles = new Map<string, { blob: Blob; name: string; type: string }>();
  
  for (const track of playlist.tracks) {
    if (track.cacheKey) {
      try {
        const rec = await idbGet<any>(STORES.TRACKS, track.cacheKey);
        if (rec && rec.blob instanceof Blob) {
          audioFiles.set(track.cacheKey, {
            blob: rec.blob,
            name: rec.name || `${track.cacheKey}.mp3`,
            type: rec.type || 'audio/mpeg'
          });
        }
      } catch (error) {
        console.warn('[导出] 无法读取音频文件:', track.cacheKey, error);
      }
    }
  }
  
  // 创建文件名映射（cacheKey -> 文件名），用于导入时匹配
  const fileNameMap: Record<string, string> = {};
  
  // 添加音频文件到zip
  const audioDir = zip.folder('audio');
  if (audioDir) {
    for (const [cacheKey, fileData] of audioFiles.entries()) {
      const fileName = fileData.name || `${cacheKey}.mp3`;
      fileNameMap[cacheKey] = fileName;
      audioDir.file(fileName, fileData.blob);
    }
  }
  
  // 添加歌单数据JSON（单个歌单数组）和文件名映射
  zip.file('playlist.json', JSON.stringify([playlist], null, 2));
  zip.file('fileMapping.json', JSON.stringify(fileNameMap, null, 2));
  
  // 生成ZIP文件
  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

/**
 * 从ZIP文件导入歌单
 */
export async function importPlaylists(zipFile: File): Promise<{
  success: boolean;
  importedCount: number;
  error?: string;
}> {
  try {
    const zip = await JSZip.loadAsync(zipFile);
    
    // 读取歌单数据
    let playlistsData: Playlist[] = [];
    
    // 优先尝试读取 playlists.json（多个歌单）
    const playlistsFile = zip.file('playlists.json');
    if (playlistsFile) {
      const content = await playlistsFile.async('string');
      playlistsData = JSON.parse(content);
    } else {
      // 尝试读取 playlist.json（单个歌单）
      const playlistFile = zip.file('playlist.json');
      if (playlistFile) {
        const content = await playlistFile.async('string');
        playlistsData = JSON.parse(content);
      } else {
        return {
          success: false,
          importedCount: 0,
          error: 'ZIP文件中未找到歌单数据文件'
        };
      }
    }
    
    // 读取文件名映射
    const mappingFile = zip.file('fileMapping.json');
    const fileNameMap: Record<string, string> = {};
    if (mappingFile) {
      try {
        const mappingContent = await mappingFile.async('string');
        Object.assign(fileNameMap, JSON.parse(mappingContent));
      } catch (e) {
        console.warn('[导入] 无法读取文件映射，将使用备用匹配方法');
      }
    }
    
    if (!Array.isArray(playlistsData)) {
      return {
        success: false,
        importedCount: 0,
        error: '歌单数据格式错误'
      };
    }
    
    // 读取音频文件
    const audioDir = zip.folder('audio');
    const audioFiles = new Map<string, Blob>();
    
    if (audioDir) {
      const filePromises: Promise<void>[] = [];
      
      audioDir.forEach((relativePath, file) => {
        if (!file.dir) {
          filePromises.push(
            file.async('blob').then(blob => {
              audioFiles.set(relativePath, blob);
            })
          );
        }
      });
      
      await Promise.all(filePromises);
    }
    
    // 生成新的ID和cacheKey映射，避免冲突
    const cacheKeyMap = new Map<string, string>();
    const uid = () => Math.random().toString(36).slice(2, 10);
    
    // 处理每个歌单
    const importedPlaylists: Playlist[] = [];
    
    for (const playlist of playlistsData) {
      // 生成新的歌单ID
      const newPlaylistId = uid();
      
      // 处理每个track
      const newTracks: Track[] = [];
      
      for (const track of playlist.tracks) {
        const newTrackId = uid();
        let newCacheKey: string | undefined;
        
        // 如果有cacheKey，尝试找到对应的音频文件
        if (track.cacheKey) {
          // 查找音频文件（可能是原始文件名）
          let foundBlob: Blob | undefined;
          let foundFileName: string | undefined;
          
          // 首先尝试使用文件名映射找到正确的文件名
          const mappedFileName = fileNameMap[track.cacheKey];
          if (mappedFileName && audioFiles.has(mappedFileName)) {
            foundBlob = audioFiles.get(mappedFileName);
            foundFileName = mappedFileName;
          } else if (audioFiles.has(track.cacheKey)) {
            // 如果映射不存在，尝试直接使用cacheKey作为文件名
            foundBlob = audioFiles.get(track.cacheKey);
            foundFileName = track.cacheKey;
          } else if (mappedFileName) {
            // 映射存在但audioFiles中没找到，尝试查找（可能路径不同）
            for (const [fileName, blob] of audioFiles.entries()) {
              if (fileName.endsWith(mappedFileName) || fileName.includes(mappedFileName.split('/').pop() || '')) {
                foundBlob = blob;
                foundFileName = fileName;
                break;
              }
            }
          } else {
            // 尝试根据文件名查找（从track的文件名或其他属性）
            // 遍历所有音频文件，尝试匹配
            for (const [fileName, blob] of audioFiles.entries()) {
              // 简单的文件名匹配逻辑
              const trackTitle = track.title?.toLowerCase().replace(/[^a-z0-9]/g, '');
              const fileNameBase = fileName.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\.[^.]+$/, '');
              
              if (trackTitle && fileNameBase && fileNameBase.includes(trackTitle.slice(0, 10))) {
                foundBlob = blob;
                foundFileName = fileName;
                break;
              }
            }
          }
          
          // 如果找到了音频文件，保存到IndexedDB
          if (foundBlob) {
            newCacheKey = `t_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
            
            // 尝试从文件名推断MIME类型
            const ext = foundFileName?.split('.').pop()?.toLowerCase();
            let mimeType = 'audio/mpeg';
            if (ext === 'mp3') mimeType = 'audio/mpeg';
            else if (ext === 'wav') mimeType = 'audio/wav';
            else if (ext === 'ogg') mimeType = 'audio/ogg';
            else if (ext === 'm4a') mimeType = 'audio/mp4';
            else if (ext === 'aac') mimeType = 'audio/aac';
            else if (ext === 'flac') mimeType = 'audio/flac';
            
            // 保存音频文件到IndexedDB
            await idbPut(STORES.TRACKS, {
              id: newCacheKey,
              name: foundFileName || `${newCacheKey}.mp3`,
              type: mimeType,
              blob: foundBlob,
              title: track.title,
              artist: track.artist,
              album: track.album,
              year: track.year,
              coverDataUrl: track.coverDataUrl,
              lyricsText: track.lyricsText
            });
            
            cacheKeyMap.set(track.cacheKey, newCacheKey);
          }
        }
        
        // 创建新的track对象
        const newTrack: Track = {
          ...track,
          id: newTrackId,
          cacheKey: newCacheKey || track.cacheKey // 如果没找到文件，保留原cacheKey（可能会失效）
        };
        
        newTracks.push(newTrack);
      }
      
      // 创建新的歌单对象
      const newPlaylist: Playlist = {
        ...playlist,
        id: newPlaylistId,
        createdAt: Date.now(), // 使用当前时间作为创建时间
        tracks: newTracks
      };
      
      importedPlaylists.push(newPlaylist);
    }
    
    // 保存所有导入的歌单到IndexedDB
    for (const playlist of importedPlaylists) {
      await idbPut(STORES.PLAYLISTS, playlist);
    }
    
    return {
      success: true,
      importedCount: importedPlaylists.length
    };
    
  } catch (error) {
    console.error('[导入] 导入失败:', error);
    return {
      success: false,
      importedCount: 0,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 触发下载ZIP文件
 */
export function downloadZip(blob: Blob, filename: string = 'playlists.zip'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

