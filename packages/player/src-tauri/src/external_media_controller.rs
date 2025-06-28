use std::{
    sync::{Arc, Mutex},
    thread,
};

use anyhow::{Context, Result};
use crossbeam_channel::{Receiver, select, unbounded};
use serde::{Deserialize, Serialize};
use smtc_suite::{
    MediaCommand as SmtcControlCommandInternal, MediaUpdate, NowPlayingInfo as SmtcNowPlayingInfo,
    SmtcSessionInfo as SuiteSmtcSessionInfo,
};
use tauri::{AppHandle, Emitter, Runtime};
use tracing::{debug, error, info, warn};

/// 从UI后端（`event_receiver_loop`）发出的内部命令。
///
/// 目前只用于从其他地方请求一次状态全量更新。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ListenerCommand {
    /// 重新发送一次当前缓存的媒体信息。
    RequestUpdate,
}

/// 文本转换模式。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TextConversionMode {
    Off,
    TraditionalToSimplified,
    SimplifiedToTraditional,
    SimplifiedToTaiwan,
    TaiwanToSimplified,
    SimplifiedToHongKong,
    HongKongToSimplified,
}

/// 发送到 Tauri 前端的事件的统一封装。
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data", rename_all = "camelCase")]
pub enum SmtcEvent {
    /// 曲目元数据已更新 (标题、艺术家、专辑、时长)。
    TrackMetadata(TrackMetadata),
    /// 封面数据已更新。通常伴随着 `TrackMetadata` 一起发送。
    /// payload 为 `Option<Vec<u8>>`，前端需要进行 Base64 解码（如果需要显示图片）。
    CoverData(Option<Vec<u8>>),
    /// 播放状态已更新 (播放/暂停、进度、随机/重复模式)。
    PlaybackStatus(PlaybackStatus),
    /// 音量或静音状态已发生变化。
    VolumeChanged(VolumeStatus),
    /// 可用的媒体会话列表已更新。
    SessionsChanged(Vec<SmtcSessionInfo>),
    /// 之前选择的媒体会话已消失（例如，应用已关闭）。
    SelectedSessionVanished(String),
    /// 接收到一个音频数据包（用于可视化）。
    AudioData(Vec<u8>),
    /// 报告一个来自 `smtc-suite` 的错误。
    Error(String),
}

/// 音量状态的封装。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeStatus {
    pub volume: f32,
    pub is_muted: bool,
}

/// 曲目元数据的封装。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album_title: Option<String>,
    pub duration_ms: Option<u64>,
}

/// 播放状态的封装。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackStatus {
    pub is_playing: bool,
    pub position_ms: u64,
    pub is_shuffle_active: bool,
    pub repeat_mode: RepeatMode,
}

/// SMTC 会话信息的封装，用于在前端显示。
#[derive(Debug, Clone, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct SmtcSessionInfo {
    pub session_id: String,
    pub display_name: String,
}

impl From<SuiteSmtcSessionInfo> for SmtcSessionInfo {
    fn from(info: SuiteSmtcSessionInfo) -> Self {
        Self {
            session_id: info.session_id,
            display_name: info.display_name,
        }
    }
}

/// 从 Tauri 前端接收的媒体控制命令。
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum MediaCommand {
    SelectSession { session_id: String },
    SetTextConversion { mode: TextConversionMode },
    SetShuffle { is_active: bool },
    SetRepeatMode { mode: RepeatMode },
    Play,
    Pause,
    SkipNext,
    SkipPrevious,
    SeekTo { time_ms: u64 },
    SetVolume { volume: f32 },
    StartAudioVisualization,
    StopAudioVisualization,
    SetHighFrequencyProgressUpdates { enabled: bool },
}

/// 重复播放模式。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RepeatMode {
    Off,
    One,
    All,
}

/// 用于在 `event_receiver_loop` 中缓存上一次发送的元数据。
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CachedNowPlayingInfo {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album_title: Option<String>,
    pub duration_ms: Option<u64>,
    pub cover_data_hash: Option<u64>,
}

impl From<&SmtcNowPlayingInfo> for CachedNowPlayingInfo {
    fn from(info: &SmtcNowPlayingInfo) -> Self {
        Self {
            title: info.title.clone(),
            artist: info.artist.clone(),
            album_title: info.album_title.clone(),
            duration_ms: info.duration_ms,
            cover_data_hash: info.cover_data_hash,
        }
    }
}

