use regex::{Regex, RegexBuilder};
use std::borrow::Cow;

use crate::ttml_processor::{amll_player_types::AgentRecognizerOptions, types::LyricLine};

fn get_agent_regex(options: &AgentRecognizerOptions) -> Regex {
    const DEFAULT_PATTERN: &str = r"^\s*(?:\((.+?)\)|（(.+?)）|([^\s:()（）]+))\s*[:：]\s*";

    let pattern = options.custom_pattern.as_deref().unwrap_or(DEFAULT_PATTERN);

    RegexBuilder::new(pattern)
        .case_insensitive(!options.case_sensitive)
        .build()
        .unwrap()
}

pub fn recognize_agents(lines: &mut Vec<LyricLine>, options: &AgentRecognizerOptions) {
    if !options.enabled {
        return;
    }

    let agent_regex = get_agent_regex(options);
    let original_lines = std::mem::take(lines);
    let mut processed_lines = Vec::with_capacity(original_lines.len());
    let mut current_agent: Option<String> = None;

    for mut line in original_lines {
        let full_text: Cow<str> = get_line_text(&line);

        if let Some(captures) = agent_regex.captures(&full_text) {
            let agent_name = captures
                .get(1)
                .or_else(|| captures.get(2))
                .or_else(|| captures.get(3))
                .map(|m| m.as_str().trim().to_string());

            if let (Some(name), Some(full_match_capture)) = (agent_name, captures.get(0)) {
                let full_match_str = full_match_capture.as_str().to_string();

                if let Some(remaining_text) = full_text.strip_prefix(&full_match_str) {
                    let trimmed_remaining = remaining_text.trim();

                    if trimmed_remaining.is_empty() {
                        current_agent = Some(name);
                        if options.remove_marker_lines {
                            continue;
                        }
                    } else {
                        line.agent = Some(name.clone());
                        current_agent = Some(name);
                    }
                    clean_line_text(&mut line, &full_match_str);
                }
            } else {
                if options.inherit_agent {
                    line.agent = current_agent.clone();
                }
            }
        } else {
            if options.inherit_agent {
                line.agent = current_agent.clone();
            }
        }

        processed_lines.push(line);
    }

    *lines = processed_lines;
}

fn get_line_text<'a>(line: &'a LyricLine) -> Cow<'a, str> {
    if let Some(text) = &line.line_text {
        Cow::Borrowed(text)
    } else {
        let collected_string: String = line
            .main_syllables
            .iter()
            .map(|s| s.text.as_str())
            .collect();
        Cow::Owned(collected_string)
    }
}

