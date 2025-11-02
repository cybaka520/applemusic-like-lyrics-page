// 导入 React 与样式
import '@applemusic-like-lyrics/core/style.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { idbDelete, idbGet, idbGetAll, idbPut, idbInit, STORES } from './idb';
import { exportAllPlaylists, exportPlaylist, importPlaylists, downloadZip } from './playlist-io';

type Track = {
  id: string;
  title: string;
  artist?: string;
  duration?: number; // 秒
  fileHandleName?: string;
  cacheKey?: string; // IndexedDB 缓存键
  album?: string;
  year?: number;
  coverDataUrl?: string; // base64 DataURL
  lyricsText?: string;
};

type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  tracks: Track[];
};

function useHashRoute<T extends string>(initial: T) {
  const [route, setRoute] = useState<T>(() => (location.hash.slice(1) as T) || initial);
  useEffect(() => {
    const onHash = () => setRoute((location.hash.slice(1) as T) || initial);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [initial]);
  return [route, (r: T) => (location.hash = `#${r}`)] as const;
}

async function loadPlaylistsIDB(): Promise<Playlist[]> {
  const all = await idbGetAll<Playlist>(STORES.PLAYLISTS);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

const uid = () => Math.random().toString(36).slice(2, 10);

// 简易备份：在 IndexedDB 丢失或权限异常时，从 localStorage 恢复
const BACKUP_KEY = 'amll_playlists_backup_v1';
function backupPlaylistsToLocal(playlists: Playlist[]) {
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(playlists)); } catch {}
}
function readPlaylistsBackup(): Playlist[] | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Playlist[];
  } catch {}
  return null;
}