/// Tauri 的状态管理结构体。
pub struct ExternalMediaControllerState {
    /// 向 `smtc-suite` 发送命令的通道发送端。
    pub smtc_command_tx: Arc<Mutex<crossbeam_channel::Sender<SmtcControlCommandInternal>>>,
    /// 向 `event_receiver_loop` 发送内部命令的通道发送端。
    pub listener_command_tx: Arc<Mutex<crossbeam_channel::Sender<ListenerCommand>>>,
}

impl ExternalMediaControllerState {
    /// 辅助函数，用于安全地发送命令到 `smtc-suite`。
    pub fn send_smtc_command(&self, command: SmtcControlCommandInternal) -> anyhow::Result<()> {
        let guard = self
            .smtc_command_tx
            .lock()
            .map_err(|e| anyhow::anyhow!("SMTC 命令通道的 Mutex 锁已毒化：{}", e))?;
        guard.send(command).context("发送命令到 SMTC 监听线程失败")
    }

    /// 辅助函数，用于安全地发送内部命令到 `event_receiver_loop`。
    pub fn send_listener_command(&self, command: ListenerCommand) -> anyhow::Result<()> {
        let guard = self
            .listener_command_tx
            .lock()
            .map_err(|e| anyhow::anyhow!("监听器命令通道的 Mutex 锁已毒化：{}", e))?;
        guard.send(command).context("发送命令到监听线程失败")
    }
}

/// Tauri 命令：处理所有来自前端的媒体控制请求。
#[tauri::command]
pub async fn control_external_media(
    payload: MediaCommand,
    state: tauri::State<'_, ExternalMediaControllerState>,
) -> Result<(), String> {
    info!("接收到控制命令: {:?}", payload);

    let command = match payload {
        MediaCommand::SelectSession { session_id } => {
            // 前端可能会传来 "null" 字符串，需要特殊处理为空字符串，切换为自动选择模式。
            let target_id = if session_id == "null" {
                "".to_string()
            } else {
                session_id
            };
            smtc_suite::MediaCommand::SelectSession(target_id)
        }
        MediaCommand::SetTextConversion { mode } => {
            let suite_mode = match mode {
                TextConversionMode::Off => smtc_suite::TextConversionMode::Off,
                TextConversionMode::TraditionalToSimplified => {
                    smtc_suite::TextConversionMode::TraditionalToSimplified
                }
                TextConversionMode::SimplifiedToTraditional => {
                    smtc_suite::TextConversionMode::SimplifiedToTraditional
                }
                TextConversionMode::SimplifiedToTaiwan => {
                    smtc_suite::TextConversionMode::SimplifiedToTaiwan
                }
                TextConversionMode::TaiwanToSimplified => {
                    smtc_suite::TextConversionMode::TaiwanToSimplified
                }
                TextConversionMode::SimplifiedToHongKong => {
                    smtc_suite::TextConversionMode::SimplifiedToHongKong
                }
                TextConversionMode::HongKongToSimplified => {
                    smtc_suite::TextConversionMode::HongKongToSimplified
                }
            };
            smtc_suite::MediaCommand::SetTextConversion(suite_mode)
        }
        MediaCommand::SetShuffle { is_active } => {
            smtc_suite::MediaCommand::Control(smtc_suite::SmtcControlCommand::SetShuffle(is_active))
        }
        MediaCommand::SetRepeatMode { mode } => {
            let suite_mode = match mode {
                RepeatMode::Off => smtc_suite::RepeatMode::Off,
                RepeatMode::One => smtc_suite::RepeatMode::One,
                RepeatMode::All => smtc_suite::RepeatMode::All,
            };
            smtc_suite::MediaCommand::Control(smtc_suite::SmtcControlCommand::SetRepeatMode(
                suite_mode,
            ))
        }
        MediaCommand::Play => {
            smtc_suite::MediaCommand::Control(smtc_suite::SmtcControlCommand::Play)
        }
        MediaCommand::Pause => {
            smtc_suite::MediaCommand::Control(smtc_suite::SmtcControlCommand::Pause)
        }
        MediaCommand::SkipNext => {
            smtc_suite::MediaCommand::Control(smtc_suite::SmtcControlCommand::SkipNext)
        }
        MediaCommand::SkipPrevious => {
            smtc_suite::MediaCommand::Control(smtc_suite::SmtcControlCommand::SkipPrevious)
        }
        MediaCommand::SeekTo { time_ms } => {
            smtc_suite::MediaCommand::Control(smtc_suite::SmtcControlCommand::SeekTo(time_ms))
        }
        MediaCommand::SetVolume { volume } => {
            // 确保音量值在有效范围内。
            let clamped_volume = volume.max(0.0).min(1.0);
            smtc_suite::MediaCommand::Control(smtc_suite::SmtcControlCommand::SetVolume(
                clamped_volume,
            ))
        }
        MediaCommand::StartAudioVisualization => smtc_suite::MediaCommand::StartAudioCapture,
        MediaCommand::StopAudioVisualization => smtc_suite::MediaCommand::StopAudioCapture,
        MediaCommand::SetHighFrequencyProgressUpdates { enabled } => {
            smtc_suite::MediaCommand::SetHighFrequencyProgressUpdates(enabled)
        }
    };

    state.send_smtc_command(command).map_err(|e| e.to_string())
}

