use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// 128-bit ID compatible with Articy's ID system
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub struct ArticyId {
    pub low: u64,
    pub high: u64,
}

impl ArticyId {
    /// Generate a new unique ArticyId
    pub fn new() -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        
        let counter = COUNTER.fetch_add(1, Ordering::SeqCst);
        let random: u64 = rand_u64();
        
        Self {
            high: timestamp ^ random,
            low: (counter << 32) | (random & 0xFFFFFFFF),
        }
    }
    
    /// Convert to hex string representation
    pub fn to_hex_string(&self) -> String {
        format!("0x{:016x}{:016x}", self.high, self.low)
    }
    
    /// Parse from hex string
    pub fn from_hex_string(s: &str) -> Option<Self> {
        let s = s.trim_start_matches("0x");
        if s.len() != 32 {
            return None;
        }
        
        let high = u64::from_str_radix(&s[0..16], 16).ok()?;
        let low = u64::from_str_radix(&s[16..32], 16).ok()?;
        
        Some(Self { high, low })
    }
    
    /// Check if this is a null/zero ID
    pub fn is_null(&self) -> bool {
        self.high == 0 && self.low == 0
    }
}

/// Generate a simple string ID
pub fn generate_id() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    
    let counter = COUNTER.fetch_add(1, Ordering::SeqCst);
    let random = rand_u64() & 0xFFFFFF;
    
    format!("{:x}-{:x}-{:x}", timestamp, random, counter)
}

/// Generate a technical name from a display name
pub fn to_technical_name(display_name: &str) -> String {
    let mut result = String::new();
    let mut prev_underscore = false;
    
    for c in display_name.chars() {
        if c.is_alphanumeric() {
            result.push(c);
            prev_underscore = false;
        } else if c.is_whitespace() || c == '-' || c == '_' {
            if !prev_underscore && !result.is_empty() {
                result.push('_');
                prev_underscore = true;
            }
        }
    }
    
    // Remove trailing underscore
    if result.ends_with('_') {
        result.pop();
    }
    
    // Ensure it doesn't start with a digit
    if result.chars().next().map(|c| c.is_numeric()).unwrap_or(false) {
        result.insert(0, '_');
    }
    
    // Limit length
    if result.len() > 64 {
        result.truncate(64);
    }
    
    result
}

/// Simple pseudo-random number generator (not cryptographically secure)
fn rand_u64() -> u64 {
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hasher};
    
    let state = RandomState::new();
    let mut hasher = state.build_hasher();
    hasher.write_u64(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64
    );
    hasher.finish()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_articy_id_generation() {
        let id1 = ArticyId::new();
        let id2 = ArticyId::new();
        assert_ne!(id1, id2);
    }
    
    #[test]
    fn test_articy_id_hex() {
        let id = ArticyId::new();
        let hex = id.to_hex_string();
        let parsed = ArticyId::from_hex_string(&hex).unwrap();
        assert_eq!(id, parsed);
    }
    
    #[test]
    fn test_technical_name() {
        assert_eq!(to_technical_name("Hello World"), "Hello_World");
        assert_eq!(to_technical_name("123 Start"), "_123_Start");
        assert_eq!(to_technical_name("Test---Name"), "Test_Name");
    }
}