fn clean_line_text(line: &mut LyricLine, prefix_to_remove: &str) {
    if !line.main_syllables.is_empty() {
        let mut len_to_remove = prefix_to_remove.len();
        let mut syllables_to_drain = 0;

        for syllable in &line.main_syllables {
            if len_to_remove >= syllable.text.len() {
                len_to_remove -= syllable.text.len();
                syllables_to_drain += 1;
            } else {
                break;
            }
        }

        if syllables_to_drain > 0 {
            line.main_syllables.drain(0..syllables_to_drain);
        }

        if len_to_remove > 0 {
            if let Some(first_syllable) = line.main_syllables.get_mut(0) {
                if len_to_remove < first_syllable.text.len() {
                    first_syllable.text = first_syllable.text[len_to_remove..].to_string();
                } else {
                    line.main_syllables.remove(0);
                }
            }
        }
    }

    if let Some(text) = line.line_text.as_mut() {
        if text.starts_with(prefix_to_remove) {
            *text = text[prefix_to_remove.len()..].to_string();
        } else {
            if !line.main_syllables.is_empty() {
                *text = line
                    .main_syllables
                    .iter()
                    .map(|s| s.text.as_str())
                    .collect();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ttml_processor::types::LyricSyllable;

    // 辅助函数，用于创建一个简单的 LyricLine (逐行模式)
    fn new_line(text: &str) -> LyricLine {
        LyricLine {
            line_text: Some(text.to_string()),
            ..Default::default()
        }
    }

    // 辅助函数，用于创建一个简单的 LyricLine (逐字模式)
    fn new_syllable_line(syllables: Vec<&str>) -> LyricLine {
        LyricLine {
            main_syllables: syllables
                .into_iter()
                .map(|s| LyricSyllable {
                    text: s.to_string(),
                    ..Default::default()
                })
                .collect(),
            ..Default::default()
        }
    }

    #[test]
    fn test_recognize_agents_inline_mode() {
        let mut lines = vec![
            new_line("汪：摘一颗苹果"),
            new_line("等你看我从门前过"),
            new_line("BY2：像夏天的可乐"),
            new_line("像冬天的可可"),
        ];

        recognize_agents(&mut lines, &Default::default());

        assert_eq!(lines.len(), 4);
        assert_eq!(lines[0].agent.as_deref(), Some("汪"));
        assert_eq!(lines[0].line_text.as_deref(), Some("摘一颗苹果"));

        assert_eq!(lines[1].agent.as_deref(), Some("汪"), "应继承演唱者 '汪'");
        assert_eq!(lines[1].line_text.as_deref(), Some("等你看我从门前过"));

        assert_eq!(lines[2].agent.as_deref(), Some("BY2"));
        assert_eq!(lines[2].line_text.as_deref(), Some("像夏天的可乐"));

        assert_eq!(lines[3].agent.as_deref(), Some("BY2"), "应继承演唱者 'BY2'");
        assert_eq!(lines[3].line_text.as_deref(), Some("像冬天的可可"));
    }

    #[test]
    fn test_recognize_agents_block_mode() {
        let mut lines = vec![
            new_line("TwoP："),
            new_line("都说爱情要慢慢来"),
            new_line("我的那个她却又慢半拍"),
            new_line("Stake:"), // 测试不同的冒号和无括号
            new_line("怕你跟不上我的节奏"),
        ];

        recognize_agents(&mut lines, &Default::default());

        // 纯标记行应该被移除
        assert_eq!(lines.len(), 3, "纯标记行应被移除，只留下3行歌词");

        assert_eq!(lines[0].agent.as_deref(), Some("TwoP"));
        assert_eq!(lines[0].line_text.as_deref(), Some("都说爱情要慢慢来"));

        assert_eq!(lines[1].agent.as_deref(), Some("TwoP"));

        assert_eq!(lines[2].agent.as_deref(), Some("Stake"));
        assert_eq!(lines[2].line_text.as_deref(), Some("怕你跟不上我的节奏"));
    }

    #[test]
    fn test_recognize_agents_syllable_mode() {
        let mut lines = vec![
            new_syllable_line(vec!["BY2", "： ", "像", "夏天", "的", "可乐"]),
            new_syllable_line(vec!["像", "冬天", "的", "可可"]),
        ];

        recognize_agents(&mut lines, &Default::default());

        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].agent.as_deref(), Some("BY2"));

        // 检查音节是否被正确移除
        let remaining_syllables: Vec<&str> = lines[0]
            .main_syllables
            .iter()
            .map(|s| s.text.as_str())
            .collect();
        assert_eq!(remaining_syllables, vec!["像", "夏天", "的", "可乐"]);

        assert_eq!(
            lines[1].agent.as_deref(),
            Some("BY2"),
            "Syllable line should inherit agent"
        );
    }

    #[test]
    fn test_recognize_agents_mixed_and_complex() {
        let mut lines = vec![
            new_line("（合）：合唱歌词"), // 测试全角括号
            new_line("第一句歌词"),
            new_syllable_line(vec!["TwoP", "："]),
            new_syllable_line(vec!["第", "二", "句", "逐", "字", "歌", "词"]),
            new_line("  Stake: 第三句行内歌词"),
            new_line("第四句继承Stake"),
        ];

        recognize_agents(&mut lines, &Default::default());

        assert_eq!(lines.len(), 5);

        assert_eq!(lines[0].agent.as_deref(), Some("合"));
        assert_eq!(lines[0].line_text.as_deref(), Some("合唱歌词"));

        assert_eq!(lines[1].agent.as_deref(), Some("合"));

        // "TwoP：" 这一行被移除
        assert_eq!(lines[2].agent.as_deref(), Some("TwoP"));
        let syllables_2: Vec<&str> = lines[2]
            .main_syllables
            .iter()
            .map(|s| s.text.as_str())
            .collect();
        assert_eq!(syllables_2, vec!["第", "二", "句", "逐", "字", "歌", "词"]);

        assert_eq!(lines[3].agent.as_deref(), Some("Stake"));
        assert_eq!(lines[3].line_text.as_deref(), Some("第三句行内歌词"));

        assert_eq!(lines[4].agent.as_deref(), Some("Stake"));
    }

    #[test]
    fn test_recognize_agents_no_agents() {
        let original_lines = vec![new_line("这是一行普通歌词"), new_line("这是另一行普通歌词")];
        let mut lines = original_lines.clone();

        recognize_agents(&mut lines, &Default::default());

        assert_eq!(lines.len(), 2);
        assert!(lines[0].agent.is_none());
        assert!(lines[1].agent.is_none());
        // 确保内容没有被意外修改
        assert_eq!(lines[0].line_text, original_lines[0].line_text);
    }
}