/// Tauri 命令：请求一次全量的状态更新。
#[tauri::command]
pub async fn request_smtc_update(
    state: tauri::State<'_, ExternalMediaControllerState>,
) -> Result<(), String> {
    info!("正在请求 SMTC 更新...");
    state
        .send_listener_command(ListenerCommand::RequestUpdate)
        .map_err(|e| e.to_string())
}

/// 启动所有后台监听服务。
pub fn start_listener<R: Runtime>(app_handle: AppHandle<R>) -> ExternalMediaControllerState {
    info!("正在启动 SMTC 监听器...");
    let controller = match smtc_suite::MediaManager::start() {
        Ok(c) => c,
        Err(e) => {
            error!("启动 smtc-suite MediaManager 失败: {}", e);
            // 如果启动失败，创建一个哑状态，防止应用崩溃，但功能将不可用。
            let (smtc_tx, _) = unbounded();
            let (listener_tx, _) = unbounded();
            return ExternalMediaControllerState {
                smtc_command_tx: Arc::new(Mutex::new(smtc_tx)),
                listener_command_tx: Arc::new(Mutex::new(listener_tx)),
            };
        }
    };

    let update_rx_crossbeam = controller.update_rx;
    let smtc_command_tx_crossbeam = controller.command_tx;

    let (listener_command_tx, listener_command_rx) = unbounded::<ListenerCommand>();
    let last_known_info = Arc::new(Mutex::new(None::<SmtcNowPlayingInfo>));

    let app_handle_receiver = app_handle.clone();
    let last_known_info_receiver = last_known_info.clone();
    thread::Builder::new()
        .name("smtc-event-receiver".into())
        .spawn(move || {
            event_receiver_loop(
                app_handle_receiver,
                update_rx_crossbeam,
                listener_command_rx,
                last_known_info_receiver,
            );
        })
        .expect("创建 smtc-event-receiver 线程失败");

    if smtc_command_tx_crossbeam
        .send(SmtcControlCommandInternal::SetHighFrequencyProgressUpdates(
            true,
        ))
        .is_err()
    {
        warn!("启用高频更新失败，通道可能已关闭。");
    }

    ExternalMediaControllerState {
        smtc_command_tx: Arc::new(Mutex::new(smtc_command_tx_crossbeam)),
        listener_command_tx: Arc::new(Mutex::new(listener_command_tx)),
    }
}