const MiniPlayer: React.FC<{
  current?: Track | null;
  onPrev: () => void;
  onToggle: () => void;
  onNext: () => void;
  onCoverClick?: () => void;
  onPlaylistClick?: () => void;
  isPlaying?: boolean;
}> = ({ current, onPrev, onToggle, onNext, onCoverClick, onPlaylistClick, isPlaying = false }) => {
  return (
    <div style={{
      position: 'fixed', bottom: 10, left: 10, right: 10, zIndex: 400,
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
      background: 'rgba(255,255,255,0.75)', backdropFilter: 'saturate(150%) blur(10px)',
      borderRadius: 12, padding: '10px 14px', boxShadow: '0 6px 18px rgba(0,0,0,0.15)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#111' }}>
        <div onClick={onCoverClick} title="进入歌词" style={{ width: 40, height: 40, borderRadius: 8, background: '#e5e7eb', cursor: 'pointer', overflow: 'hidden' }}>
          {current?.coverDataUrl && (
            <img src={current.coverDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>{current?.title ?? '未知歌曲'}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{current?.artist ?? '未知创作者'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifySelf: 'center' }}>
        <button onClick={onPrev} title="上一首" style={{ 
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'currentColor'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 134 134" fill="currentColor">
            <path d="M72 60.0717C68.062 62.3453 66.0931 63.4821 65.4323 64.9662C64.8559 66.2608 64.8559 67.7391 65.4323 69.0336C66.0931 70.5177 68.062 71.6545 72 73.9281L93 86.0525C96.938 88.326 98.9069 89.4628 100.523 89.293C101.932 89.1449 103.212 88.4057 104.045 87.2593C105 85.945 105 83.6714 105 79.1243V54.8755C105 50.3284 105 48.0548 104.045 46.7405C103.212 45.5941 101.932 44.8549 100.523 44.7068C98.9069 44.537 96.938 45.6738 93 47.9473L72 60.0717Z" />
            <path d="M72 60.0717C68.062 62.3453 66.0931 63.4821 65.4323 64.9662C64.8559 66.2608 64.8559 67.7391 65.4323 69.0336C66.0931 70.5177 68.062 71.6545 72 73.9281L93 86.0525C96.938 88.326 98.9069 89.4628 100.523 89.293C101.932 89.1449 103.212 88.4057 104.045 87.2593C105 85.945 105 83.6714 105 79.1243V54.8755C105 50.3284 105 48.0548 104.045 46.7405C103.212 45.5941 101.932 44.8549 100.523 44.7068C98.9069 44.537 96.938 45.6738 93 47.9473L72 60.0717Z" />
            <path d="M32 60.0717C28.062 62.3453 26.0931 63.4821 25.4323 64.9662C24.8559 66.2608 24.8559 67.7391 25.4323 69.0336C26.0931 70.5177 28.062 71.6545 32 73.9281L53 86.0525C56.938 88.326 58.9069 89.4628 60.5226 89.293C61.9319 89.1449 63.2122 88.4057 64.0451 87.2593C65 85.945 65 83.6714 65 79.1243V54.8755C65 50.3284 65 48.0548 64.0451 46.7405C63.2122 45.5941 61.9319 44.8549 60.5226 44.7068C58.9069 44.537 56.938 45.6738 53 47.9473L32 60.0717Z" />
          </svg>
        </button>
        <button onClick={onToggle} title="播放/暂停" style={{ 
          width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'currentColor'
        }}>
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38" fill="currentColor">
              <path d="M8.7384,36C6.3594,36 5,34.5857 5,32.4261L5,5.593C5,3.4143 6.3594,2 8.7384,2L12.911,2C15.2711,2 16.6305,3.4143 16.6305,5.593L16.6305,32.4261C16.6305,34.6048 15.2711,36 12.911,36L8.7384,36ZM25.089,36C22.7289,36 21.3695,34.6048 21.3695,32.4261L21.3695,5.593C21.3695,3.4143 22.7289,2 25.089,2L29.2616,2C31.6406,2 33,3.4143 33,5.593L33,32.4261C33,34.5857 31.6406,36 29.2616,36L25.089,36Z" fillRule="nonzero" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38" fill="currentColor">
              <path d="M7.5776,36C5.619,36 4.1567,34.6943 4,32.5008L4,5.4992C4.1567,3.3057 5.619,2 7.5776,2C8.5438,2 9.2227,2.2873 10.3195,2.8618L35.1536,15.5269C36.9293,16.4409 38,17.3287 38,19C38,20.6713 36.9293,21.5591 35.1536,22.4731L10.3195,35.1382C9.2227,35.7127 8.5438,36 7.5776,36Z" fillRule="nonzero" />
            </svg>
          )}
        </button>
        <button onClick={onNext} title="下一首" style={{ 
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'currentColor'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 134 134" fill="currentColor">
            <path d="M62 60.0717C65.938 62.3453 67.9069 63.4821 68.5677 64.9662C69.1441 66.2608 69.1441 67.7391 68.5677 69.0336C67.9069 70.5177 65.938 71.6545 62 73.9281L41 86.0525C37.062 88.326 35.0931 89.4628 33.4774 89.293C32.0681 89.1449 30.7878 88.4057 29.9549 87.2593C29 85.945 29 83.6714 29 79.1243V54.8755C29 50.3284 29 48.0548 29.9549 46.7405C30.7878 45.5941 32.0681 44.8549 33.4774 44.7068C35.0931 44.537 37.062 45.6738 41 47.9473L62 60.0717Z" />
            <path d="M62 60.0717C65.938 62.3453 67.9069 63.4821 68.5677 64.9662C69.1441 66.2608 69.1441 67.7391 68.5677 69.0336C67.9069 70.5177 65.938 71.6545 62 73.9281L41 86.0525C37.062 88.326 35.0931 89.4628 33.4774 89.293C32.0681 89.1449 30.7878 88.4057 29.9549 87.2593C29 85.945 29 83.6714 29 79.1243V54.8755C29 50.3284 29 48.0548 29.9549 46.7405C30.7878 45.5941 32.0681 44.8549 33.4774 44.7068C35.0931 44.537 37.062 45.6738 41 47.9473L62 60.0717Z" />
            <path d="M102 60.0717C105.938 62.3453 107.907 63.4821 108.568 64.9662C109.144 66.2608 109.144 67.7391 108.568 69.0336C107.907 70.5177 105.938 71.6545 102 73.9281L81 86.0525C77.062 88.326 75.0931 89.4628 73.4774 89.293C72.0681 89.1449 70.7878 88.4057 69.9549 87.2593C69 85.945 69 83.6714 69 79.1243V54.8755C69 50.3284 69 48.0548 69.9549 46.7405C70.7878 45.5941 72.0681 44.8549 73.4774 44.7068C75.0931 44.537 77.062 45.6738 81 47.9473L102 60.0717Z" />
          </svg>
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onPlaylistClick} title="播放列表" style={{ 
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0
        }}>
          <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h2v2H3V6zm0 5h2v2H3v-2zm0 5h2v2H3v-2zm4-10h14v2H7V6zm0 5h14v2H7v-2zm0 5h14v2H7v-2z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

const SongDetails: React.FC<{ track: Track; onBack: () => void; onSave: (t: Track) => void }> = ({ track, onBack, onSave }) => {
  const [tab, setTab] = useState<'basic' | 'meta' | 'lyric'>('meta');
  const [draft, setDraft] = useState<Track>(track);
  useEffect(() => setDraft(track), [track]);
  return (
    <div style={{ padding: 20, width: '100%', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack}>← 返回</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => onSave(draft)}>保存</button>
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 16 }}>
        <div style={{ width: 200, height: 200, borderRadius: 12, background: '#e5e7eb', overflow: 'hidden' }}>
          {draft.coverDataUrl && (<img src={draft.coverDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
        </div>
        <div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{draft.title}</div>
          <div style={{ fontSize: 18, color: '#64748b', marginTop: 6 }}>{draft.artist || '未知艺术家'}</div>
        </div>
      </div>
      {/* 标签页 */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid #e5e7eb' }}>
          <button style={{ paddingBottom: 10, borderBottom: tab==='basic' ? '2px solid #1f6feb' : '2px solid transparent', fontWeight: 700 }} onClick={() => setTab('basic')}>基本</button>
          <button style={{ paddingBottom: 10, borderBottom: tab==='meta' ? '2px solid #1f6feb' : '2px solid transparent' }} onClick={() => setTab('meta')}>元数据</button>
          <button style={{ paddingBottom: 10, borderBottom: tab==='lyric' ? '2px solid #1f6feb' : '2px solid transparent' }} onClick={() => setTab('lyric')}>歌词</button>
        </div>
        <div style={{ paddingTop: 16 }}>
          {tab === 'basic' && (
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 12, columnGap: 12 }}>
              <div style={{ color: '#64748b' }}>音乐 ID</div>
              <div>{draft.id}</div>
              <div style={{ color: '#64748b' }}>音乐缓存键</div>
              <div>{draft.cacheKey ?? '—'}</div>
              <div style={{ color: '#64748b' }}>音乐时长</div>
              <div>{draft.duration ? formatTime(draft.duration) : '—'}</div>
            </div>
          )}
          {tab === 'meta' && (
            <div>
              <div style={{ background: '#edf2fe', color: '#334155', padding: '10px 12px', borderRadius: 8, marginBottom: 12 }}>本页面的设置不会写入到原始音乐文件中</div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center' }}>
                <div>音乐名称</div>
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                <div>音乐作者</div>
                <input value={draft.artist ?? ''} onChange={(e) => setDraft({ ...draft, artist: e.target.value })} />
                <div>音乐专辑名</div>
                <input value={draft.album ?? ''} onChange={(e) => setDraft({ ...draft, album: e.target.value })} />
                <div>封面</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 96, height: 96, borderRadius: 8, background: '#e5e7eb', overflow: 'hidden' }}>
                    {draft.coverDataUrl && (<img src={draft.coverDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
                  </div>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () => setDraft({ ...draft, coverDataUrl: reader.result as string });
                      // 图片读取为 DataURL，视频也以封面图 DataURL 存储（这里简单处理）
                      reader.readAsDataURL(f);
                    }} />更换封面图为图片 / 视频
                  </label>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={async () => {
                  if (!draft.cacheKey) return;
                  const rec = await idbGet<any>(STORES.TRACKS, draft.cacheKey);
                  const blob = rec?.blob as Blob | undefined;
                  if (!blob || !(window as any).jsmediatags) return;
                  (window as any).jsmediatags.read(blob, {
                    onSuccess: (tag: any) => {
                      const t = tag?.tags || {};
                      const picture = t.picture;
                      let dataUrl: string | undefined;
                      if (picture && picture.data) {
                        const byteArray = new Uint8Array(picture.data);
                        const binary = Array.from(byteArray).map(ch => String.fromCharCode(ch)).join('');
                        dataUrl = `data:${picture.format};base64,${btoa(binary)}`;
                      }
                      setDraft(prev => ({
                        ...prev,
                        title: t.title || prev.title,
                        artist: t.artist || prev.artist,
                        album: t.album || prev.album,
                        year: t.year ? Number(String(t.year).slice(0,4)) : prev.year,
                        coverDataUrl: dataUrl || prev.coverDataUrl,
                      }));
                    },
                    onError: () => {}
                  });
                }}>重新从文件中读取元数据</button>
                <button onClick={() => onSave(draft)}>保存元数据</button>
              </div>
            </div>
          )}
          {tab === 'lyric' && (
            <div>
              <textarea placeholder="粘贴/编辑歌词文本（支持 TTML 等，将由底层播放器解析）" rows={12} style={{ width: '100%' }} value={draft.lyricsText ?? ''}
                onChange={(e) => setDraft({ ...draft, lyricsText: e.target.value })} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b', flex: 1 }}>保存后可在右侧歌词面板立即查看效果。</div>
                <button onClick={() => onSave(draft)}>保存歌词</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 设置页面：左侧分组导航 + 右侧表单
const SettingsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [state, setState] = useState<any>(() => (window as any).player?.state ?? {});
  useEffect(() => {
    const h = () => setState({ ...(window as any).player?.state });
    window.addEventListener('amll:refresh-settings', h as any);
    return () => window.removeEventListener('amll:refresh-settings', h as any);
  }, []);

  const update = (key: string, value: any) => {
    const player = (window as any).player;
    if (!player) return;
    player.state[key] = value;
    setState({ ...player.state });
    try {
      player.lyricPlayer?.setEnableBlur?.(player.state.enableLyricBlur);
      player.lyricPlayer?.setEnableScale?.(player.state.enableLyricScale);
      player.lyricPlayer?.setEnableSpring?.(player.state.enableLyricSpring);
      player.lyricPlayer?.setHidePassedLines?.(player.state.hidePassedLyrics);
    } catch {}
  };

  const sections = [
    { key: 'general', title: '常规',},
    { key: 'lyrics-content', title: '歌词内容'},
    { key: 'lyrics-style', title: '歌词样式' },
    { key: 'song-style', title: '歌曲信息样式'},
    { key: 'lyrics-bg', title: '歌词背景'},
    { key: 'others', title: '杂项'},
    { key: 'all', title: '全部设置'},
  ];
  const [active, setActive] = useState('general');

  // 将 state 的键进行归类
  const allKeys = Object.keys(state || {});
  const setHas = (k: string) => allKeys.includes(k);

  const lyricsContentKeys = allKeys.filter(k => ['hidePassedLyrics','showTranslation','showRomanization'].includes(k));
  const lyricStyleKeys = allKeys.filter(k => (
    ['enableLyricBlur','enableLyricScale','enableLyricSpring','lineHeight','fontSize','lyricAlign','lyricAlignAnchor','wordFadeWidth'].includes(k) || k.startsWith('emphasize')
  ));
  const songStyleKeys = allKeys.filter(k => (
    k.startsWith('title') || k.startsWith('artist') || k.includes('songTextAlign')
  ));
  const bgKeys = allKeys.filter(k => (k.startsWith('background') || k.startsWith('bg') || k.startsWith('fft') ));
  const otherKeys = allKeys.filter(k => !lyricsContentKeys.includes(k) && !lyricStyleKeys.includes(k) && !songStyleKeys.includes(k) && !bgKeys.includes(k));

  const renderControl = (key: string) => {
    const val = (state as any)[key];
    const onChange = (v: any) => update(key, v);
    // 根据命名推断类型
    if (typeof val === 'boolean' || key.startsWith('enable') || key.startsWith('show') || key.startsWith('hide')) {
      return <input type="checkbox" checked={!!val} onChange={e=>onChange((e.target as HTMLInputElement).checked)} />;
    }
    if (typeof val === 'number' || key.match(/(size|width|height|fps|scale|damping|stiffness|mass|opacity|volume|delay|radius|speed|intensity|renderScale|font)/i)) {
      return <input type="number" value={Number(val)} step={0.01} onChange={e=>onChange(Number((e.target as HTMLInputElement).value))} />;
    }
    return <input type="text" value={String(val ?? '')} onChange={e=>onChange((e.target as HTMLInputElement).value)} />;
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: 280, borderRight: '1px solid #eef2f7', padding: 16 }}>
        <button onClick={onBack} style={{ marginBottom: 12 }}>← 返回</button>
        {sections.map(s => (
          <div key={s.key} onClick={() => setActive(s.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 6,
              background: active === s.key ? '#edf2fe' : 'transparent', fontWeight: active === s.key ? 700 : 500 }}>
            <span>{s.title}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 16 }}>{sections.find(s=>s.key===active)?.title}</div>
        {active === 'general' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>显示语言</div>
              <select defaultValue="zh-CN" style={{ width: 260, height: 36 }}>
                <option value="zh-CN">中文（中国）</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>界面主题</div>
              <select defaultValue="auto" style={{ width: 260, height: 36 }}>
                <option value="auto">自动</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </div>
          </div>
        )}
        {active === 'lyrics-content' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {lyricsContentKeys.length === 0 && <div style={{ color: '#94a3b8' }}>暂无可配置项</div>}
            {lyricsContentKeys.map(k => (
              <label key={k} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', alignItems: 'center', gap: 12 }}>
                <span style={{ color: '#475569' }}>{k}</span>
                {renderControl(k)}
              </label>
            ))}
          </div>
        )}
        {active === 'lyrics-style' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {lyricStyleKeys.length === 0 && <div style={{ color: '#94a3b8' }}>暂无可配置项</div>}
            {lyricStyleKeys.map(k => (
              <label key={k} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', alignItems: 'center', gap: 12 }}>
                <span style={{ color: '#475569' }}>{k}</span>
                {renderControl(k)}
              </label>
            ))}
          </div>
        )}
        {active === 'song-style' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {songStyleKeys.length === 0 && <div style={{ color: '#94a3b8' }}>暂无可配置项</div>}
            {songStyleKeys.map(k => (
              <label key={k} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', alignItems: 'center', gap: 12 }}>
                <span style={{ color: '#475569' }}>{k}</span>
                {renderControl(k)}
              </label>
            ))}
          </div>
        )}
        {active === 'lyrics-bg' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {bgKeys.length === 0 && <div style={{ color: '#94a3b8' }}>暂无可配置项</div>}
            {bgKeys.map(k => (
              <label key={k} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', alignItems: 'center', gap: 12 }}>
                <span style={{ color: '#475569' }}>{k}</span>
                {renderControl(k)}
              </label>
            ))}
          </div>
        )}
        {active === 'all' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {Object.entries(state).map(([key, val]) => (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center', gap: 12 }}>
                <div style={{ color: '#475569' }}>{key}</div>
                {typeof val === 'boolean' ? (
                  <input type="checkbox" checked={!!val} onChange={(e)=>update(key, e.target.checked)} />
                ) : typeof val === 'number' ? (
                  <input type="number" value={Number(val)} step={0.01} onChange={(e)=>update(key, Number(e.target.value))} />
                ) : (
                  <input type="text" value={String(val ?? '')} onChange={(e)=>update(key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        )}
        {active === 'others' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {otherKeys.length === 0 && <div style={{ color: '#94a3b8' }}>暂无可配置项</div>}
            {otherKeys.map(k => (
              <label key={k} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', alignItems: 'center', gap: 12 }}>
                <span style={{ color: '#475569' }}>{k}</span>
                {renderControl(k)}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};



const Home: React.FC<{
  playlists: Playlist[];
  onCreate: (name: string) => void;
  onOpen: (id: string) => void;
  onExportAll?: () => void;
  onImport?: (file: File) => Promise<void>;
}> = ({ playlists, onCreate, onOpen, onExportAll, onImport }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [newName, setNewName] = useState('');
  const [source, setSource] = useState('本地');
  const fileImportRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 顶部工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>AMLL Player Web</div>
        <div style={{ flex: 1 }} />
          <button title="新建播放列表" onClick={() => { setNewName(''); setShowCreate(true); }} style={{ padding: '6px 10px' }}>＋ 新建播放列表</button>
        <div style={{ position: 'relative' }}>
          <button title="更多" onClick={() => setShowMore(v=>!v)} style={{ padding: '6px 10px' }}>≡</button>
          {showMore && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, width: 180, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 12px 30px rgba(0,0,0,0.12)', zIndex: 50 }}
              onClick={(e) => e.stopPropagation()}>
              {onExportAll && (
                <div onClick={() => { setShowMore(false); onExportAll(); }} style={{ padding: '10px 12px', cursor: 'pointer' }}>导出所有歌单</div>
              )}
              {onImport && (
                <div onClick={() => { setShowMore(false); fileImportRef.current?.click(); }} style={{ padding: '10px 12px', cursor: 'pointer' }}>导入歌单</div>
              )}
              <div style={{ height: 1, background: '#f1f5f9' }} />
              <div onClick={() => { setShowMore(false); location.hash = '#settings'; }} style={{ padding: '10px 12px', cursor: 'pointer' }}>设置</div>
            </div>
          )}
        </div>
        <input ref={fileImportRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file && onImport) {
            await onImport(file);
          }
          e.target.value = '';
        }} />
      </div>

      {/* 列表 */}
      <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {playlists.map(p => {
            const covers = p.tracks.filter(t => !!t.coverDataUrl).slice(0, 4).map(t => t.coverDataUrl!) as string[];
            const subtitle = p.tracks.length > 0 ? `${p.tracks.length} 首歌曲 - 创建于 ${new Date(p.createdAt).toLocaleDateString()}` : `0 首歌曲 - 创建于 ${new Date(p.createdAt).toLocaleDateString()}`;
            return (
              <div key={p.id} onClick={() => onOpen(p.id)} style={{
                cursor: 'pointer', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14,
                display: 'flex', gap: 12, alignItems: 'center', background: '#fff'
              }}>
                <div style={{ width: 56, height: 56, borderRadius: 8, background: '#e5e7eb', overflow: 'hidden', display: covers.length === 1 ? 'block' : 'grid', gridTemplateColumns: covers.length === 1 ? undefined : '1fr 1fr', gridTemplateRows: covers.length === 1 ? undefined : '1fr 1fr' }}>
                  {covers.length === 1 ? (
                    <img src={covers[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{ background: '#eef2f7', width: '100%', height: '100%' }}>
                        {covers[i] && (<img src={covers[i]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 新建歌单弹窗 */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)' }}>
          <div style={{ width: 560, maxWidth: '90vw', background: '#fff', borderRadius: 16, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #eef2f7', fontWeight: 800, fontSize: 20 }}>新建歌单</div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 10, color: '#334155', fontWeight: 600 }}>歌单名称</div>
              <input placeholder="歌单名称" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: '90%', height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 12px' }} />
              <div style={{ height: 10 }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button onClick={() => setShowCreate(false)}>取消</button>
                <button onClick={() => { const v = newName.trim(); if (v) { onCreate(v); setShowCreate(false); } }} disabled={!newName.trim()}>确认</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 点击任意处关闭更多菜单 */}
      {showMore && <div onClick={() => setShowMore(false)} style={{ position: 'fixed', inset: 0 }} />}
    </div>
  );
};

const PlaylistView: React.FC<{
  playlist: Playlist;
  onBack: () => void;
  onAddLocal: () => void;
  onPlayAll: () => void;
  onPlayTrack: (t: Track) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onRemoveTrack: (id: string) => void;
  onOpenLyrics: () => void;
  fullWidth?: boolean;
  onEditTrack: (t: Track) => void;
  onOpenSong: (t: Track) => void;
  onExport?: () => void;
}> = ({ playlist, onBack, onAddLocal, onPlayAll, onPlayTrack, onRename, onDelete, onRemoveTrack, onOpenLyrics, fullWidth, onEditTrack, onOpenSong, onExport }) => {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);
  return (
    <div style={{ padding: 20, width: '100%', height: '100%', boxSizing: 'border-box' }}>
      <button onClick={onBack}>← 返回</button>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 16 }}>
        <div style={{ width: 220, height: 220, borderRadius: 12, background: '#e5e7eb', overflow: 'hidden', display: 'grid' }}>
          {(() => {
            const covers = playlist.tracks.filter(t => !!t.coverDataUrl).slice(0, 4).map(t => t.coverDataUrl!) as string[];
            if (covers.length === 1) {
              return <img src={covers[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            }
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', width: '100%', height: '100%' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ background: '#eef2f7' }}>
                    {covers[i] && (<img src={covers[i]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
        <div>
          <h2 style={{ margin: '4px 0' }}>{playlist.name}</h2>
          <div style={{ color: '#6b7280', marginBottom: 12 }}>{playlist.tracks.length} 首歌曲</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onPlayAll}>▶ 播放全部</button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('amll:shuffle'))}>随机播放</button>
            <button onClick={onAddLocal}>＋ 添加本地歌曲</button>
            <button onClick={() => { const v = prompt('重命名歌单', playlist.name)?.trim(); if (v) onRename(v); }}>重命名</button>
            {onExport && <button onClick={onExport}>导出歌单</button>}
            <button onClick={onDelete}>删除歌单</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, borderTop: '1px solid #e5e7eb' }} />
      <div style={{ maxWidth: fullWidth ? '1200px' : 'auto' }}>
      {playlist.tracks.map(t => (
        <div key={t.id} style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr 80px 120px', gap: 12,
          padding: '12px 4px', alignItems: 'center', borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{ width: 64, height: 64, borderRadius: 10, background: '#eef2f7', overflow: 'hidden' }}>
            {t.coverDataUrl && (<img src={t.coverDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
          </div>
          <div onClick={() => onOpenSong(t)} style={{ cursor: 'pointer' }}>
            <div style={{ fontWeight: 600 }}>{t.title}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{t.artist ?? ''}</div>
          </div>
          <div style={{ textAlign: 'right', color: '#475569' }}>{t.duration ? formatTime(t.duration) : ''}</div>
          <div style={{ textAlign: 'right' }}>
            <button onClick={(e) => { e.stopPropagation(); onPlayTrack(t); }} title="播放">▶</button>
            <button onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ id: t.id, x: r.right - 180, y: r.bottom + 6 }); }} title="更多" style={{ marginLeft: 6 }}>≡</button>
          </div>
        </div>
      ))}
      </div>

      {menu && (() => {
        const t = playlist.tracks.find(x => x.id === menu.id);
        if (!t) return null;
        return (
          <div style={{ position: 'fixed', left: menu.x, top: menu.y, width: 180, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.15)', zIndex: 1000 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => { onPlayTrack(t); setMenu(null); }}>播放音乐</div>
            <div style={{ height: 1, background: '#f1f5f9' }} />
            <div style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => { onEditTrack(t); setMenu(null); }}>编辑歌曲覆盖信息</div>
            <div style={{ height: 1, background: '#f1f5f9' }} />
            <div style={{ padding: '10px 12px', color: '#dc2626', cursor: 'pointer' }} onClick={() => { onRemoveTrack(t.id); setMenu(null); }}>从歌单中删除</div>
          </div>
        );
      })()}
    </div>
  );
};

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const PlaylistSidebar: React.FC<{
  playlist: Playlist | null;
  current?: Track | null;
  currentIndex: number;
  onClose: () => void;
  onPlayTrack: (t: Track) => void;
}> = ({ playlist, current, currentIndex, onClose, onPlayTrack }) => {
  if (!playlist || playlist.tracks.length === 0) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 440 }} />
        <div style={{
          position: 'fixed', right: 10, bottom: 80, width: 360, maxHeight: 'calc(100vh - 120px)', zIndex: 450,
          background: '#374151', color: '#fff', display: 'flex', flexDirection: 'column',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>当前播放列表</div>
            <button onClick={onClose} style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', padding: 0
            }} title="关闭">
              <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: '#9ca3af' }}>
            暂无播放列表
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 440 }} />
      <div style={{
        position: 'fixed', right: 10, bottom: 80, width: 360, maxHeight: 'calc(100vh - 120px)', zIndex: 450,
        background: '#374151', color: '#fff', display: 'flex', flexDirection: 'column',
        borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>当前播放列表</div>
          <button onClick={onClose} style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', padding: 0
          }} title="关闭">
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0', minHeight: 0 }}>
          {playlist.tracks.map((track, idx) => {
            const isCurrent = current && current.id === track.id;
            return (
              <div
                key={track.id}
                onClick={() => onPlayTrack(track)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', cursor: 'pointer',
                  background: isCurrent ? 'rgba(255,255,255,0.1)' : 'transparent'
                }}
                onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 6, background: '#4b5563', overflow: 'hidden', flexShrink: 0 }}>
                  {track.coverDataUrl ? (
                    <img src={track.coverDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: isCurrent ? 600 : 500, fontSize: 14, color: isCurrent ? '#fff' : '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {track.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {track.artist ?? ''}
                  </div>
                </div>
                {isCurrent && (
                  <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.22 8.68a1.5 1.5 0 0 1 0 2.63l-10 5.5A1.5 1.5 0 0 1 5 15.5v-11A1.5 1.5 0 0 1 7.22 3.2l10 5.5Z" fill="currentColor"></path>
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

const DetailsModal: React.FC<{
  track: Track | null;
  onClose: () => void;
  onSave: (t: Track) => void;
}> = ({ track, onClose, onSave }) => {
  const [tab, setTab] = useState<'basic' | 'meta' | 'lyric'>('basic');
  const [draft, setDraft] = useState<Track | null>(track);
  useEffect(() => setDraft(track), [track]);
  if (!draft) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 720, maxWidth: '90vw', background: '#fff', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
          <strong>编辑歌曲</strong>
          <div style={{ flex: 1 }} />
          <button onClick={onClose}>关闭</button>
        </div>
        <div style={{ padding: '0 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12 }}>
          <button onClick={() => setTab('basic')}>基本</button>
          <button onClick={() => setTab('meta')}>元数据</button>
          <button onClick={() => setTab('lyric')}>歌词</button>
        </div>
        <div style={{ padding: 16 }}>
          {tab === 'basic' && (
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center' }}>
              <div>歌曲名称</div>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <div>作者</div>
              <input value={draft.artist ?? ''} onChange={(e) => setDraft({ ...draft, artist: e.target.value })} />
            </div>
          )}
          {tab === 'meta' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center' }}>
                <div>专辑</div>
                <input value={draft.album ?? ''} onChange={(e) => setDraft({ ...draft, album: e.target.value })} />
                <div>年份</div>
                <input type="number" value={draft.year ?? ''} onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) || undefined })} />
                <div>封面</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 96, height: 96, borderRadius: 8, background: '#e5e7eb', overflow: 'hidden' }}>
                    {draft.coverDataUrl && (<img src={draft.coverDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)}
                  </div>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () => setDraft({ ...draft, coverDataUrl: reader.result as string });
                      reader.readAsDataURL(f);
                    }} />更换封面
                  </label>
                  <button onClick={async () => {
                    if (!draft.cacheKey) return;
                    const rec = await idbGet<any>(STORES.TRACKS, draft.cacheKey);
                    const blob = rec?.blob as Blob | undefined;
                    if (!blob || !(window as any).jsmediatags) return;
                    (window as any).jsmediatags.read(blob, {
                      onSuccess: (tag: any) => {
                        const t = tag?.tags || {};
                        const picture = t.picture;
                        let dataUrl: string | undefined;
                        if (picture && picture.data) {
                          const byteArray = new Uint8Array(picture.data);
                          const binary = Array.from(byteArray).map(ch => String.fromCharCode(ch)).join('');
                          dataUrl = `data:${picture.format};base64,${btoa(binary)}`;
                        }
                        setDraft({
                          ...draft,
                          title: t.title || draft.title,
                          artist: t.artist || draft.artist,
                          album: t.album || draft.album,
                          year: t.year ? Number(String(t.year).slice(0,4)) : draft.year,
                          coverDataUrl: dataUrl || draft.coverDataUrl,
                        });
                      },
                      onError: () => {}
                    });
                  }}>从文件读取元数据</button>
                </div>
              </div>
            </div>
          )}
          {tab === 'lyric' && (
            <div>
              <textarea placeholder="粘贴/编辑歌词文本（支持 TTML 等，将由底层播放器解析）" rows={12} style={{ width: '100%' }} value={(draft as any).lyricsText ?? ''}
                onChange={(e) => setDraft({ ...draft, lyricsText: e.target.value } as Track)} />
              <div style={{ fontSize: 12, color: '#64748b' }}>保存后可在右侧歌词面板立即查看效果。</div>
            </div>
          )}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}>取消</button>
          <button onClick={() => { if (draft) onSave(draft); }}>保存</button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [route, nav] = useHashRoute<'home' | `pl:${string}` | `song:${string}` | 'settings'>('home');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [current, setCurrent] = useState<Track | null>(null);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [details, setDetails] = useState<Track | null>(null);
  const [showLyrics, setShowLyrics] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showPlaylist, setShowPlaylist] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const controlHandlersRef = useRef<{ prev: () => void; next: () => void; toggle: () => void } | null>(null);
  useEffect(() => {
    document.body.classList.toggle('lyrics-open', showLyrics);
    // 当打开歌词页时，如果有当前曲目且该曲目有歌词，主动加载歌词
    if (showLyrics && current && (current as any).lyricsText) {
      try {
        window.dispatchEvent(new CustomEvent('amll:set-lyrics-text', { detail: { text: (current as any).lyricsText } }));
      } catch {}
    }
  }, [showLyrics, current]);
  useEffect(() => {
    const open = () => setShowSettings(true);
    const exitLyrics = () => setShowLyrics(false);
    const onToggle = () => controlHandlersRef.current?.toggle();
    const onPrev = () => controlHandlersRef.current?.prev();
    const onNext = () => controlHandlersRef.current?.next();
    window.addEventListener('amll:open-settings', open as any);
    window.addEventListener('amll:exit-lyrics', exitLyrics as any);
    window.addEventListener('amll:toggle-play', onToggle as any);
    window.addEventListener('amll:prev-song', onPrev as any);
    window.addEventListener('amll:next-song', onNext as any);
    return () => {
      window.removeEventListener('amll:open-settings', open as any);
      window.removeEventListener('amll:exit-lyrics', exitLyrics as any);
      window.removeEventListener('amll:toggle-play', onToggle as any);
      window.removeEventListener('amll:prev-song', onPrev as any);
      window.removeEventListener('amll:next-song', onNext as any);
    };
  }, []);
  
  // 监听播放状态变化
  useEffect(() => {
    const updatePlayingState = () => {
      const player = (window as any).player;
      if (player?.audio) {
        setIsPlaying(!player.audio.paused);
      }
    };
    
    // 初始状态
    updatePlayingState();
    
    // 监听播放状态变化
    const audio = (window as any).player?.audio;
    if (audio) {
      const onPlay = () => setIsPlaying(true);
      const onPause = () => setIsPlaying(false);
      audio.addEventListener('play', onPlay);
      audio.addEventListener('pause', onPause);
      
      // 定期检查（作为后备方案）
      const interval = setInterval(updatePlayingState, 500);
      
      return () => {
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        clearInterval(interval);
      };
    }
    
    // 如果音频元素还不存在，定期检查
    const checkInterval = setInterval(() => {
      const player = (window as any).player;
      if (player?.audio) {
        updatePlayingState();
        clearInterval(checkInterval);
      }
    }, 500);
    
    return () => clearInterval(checkInterval);
  }, [current]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 启动底层播放器（main.ts）
  useEffect(() => {
  (window as any).__USE_REACT_LYRICS__ = false;
  import('./main').then(() => {
      // 确保歌词层样式
      const container = document.getElementById('lyricsPanel');
      if (container) {
        container.style.position = 'relative';
        container.style.zIndex = '100';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.overflow = 'visible';
      }
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await idbInit();
        console.log('[App] IndexedDB initialized');
        const all = await loadPlaylistsIDB();
        console.log('[App] Loaded playlists from IDB:', all.length);
        if (all.length > 0) {
        // 启动时用 TRACKS 缓存对歌单内的每首歌做一次“元数据回填”
        const rehydrated: Playlist[] = [];
        for (const pl of all) {
          const nextTracks: Track[] = [];
          for (const tr of pl.tracks) {
            if (tr.cacheKey) {
              try {
                const rec: any = await idbGet(STORES.TRACKS, tr.cacheKey);
                if (rec) {
                  const merged: Track = {
                    ...tr,
                    title: rec.title || tr.title,
                    artist: rec.artist || tr.artist,
                    album: rec.album || tr.album,
                    year: rec.year || tr.year,
                    coverDataUrl: rec.coverDataUrl || tr.coverDataUrl,
                    lyricsText: rec.lyricsText || tr.lyricsText,
                  };
                  nextTracks.push(merged);
                  continue;
                }
              } catch {}
            }
            nextTracks.push(tr);
          }
          rehydrated.push({ ...pl, tracks: nextTracks });
        }
        setPlaylists(rehydrated);
        backupPlaylistsToLocal(all);
        // 将歌单中的元数据反写入 TRACKS，确保刷新后可从 TRACKS 直接命中
        try {
          for (const pl of rehydrated) {
            for (const tr of pl.tracks) {
              if (!tr.cacheKey) continue;
              const existing: any = await idbGet(STORES.TRACKS, tr.cacheKey);
              const writeObj: any = {
                id: tr.cacheKey,
                name: existing?.name,
                type: existing?.type,
                blob: existing?.blob,
                title: tr.title,
                artist: tr.artist,
                album: tr.album,
                year: tr.year,
                coverDataUrl: tr.coverDataUrl,
                lyricsText: (tr as any).lyricsText,
              };
              // 避免覆盖缺失 blob 的记录：若没有 blob 则仅写元数据也可
              await idbPut(STORES.TRACKS, writeObj);
            }
          }
        } catch {}
        return;
      }
      console.log('[App] No playlists in IDB, checking backup');
      const backup = readPlaylistsBackup();
      if (backup && backup.length > 0) {
        console.log('[App] Restoring from backup:', backup.length, 'playlists');
        // 写回 IndexedDB 并使用备份数据
        for (const pl of backup) { 
          try { 
            await idbPut(STORES.PLAYLISTS, pl); 
            console.log('[App] Restored playlist:', pl.name);
          } catch (e) {
            console.error('[App] Failed to restore playlist:', pl.name, e);
          }
        }
        setPlaylists(backup);
      } else {
        console.log('[App] No backup found, starting with empty playlists');
        setPlaylists([]);
      }
    } catch (error) {
      console.error('[App] Failed to initialize IndexedDB or load playlists:', error);
      // 尝试从备份恢复
      const backup = readPlaylistsBackup();
      if (backup && backup.length > 0) {
        console.log('[App] Error occurred, trying backup recovery');
        setPlaylists(backup);
      } else {
        setPlaylists([]);
      }
    }
    })();
  }, []);

  const persistPlaylist = async (p: Playlist) => {
    await idbPut(STORES.PLAYLISTS, p);
    const next = await loadPlaylistsIDB();
    setPlaylists(next);
    backupPlaylistsToLocal(next);
  };

  const deletePlaylist = async (id: string) => {
    await idbDelete(STORES.PLAYLISTS, id);
    const next = await loadPlaylistsIDB();
    setPlaylists(next);
    backupPlaylistsToLocal(next);
    nav('home');
  };

  const openPlaylist = (id: string) => nav(`pl:${id}`);

  const createPlaylist = async (name: string) => {
    const pl: Playlist = { id: uid(), name, createdAt: Date.now(), tracks: [] };
    await persistPlaylist(pl);
  };

  const addLocalTo = (plId: string) => {
    fileInputRef.current?.click();
    const handler = (ev: Event) => {
      const input = ev.target as HTMLInputElement;
      const f = input.files?.[0];
      input.value = '';
      if (!f) return;
      const title = f.name.replace(/\.[^.]+$/, '');
      const cacheKey = `t_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      const track: Track = { id: uid(), title, cacheKey };
      // 把音频保存到 IndexedDB
      idbPut(STORES.TRACKS, { id: cacheKey, name: f.name, type: f.type, blob: f }).catch((error) => {
        console.error('[IDB] 保存音乐文件失败:', cacheKey, error);
      });
      // 解析封面/元数据（异步，不阻塞添加）
      (async () => {
        try {
          const jsmt: any = (window as any).jsmediatags;
          if (jsmt) {
            await new Promise<void>((resolve) => {
              jsmt.read(f, {
                onSuccess: (tag: any) => {
                  const t = tag?.tags || {};
                  let coverUrl: string | undefined;
                  const picture = t.picture;
                  if (picture && picture.data) {
                    const byteArray = new Uint8Array(picture.data);
                    const binary = Array.from(byteArray).map((ch) => String.fromCharCode(ch)).join('');
                    coverUrl = `data:${picture.format};base64,${btoa(binary)}`;
                  }
                  const updated: Track = { ...track, title: t.title || track.title, artist: t.artist || track.artist, album: t.album || track.album, year: t.year ? Number(String(t.year).slice(0,4)) : track.year, coverDataUrl: coverUrl || track.coverDataUrl };
              // 将解析到的元数据写回 IndexedDB 轨道缓存，便于后续直接命中
              idbPut(STORES.TRACKS, {
                id: cacheKey,
                name: f.name,
                type: f.type,
                blob: f,
                title: updated.title,
                artist: updated.artist,
                album: updated.album,
                year: updated.year,
                coverDataUrl: updated.coverDataUrl
              }).catch((error) => {
                console.error('[IDB] 更新音乐元数据失败:', error);
              });
                  // 写回歌单
                  setPlaylists(prev => {
                    const next = prev.map(p => p.id === plId ? { ...p, tracks: [...p.tracks.filter(x => x.id !== track.id), updated] } : p);
                    return next;
                  });
                  persistPlaylist({ ...(playlists.find(p=>p.id===plId) as Playlist), tracks: [...(playlists.find(p=>p.id===plId)?.tracks || []).filter(x=>x.id!==track.id), updated] });
                  resolve();
                },
                onError: () => resolve(),
              });
            });
          }
        } catch {}
      })();
      const target = playlists.find(p => p.id === plId);
      if (target) persistPlaylist({ ...target, tracks: [...target.tracks, track] });
      // 直接用缓存播放
      (async () => {
        const audio = (window as any).player?.audio as HTMLAudioElement | undefined;
        if (audio) {
          // 释放旧的 Object URL
          if (audio.src && audio.src.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(audio.src);
            } catch {}
          }
          
          const url = URL.createObjectURL(f);
          
          // 等待音频加载完成后再播放
          const playWhenReady = () => {
            audio.removeEventListener('canplay', playWhenReady);
            audio.removeEventListener('canplaythrough', playWhenReady);
            audio.removeEventListener('error', handleError);
            audio.play().catch((err: any) => {
              console.warn('[播放失败]', err.name, err.message);
              if (err.name === 'NotAllowedError') {
                console.info('[提示] 浏览器阻止了自动播放，请手动点击播放按钮');
              }
            });
          };
          
          const handleError = (e: Event) => {
            audio.removeEventListener('canplay', playWhenReady);
            audio.removeEventListener('canplaythrough', playWhenReady);
            audio.removeEventListener('error', handleError);
            console.error('[音频加载失败]', e);
            try {
              URL.revokeObjectURL(url);
            } catch {}
          };
          
          audio.addEventListener('canplay', playWhenReady, { once: true });
          audio.addEventListener('canplaythrough', playWhenReady, { once: true });
          audio.addEventListener('error', handleError, { once: true });
          
          audio.src = url;
          audio.load();
          
          // 延迟检查 readyState，如果音频已经快速加载完成，立即播放
          // 注意：设置新 src 后 readyState 会重置，但 Blob URL 可能加载很快
          setTimeout(() => {
            if (audio.readyState >= 3) { // HAVE_FUTURE_DATA
              playWhenReady();
            }
          }, 10);
        }
        setCurrent(track);
      })();
      setCurrentPlaylistId(plId);
      setCurrentIndex(target ? target.tracks.length : 0);
    };
    fileInputRef.current?.addEventListener('change', handler, { once: true });
  };

  const playAll = (pl: Playlist) => {
    if (pl.tracks.length === 0) return;
    setCurrent(pl.tracks[0]);
    setCurrentPlaylistId(pl.id);
    setCurrentIndex(0);
    try { window.dispatchEvent(new CustomEvent('amll:track-change', { detail: { track: pl.tracks[0] } })); } catch {}
    // 这里只触发播放按钮，如未选择音乐会引导选择
    const audio = (window as any).player?.audio as HTMLAudioElement | undefined;
    audio?.play?.();
  };

  const playTrack = (t: Track) => {
    setCurrent(t);
    setCurrentPlaylistId(currentPlaylist?.id ?? null);
    setCurrentIndex(currentPlaylist?.tracks.findIndex(x => x.id === t.id) ?? -1);
    try { window.dispatchEvent(new CustomEvent('amll:track-change', { detail: { track: t } })); } catch {}
    const audio = (window as any).player?.audio as HTMLAudioElement | undefined;
    if (!audio) return;
    (async () => {
      // 释放旧的 Object URL，避免内存泄漏
      if (audio.src && audio.src.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(audio.src);
        } catch {}
      }
      
      if (t.cacheKey) {
        try {
          const rec = await idbGet<any>(STORES.TRACKS, t.cacheKey);
          if (!rec) {
            console.warn('[播放失败] 未找到缓存记录:', t.cacheKey);
            return;
          }
          if (rec?.blob) {
            if (!(rec.blob instanceof Blob)) {
              console.error('[播放失败] 缓存中的 blob 类型错误');
              return;
            }
            const url = URL.createObjectURL(rec.blob);
          
          // 等待音频加载完成后再播放
          const playWhenReady = () => {
            audio.removeEventListener('canplay', playWhenReady);
            audio.removeEventListener('canplaythrough', playWhenReady);
            audio.removeEventListener('error', handleError);
            audio.play().catch((err: any) => {
              console.warn('[播放失败]', err.name, err.message);
              // 如果是自动播放被阻止，提示用户点击播放按钮
              if (err.name === 'NotAllowedError') {
                console.info('[提示] 浏览器阻止了自动播放，请手动点击播放按钮');
              }
            });
          };
          
          const handleError = (e: Event) => {
            audio.removeEventListener('canplay', playWhenReady);
            audio.removeEventListener('canplaythrough', playWhenReady);
            audio.removeEventListener('error', handleError);
            console.error('[音频加载失败]', e);
            // 释放无效的 URL
            try {
              URL.revokeObjectURL(url);
            } catch {}
          };
          
          audio.addEventListener('canplay', playWhenReady, { once: true });
          audio.addEventListener('canplaythrough', playWhenReady, { once: true });
          audio.addEventListener('error', handleError, { once: true });
          
          audio.src = url;
          audio.load();
          
          // 延迟检查 readyState，如果音频已经快速加载完成，立即播放
          // 注意：设置新 src 后 readyState 会重置，但 Blob URL 可能加载很快
          setTimeout(() => {
            if (audio.readyState >= 3) { // HAVE_FUTURE_DATA
              playWhenReady();
            }
          }, 10);
          
          // 如果缓存里已有已解析元数据/封面/歌词，先行合并并广播，避免等待再次解析
          try {
            const cachedTitle = (rec as any).title as string | undefined;
            const cachedArtist = (rec as any).artist as string | undefined;
            const cachedAlbum = (rec as any).album as string | undefined;
            const cachedYear = (rec as any).year as number | undefined;
            const cachedCover = (rec as any).coverDataUrl as string | undefined;
            const cachedLyrics = (rec as any).lyricsText as string | undefined;
            if (cachedTitle || cachedArtist || cachedAlbum || cachedYear || cachedCover) {
              const merged: Track = {
                ...t,
                title: cachedTitle || t.title,
                artist: cachedArtist || t.artist,
                album: cachedAlbum || t.album,
                year: cachedYear || t.year,
                coverDataUrl: cachedCover || t.coverDataUrl,
              };
              setPlaylists(prev => prev.map(pl => ({ ...pl, tracks: pl.tracks.map(x => x.id === t.id ? merged : x) })));
              if (currentPlaylist) persistPlaylist({ ...currentPlaylist, tracks: currentPlaylist.tracks.map(x => x.id === t.id ? merged : x) });
              setCurrent(c => c && c.id === merged.id ? merged : c);
              try { window.dispatchEvent(new CustomEvent('amll:track-change', { detail: { track: merged } })); } catch {}
              if (cachedLyrics) {
                try { window.dispatchEvent(new CustomEvent('amll:set-lyrics-text', { detail: { text: cachedLyrics } })); } catch {}
              }
            }
          } catch {}
          
          // 同步歌词（若 track 带有 lyricsText）
          if ((t as any).lyricsText) {
            try { window.dispatchEvent(new CustomEvent('amll:set-lyrics-text', { detail: { text: (t as any).lyricsText } })); } catch {}
          }
          // 懒加载封面：若无封面则从缓存解析一次后写回歌单
          if (!t.coverDataUrl && (window as any).jsmediatags) {
            const jsmt: any = (window as any).jsmediatags;
            jsmt.read(rec.blob, {
              onSuccess: (tag: any) => {
                const picture = tag?.tags?.picture;
                if (picture && picture.data) {
                  const byteArray = new Uint8Array(picture.data);
                  const binary = Array.from(byteArray).map((ch: number) => String.fromCharCode(ch)).join('');
                  const coverUrl = `data:${picture.format};base64,${btoa(binary)}`;
                  const updated: Track = { ...t, title: tag.tags.title || t.title, artist: tag.tags.artist || t.artist, album: tag.tags.album || t.album, year: tag.tags.year ? Number(String(tag.tags.year).slice(0,4)) : t.year, coverDataUrl: coverUrl };
                  // 写回缓存，带上封面，方便下次直接读取
                  try {
                    const writeObj = { ...rec, coverDataUrl: coverUrl, title: updated.title, artist: updated.artist, album: updated.album, year: updated.year, lyricsText: (t as any).lyricsText };
                    idbPut(STORES.TRACKS, writeObj).catch(()=>{});
                  } catch {}
                  // 更新当前歌单/全局列表
                  setPlaylists(prev => prev.map(pl => ({ ...pl, tracks: pl.tracks.map(x => x.id === t.id ? updated : x) })));
                  if (currentPlaylist) persistPlaylist({ ...currentPlaylist, tracks: currentPlaylist.tracks.map(x => x.id === t.id ? updated : x) });
                  // 如果正在播放该曲目，更新迷你播放器封面
                  setCurrent(c => c && c.id === updated.id ? updated : c);
                  try { window.dispatchEvent(new CustomEvent('amll:track-change', { detail: { track: updated } })); } catch {}
                }
              }, onError: () => {}
            });
          }
          } else {
            console.warn('[播放失败] 缓存记录中没有 blob:', t.cacheKey, Object.keys(rec || {}));
          }
          return;
        } catch (error) {
          console.error('[播放失败] 读取缓存时出错:', error);
          return;
        }
      }
      // 兜底：如果没有缓存，仅尝试播放当前src
      try { 
        await audio.play(); 
      } catch (err: any) {
        console.warn('[播放失败]', err.name, err.message);
      }
    })();
  };

  const currentPlaylist = useMemo(() => {
    if (!route.startsWith('pl:')) return null;
    const id = route.slice(3);
    return playlists.find(p => p.id === id) || null;
  }, [route, playlists]);

  const playingPlaylist = useMemo(() => {
    if (!currentPlaylistId) return null;
    return playlists.find(p => p.id === currentPlaylistId) || null;
  }, [currentPlaylistId, playlists]);

  const currentSong = useMemo(() => {
    if (!route.startsWith('song:')) return null;
    const id = route.slice(5);
    const inPl = currentPlaylist ? currentPlaylist.tracks.find(t => t.id === id) : undefined;
    return inPl || playlists.flatMap(p => p.tracks).find(t => t.id === id) || null;
  }, [route, playlists, currentPlaylist]);

  const nextIndex = () => {
    if (!currentPlaylist) return -1;
    if (shuffle) return Math.floor(Math.random() * currentPlaylist.tracks.length);
    return currentIndex + 1 < currentPlaylist.tracks.length ? currentIndex + 1 : 0;
  };
  const prevIndex = () => {
    if (!currentPlaylist) return -1;
    return currentIndex - 1 >= 0 ? currentIndex - 1 : currentPlaylist.tracks.length - 1;
  };
  const goPlayIndex = (idx: number) => {
    if (!currentPlaylist || idx < 0) return;
    const t = currentPlaylist.tracks[idx];
    if (t) {
      setCurrentIndex(idx);
      playTrack(t);
    }
  };

  const audioCtl = {
    prev: () => goPlayIndex(prevIndex()),
    toggle: () => {
      const a = (window as any).player?.audio as HTMLAudioElement | undefined;
      if (!a) return;
      // 如果没有加载过音频且有当前选中曲目，则先加载当前曲目
      if ((!a.src || a.src === '') && current) {
        playTrack(current);
        return;
      }
      a.paused ? a.play() : a.pause();
    },
    next: () => goPlayIndex(nextIndex())
  };

  // 始终保留可用的最新控制处理器，给全局事件使用
  controlHandlersRef.current = { prev: audioCtl.prev, next: audioCtl.next, toggle: audioCtl.toggle };

  return (
    <div style={{ display: 'flex', flex: 1, width: '100vw', height: '100vh', background: '#f8fafc', color: '#0f172a', position: 'relative' }}>
      {route === 'home' ? (
        // 首页：占满全宽
        <div style={{ flex: 1, minWidth: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Home 
            playlists={playlists} 
            onCreate={createPlaylist} 
            onOpen={openPlaylist}
            onExportAll={async () => {
              try {
                const blob = await exportAllPlaylists();
                downloadZip(blob, `playlists_${new Date().toISOString().slice(0,10)}.zip`);
                alert('导出成功！');
              } catch (error) {
                console.error('[导出] 失败:', error);
                alert('导出失败: ' + (error instanceof Error ? error.message : '未知错误'));
              }
            }}
            onImport={async (file: File) => {
              try {
                const result = await importPlaylists(file);
                if (result.success) {
                  // 重新加载歌单
                  const all = await loadPlaylistsIDB();
                  setPlaylists(all);
                  backupPlaylistsToLocal(all);
                  alert(`成功导入 ${result.importedCount} 个歌单！`);
                } else {
                  alert('导入失败: ' + (result.error || '未知错误'));
                }
              } catch (error) {
                console.error('[导入] 失败:', error);
                alert('导入失败: ' + (error instanceof Error ? error.message : '未知错误'));
              }
            }}
          />
          
        </div>
      ) : route === 'settings' ? (
        <div style={{ flex: 1, minWidth: 0, width: '100%', height: '100%', background: '#fff' }}>
          <SettingsPage onBack={() => nav('home')} />
        </div>
      ) : (
        // 歌单详情或歌曲详情：默认占满全宽；进入歌词时再隐藏 UI
        <div style={{ flex: 1, minWidth: 0, width: '100%', height: '100%', background: '#fff' }}>
          {route.startsWith('song:') && currentSong && (
            <SongDetails track={currentSong} onBack={() => nav(currentPlaylist ? `pl:${currentPlaylist.id}` : 'home')} onSave={async (t) => {
              // 更新曲目并持久化
              setPlaylists(prev => prev.map(pl => ({ ...pl, tracks: pl.tracks.map(x => x.id === t.id ? t : x) })));
              if (currentPlaylist) persistPlaylist({ ...currentPlaylist, tracks: currentPlaylist.tracks.map(x => x.id === t.id ? t : x) });
              setCurrent(c => c && c.id === t.id ? t : c);
              // 同步更新到 TRACKS 缓存
              if (t.cacheKey) {
                try {
                  const existing: any = await idbGet(STORES.TRACKS, t.cacheKey);
                  if (existing) {
                    await idbPut(STORES.TRACKS, {
                      ...existing,
                      title: t.title,
                      artist: t.artist,
                      album: t.album,
                      year: t.year,
                      coverDataUrl: t.coverDataUrl,
                      lyricsText: (t as any).lyricsText,
                    });
                  }
                } catch {}
              }
              // 如果正在播放该曲目，立即更新歌词
              if (t.id === current?.id && (t as any).lyricsText) {
                try {
                  window.dispatchEvent(new CustomEvent('amll:set-lyrics-text', { detail: { text: (t as any).lyricsText } }));
                } catch {}
              }
            }} />
          )}
          {route.startsWith('pl:') && currentPlaylist && (
            <PlaylistView
              playlist={currentPlaylist}
              onBack={() => nav('home')}
              onAddLocal={() => addLocalTo(currentPlaylist.id)}
              onPlayAll={() => playAll(currentPlaylist)}
              onPlayTrack={playTrack}
              onRename={(name) => persistPlaylist({ ...currentPlaylist, name })}
              onDelete={() => { if (confirm('确定删除该歌单？')) deletePlaylist(currentPlaylist.id); }}
              onRemoveTrack={(id) => persistPlaylist({ ...currentPlaylist, tracks: currentPlaylist.tracks.filter(t => t.id !== id) })}
              onOpenLyrics={() => setShowLyrics(true)}
              fullWidth
              onEditTrack={(t) => nav(`song:${t.id}`)}
              onOpenSong={(t) => nav(`song:${t.id}`)}
              onExport={async () => {
                try {
                  const blob = await exportPlaylist(currentPlaylist.id);
                  if (blob) {
                    // 使用歌单名称作为文件名，移除非法字符
                    const safeName = currentPlaylist.name.replace(/[<>:"/\\|?*]/g, '_');
                    downloadZip(blob, `${safeName}_${new Date().toISOString().slice(0,10)}.zip`);
                    alert('导出成功！');
                  } else {
                    alert('导出失败: 未找到歌单');
                  }
                } catch (error) {
                  console.error('[导出] 失败:', error);
                  alert('导出失败: ' + (error instanceof Error ? error.message : '未知错误'));
                }
              }}
            />
          )}
          {/* 歌单详情右上角按钮已移除 */}
        </div>
      )}
      <MiniPlayer 
        current={current} 
        onPrev={audioCtl.prev} 
        onToggle={audioCtl.toggle} 
        onNext={audioCtl.next} 
        onCoverClick={() => setShowLyrics(true)} 
        onPlaylistClick={() => setShowPlaylist(v => !v)}
        isPlaying={isPlaying} 
      />
      {showPlaylist && (
        <PlaylistSidebar
          playlist={playingPlaylist}
          current={current}
          currentIndex={currentIndex}
          onClose={() => setShowPlaylist(false)}
          onPlayTrack={playTrack}
        />
      )}
      <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" style={{ display: 'none' }} />
      <DetailsModal track={details} onClose={() => setDetails(null)} onSave={async (t) => {
        setDetails(null);
        if (!currentPlaylist) return;
        const idx = currentPlaylist.tracks.findIndex(x => x.id === (t.id));
        if (idx >= 0) {
          const updated = { ...currentPlaylist, tracks: currentPlaylist.tracks.map((x, i) => i === idx ? t : x) };
          persistPlaylist(updated);
          setCurrent(t.id === (current?.id) ? t : current);
          // 同步更新到 TRACKS 缓存
          if (t.cacheKey) {
            try {
              const existing: any = await idbGet(STORES.TRACKS, t.cacheKey);
              if (existing) {
                await idbPut(STORES.TRACKS, {
                  ...existing,
                  title: t.title,
                  artist: t.artist,
                  album: t.album,
                  year: t.year,
                  coverDataUrl: t.coverDataUrl,
                  lyricsText: (t as any).lyricsText,
                });
              }
            } catch {}
          }
          // 如果正在播放该曲目，立即更新歌词
          if (t.id === current?.id && (t as any).lyricsText) {
            try {
              window.dispatchEvent(new CustomEvent('amll:set-lyrics-text', { detail: { text: (t as any).lyricsText } }));
            } catch {}
          }
        }
      }} />

      {/* 歌词页退出小条（置于歌词层上方） */}
      {showLyrics && (
        <button onClick={() => setShowLyrics(false)}
          style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 500,
            width: 84, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.65)', border: 'none', cursor: 'pointer' }}
          title="下拉关闭" />
      )}

      {showLyrics && (
        <div style={{ position: 'fixed', right: 18, bottom: 18, display: 'flex', gap: 12, zIndex: 500 }}>
          <button title="聊天" style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff' }}>💬</button>
          <button title="列表" style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff' }}>≡</button>
        </div>
      )}

      {/* 旧设置弹窗已删除，改为独立页面 */}
    </div>
  );
};

const rootEl = document.getElementById('app-root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}