/// 核心事件循环，运行在专用的后台线程中。
fn event_receiver_loop<R: Runtime>(
    app_handle: AppHandle<R>,
    update_rx: Receiver<MediaUpdate>,
    command_rx: Receiver<ListenerCommand>,
    last_known_info: Arc<Mutex<Option<SmtcNowPlayingInfo>>>,
) {
    let mut last_sent_info_cache = CachedNowPlayingInfo::default();

    loop {
        select! {
            // 分支 1: 处理来自 `smtc-suite` 的更新。
            recv(update_rx) -> msg => {
                match msg {
                    Ok(update) => {
                        let mut guard = last_known_info.lock().unwrap();

                        match update {
                            MediaUpdate::TrackChanged(mut new_info) => {
                                new_info = parse_apple_music_field(new_info);

                                // 创建一个新的、包含封面哈希的缓存对象用于比较
                                let current_info_cache = CachedNowPlayingInfo::from(&new_info);

                                // 判断是否为新歌或信息有更新
                                // 任何一个元数据或封面哈希变化，都认为是更新
                                if last_sent_info_cache != current_info_cache {
                                    debug!("检测到曲目信息更新，正在发送元数据和封面...");

                                    // 发送元数据
                                    let _ = app_handle.emit("smtc_update", SmtcEvent::TrackMetadata(TrackMetadata {
                                        title: new_info.title.clone(),
                                        artist: new_info.artist.clone(),
                                        album_title: new_info.album_title.clone(),
                                        duration_ms: new_info.duration_ms,
                                    }));

                                    // 发送封面
                                    let _ = app_handle.emit("smtc_update", SmtcEvent::CoverData(new_info.cover_data.clone()));

                                    // 更新缓存
                                    last_sent_info_cache = current_info_cache;
                                }

                                // 总是发送 PlaybackStatus，因为这是高频更新的核心
                                let _ = app_handle.emit("smtc_update", SmtcEvent::PlaybackStatus(PlaybackStatus {
                                    is_playing: new_info.is_playing.unwrap_or(false),
                                    position_ms: new_info.position_ms.unwrap_or(0),
                                    is_shuffle_active: new_info.is_shuffle_active.unwrap_or(false),
                                    repeat_mode: new_info.repeat_mode.map(|m| match m {
                                        smtc_suite::RepeatMode::Off => RepeatMode::Off,
                                        smtc_suite::RepeatMode::One => RepeatMode::One,
                                        smtc_suite::RepeatMode::All => RepeatMode::All,
                                    }).unwrap_or(RepeatMode::Off),
                                }));

                                // 更新全局共享状态
                                *guard = Some(new_info);
                            }
                            MediaUpdate::VolumeChanged { session_id: _, volume, is_muted } => {
                                let payload = SmtcEvent::VolumeChanged(VolumeStatus { volume, is_muted });
                                let _ = app_handle.emit("smtc_update", payload);
                            }
                            MediaUpdate::SessionsChanged(sessions) => {
                                let payload = SmtcEvent::SessionsChanged(sessions.into_iter().map(SmtcSessionInfo::from).collect());
                                let _ = app_handle.emit("smtc_update", payload);
                            }
                            MediaUpdate::SelectedSessionVanished(id) => {
                                let payload = SmtcEvent::SelectedSessionVanished(id.clone());
                                let _ = app_handle.emit("smtc_update", payload);
                                // 当会话消失时，清空所有缓存状态。
                                *guard = None;
                                last_sent_info_cache = CachedNowPlayingInfo::default();
                            }
                            MediaUpdate::AudioData(bytes) => {
                                let payload = SmtcEvent::AudioData(bytes);
                                let _ = app_handle.emit("smtc_update", payload);
                            }
                            MediaUpdate::Error(e) => {
                                let payload = SmtcEvent::Error(e.to_string());
                                let _ = app_handle.emit("smtc_update", payload);
                            }
                        }
                    },
                    Err(_) => {
                        info!("媒体事件通道已关闭，接收线程退出。");
                        break;
                    }
                }
            },
            // 分支 2: 处理来自 Tauri 命令的内部请求。
            recv(command_rx) -> msg => {
                match msg {
                    Ok(ListenerCommand::RequestUpdate) => {
                        info!("收到更新请求，正在重新发送当前元数据和封面...");
                        let guard = last_known_info.lock().unwrap();
                        if let Some(info) = &*guard {
                            // 重新发送当前缓存的元数据和封面，但不发送播放状态，
                            // 因为播放状态由 `TrackChanged` 持续更新。
                            let _ = app_handle.emit("smtc_update", SmtcEvent::TrackMetadata(TrackMetadata {
                                title: info.title.clone(),
                                artist: info.artist.clone(),
                                album_title: info.album_title.clone(),
                                duration_ms: info.duration_ms,
                            }));
                            let _ = app_handle.emit("smtc_update", SmtcEvent::CoverData(info.cover_data.clone()));
                        }
                    },
                    Err(_) => {
                        info!("监听器命令通道已关闭，接收线程退出。");
                        break;
                    }
                }
            }
        }
    }
}

/// 特殊的解析逻辑，用于处理 Apple Music 的元数据。
fn parse_apple_music_field(mut info: SmtcNowPlayingInfo) -> SmtcNowPlayingInfo {
    if let Some(original_artist_field) = info.artist.take() {
        if let Some((artist, album)) = original_artist_field.split_once(" — ") {
            info.artist = Some(artist.trim().to_string());
            // 只有在专辑字段原本为空时才覆盖。
            if info.album_title.as_deref().unwrap_or("").is_empty() {
                info.album_title = Some(album.trim().to_string());
            }
        } else {
            // 如果不匹配 " — " 格式，则将原始字符串放回。
            info.artist = Some(original_artist_field);
        }
    }
    info
}
