from __future__ import annotations

import hashlib
import os
import time
import json
from datetime import datetime, timezone
from threading import Lock, RLock
from typing import Any, Optional
from dataclasses import dataclass, field, asdict
from collections import defaultdict

# Session configuration
_SESSION_LOCK = RLock()
_SESSION_STATE: dict[str, dict[str, Any]] = {}
_SESSION_SECRET = os.environ.get("YF_SESSION_SECRET", "yf-default-session-secret")

# Session configuration constants
SESSION_EXPIRY_SECONDS = 3600  # 1 hour
MAX_SESSIONS = 10000
MAX_RECENT_EVENTS = 30
SESSION_CLEANUP_INTERVAL = 300  # 5 minutes


@dataclass
class SessionEvent:
    """Represents a single session event with metadata."""
    
    timestamp: float
    event_name: str
    path: str
    payload: dict[str, Any]
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    
    def to_dict(self) -> dict[str, Any]:
        """Convert event to dictionary representation."""
        return {
            "at": self.timestamp,
            "event": self.event_name,
            "path": self.path,
            "payload": self.payload,
            "ip": self.ip_address,
            "ua": self.user_agent[:50] if self.user_agent else None,
        }
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SessionEvent":
        """Create event from dictionary representation."""
        return cls(
            timestamp=data.get("at", time.time()),
            event_name=data.get("event", "unknown"),
            path=data.get("path", ""),
            payload=data.get("payload", {}),
            ip_address=data.get("ip"),
            user_agent=data.get("ua"),
        )


@dataclass
class SessionState:
    """Represents the full state of a user session."""
    
    session_hash: str
    created_at: float
    updated_at: float
    expires_at: float
    event_count: int = 0
    last_event: str = "session_init"
    last_path: str = ""
    last_payload: dict[str, Any] = field(default_factory=dict)
    recent_events: list[SessionEvent] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    
    def is_expired(self) -> bool:
        """Check if the session has expired."""
        return time.time() > self.expires_at
    
    def touch(self) -> None:
        """Update the session's last activity time and extend expiry."""
        self.updated_at = time.time()
        self.expires_at = self.updated_at + SESSION_EXPIRY_SECONDS
    
    def add_event(self, event: SessionEvent) -> None:
        """Add an event to the session's history."""
        self.recent_events.append(event)
        # Keep only the most recent events
        if len(self.recent_events) > MAX_RECENT_EVENTS:
            self.recent_events = self.recent_events[-MAX_RECENT_EVENTS:]
        
        self.event_count += 1
        self.last_event = event.event_name
        self.last_path = event.path
        self.last_payload = event.payload
        self.touch()
    
    def to_dict(self) -> dict[str, Any]:
        """Convert session state to dictionary representation."""
        return {
            "session_hash": self.session_hash,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "expires_at": self.expires_at,
            "event_count": self.event_count,
            "last_event": self.last_event,
            "last_path": self.last_path,
            "last_payload": self.last_payload,
            "recent_events": [e.to_dict() for e in self.recent_events],
            "metadata": self.metadata,
            "is_expired": self.is_expired(),
            "ttl_seconds": max(0, self.expires_at - time.time()),
        }
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SessionState":
        """Create session state from dictionary representation."""
        events = [SessionEvent.from_dict(e) for e in data.get("recent_events", [])]
        return cls(
            session_hash=data.get("session_hash", ""),
            created_at=data.get("created_at", time.time()),
            updated_at=data.get("updated_at", time.time()),
            expires_at=data.get("expires_at", time.time() + SESSION_EXPIRY_SECONDS),
            event_count=data.get("event_count", 0),
            last_event=data.get("last_event", "session_init"),
            last_path=data.get("last_path", ""),
            last_payload=data.get("last_payload", {}),
            recent_events=events,
            metadata=data.get("metadata", {}),
        )


# Session analytics tracking
_SESSION_ANALYTICS: dict[str, Any] = {
    "total_sessions_created": 0,
    "total_events_logged": 0,
    "sessions_expired": 0,
    "last_cleanup_at": 0,
    "event_counts_by_type": defaultdict(int),
    "path_counts": defaultdict(int),
}


def hash_session(raw_session: str, user_agent: str, remote_addr: str) -> str:
    """Generate a secure session hash from session components.
    
    Creates a SHA-256 hash of the session identifier combined with
    user agent and IP address for additional uniqueness.
    
    Args:
        raw_session: Raw session identifier string
        user_agent: Client's user agent string
        remote_addr: Client's IP address
        
    Returns:
        Hexadecimal session hash string
    """
    raw = f"{_SESSION_SECRET}|{raw_session}|{user_agent}|{remote_addr}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def hash_session_with_salt(raw_session: str, user_agent: str, remote_addr: str, salt: str) -> str:
    """Generate a session hash with additional salt.
    
    Args:
        raw_session: Raw session identifier string
        user_agent: Client's user agent string
        remote_addr: Client's IP address
        salt: Additional salt string for uniqueness
        
    Returns:
        Hexadecimal session hash string
    """
    raw = f"{_SESSION_SECRET}|{raw_session}|{user_agent}|{remote_addr}|{salt}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _cleanup_expired_sessions() -> int:
    """Remove expired sessions from the session store.
    
    Returns:
        Number of sessions that were cleaned up
    """
    now = time.time()
    expired_keys = []
    
    with _SESSION_LOCK:
        # Check if cleanup is needed
        last_cleanup = _SESSION_ANALYTICS.get("last_cleanup_at", 0)
        if now - last_cleanup < SESSION_CLEANUP_INTERVAL:
            return 0
        
        _SESSION_ANALYTICS["last_cleanup_at"] = now
        
        for session_hash, state_dict in _SESSION_STATE.items():
            state = SessionState.from_dict(state_dict)
            if state.is_expired():
                expired_keys.append(session_hash)
        
        for key in expired_keys:
            del _SESSION_STATE[key]
            _SESSION_ANALYTICS["sessions_expired"] += 1
    
    return len(expired_keys)


def _enforce_session_limit() -> None:
    """Enforce the maximum number of sessions by removing oldest ones."""
    with _SESSION_LOCK:
        if len(_SESSION_STATE) <= MAX_SESSIONS:
            return
        
        # Sort sessions by last update time and remove oldest
        sorted_sessions = sorted(
            _SESSION_STATE.items(),
            key=lambda x: x[1].get("updated_at", 0)
        )
        
        sessions_to_remove = len(_SESSION_STATE) - MAX_SESSIONS
        for i in range(sessions_to_remove):
            session_hash = sorted_sessions[i][0]
            del _SESSION_STATE[session_hash]


def get_or_create_session_state(session_hash: str) -> dict[str, Any]:
    """Get existing session state or create a new one.
    
    Args:
        session_hash: Unique session identifier hash
        
    Returns:
        Dictionary containing the session state
    """
    now = time.time()
    
    # Periodically cleanup expired sessions
    _cleanup_expired_sessions()
    
    with _SESSION_LOCK:
        state_dict = _SESSION_STATE.get(session_hash)
        
        if state_dict is not None:
            state = SessionState.from_dict(state_dict)
            if not state.is_expired():
                state.touch()
                _SESSION_STATE[session_hash] = state.to_dict()
                return state.to_dict()
        
        # Create new session
        state = SessionState(
            session_hash=session_hash,
            created_at=now,
            updated_at=now,
            expires_at=now + SESSION_EXPIRY_SECONDS,
        )
        _SESSION_STATE[session_hash] = state.to_dict()
        _SESSION_ANALYTICS["total_sessions_created"] += 1
        
        # Enforce session limit
        _enforce_session_limit()
        
        return state.to_dict()


def register_event(
    session_hash: str,
    event_name: str,
    path: str,
    payload: dict[str, Any],
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> dict[str, Any]:
    """Register an event for a session.
    
    Records the event in the session's history and updates analytics.
    
    Args:
        session_hash: Unique session identifier hash
        event_name: Name of the event being logged
        path: URL path where the event occurred
        payload: Additional event data
        ip_address: Optional client IP address
        user_agent: Optional client user agent string
        
    Returns:
        Updated session state dictionary
    """
    now = time.time()
    
    with _SESSION_LOCK:
        state_dict = _SESSION_STATE.get(session_hash)
        
        if state_dict is None:
            state = SessionState(
                session_hash=session_hash,
                created_at=now,
                updated_at=now,
                expires_at=now + SESSION_EXPIRY_SECONDS,
            )
            _SESSION_ANALYTICS["total_sessions_created"] += 1
        else:
            state = SessionState.from_dict(state_dict)
        
        # Create and add the event
        event = SessionEvent(
            timestamp=now,
            event_name=event_name,
            path=path,
            payload=payload,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        state.add_event(event)
        
        # Update analytics
        _SESSION_ANALYTICS["total_events_logged"] += 1
        _SESSION_ANALYTICS["event_counts_by_type"][event_name] += 1
        _SESSION_ANALYTICS["path_counts"][path] += 1
        
        # Save state
        _SESSION_STATE[session_hash] = state.to_dict()
        
        return state.to_dict()


def read_session_state(session_hash: str) -> dict[str, Any]:
    """Read the current state of a session.
    
    Args:
        session_hash: Unique session identifier hash
        
    Returns:
        Session state dictionary, or empty dict if session doesn't exist
    """
    with _SESSION_LOCK:
        state_dict = _SESSION_STATE.get(session_hash)
        if state_dict is None:
            return {}
        
        state = SessionState.from_dict(state_dict)
        if state.is_expired():
            del _SESSION_STATE[session_hash]
            return {}
        
        return state.to_dict()


def update_session_metadata(session_hash: str, metadata: dict[str, Any]) -> dict[str, Any]:
    """Update session metadata.
    
    Args:
        session_hash: Unique session identifier hash
        metadata: Dictionary of metadata to merge into session
        
    Returns:
        Updated session state dictionary
    """
    with _SESSION_LOCK:
        state_dict = _SESSION_STATE.get(session_hash)
        if state_dict is None:
            return {}
        
        state = SessionState.from_dict(state_dict)
        if state.is_expired():
            del _SESSION_STATE[session_hash]
            return {}
        
        state.metadata.update(metadata)
        state.touch()
        _SESSION_STATE[session_hash] = state.to_dict()
        
        return state.to_dict()


def delete_session(session_hash: str) -> bool:
    """Delete a session.
    
    Args:
        session_hash: Unique session identifier hash
        
    Returns:
        True if session was deleted, False if it didn't exist
    """
    with _SESSION_LOCK:
        if session_hash in _SESSION_STATE:
            del _SESSION_STATE[session_hash]
            return True
        return False


def get_session_analytics() -> dict[str, Any]:
    """Get session analytics summary.
    
    Returns:
        Dictionary containing session analytics data
    """
    with _SESSION_LOCK:
        active_sessions = sum(
            1 for state in _SESSION_STATE.values()
            if not SessionState.from_dict(state).is_expired()
        )
        
        return {
            "active_sessions": active_sessions,
            "total_sessions": len(_SESSION_STATE),
            "total_sessions_created": _SESSION_ANALYTICS["total_sessions_created"],
            "total_events_logged": _SESSION_ANALYTICS["total_events_logged"],
            "sessions_expired": _SESSION_ANALYTICS["sessions_expired"],
            "event_counts_by_type": dict(_SESSION_ANALYTICS["event_counts_by_type"]),
            "top_paths": dict(
                sorted(
                    _SESSION_ANALYTICS["path_counts"].items(),
                    key=lambda x: x[1],
                    reverse=True
                )[:10]
            ),
            "last_cleanup_at": _SESSION_ANALYTICS["last_cleanup_at"],
        }


def clear_all_sessions() -> int:
    """Clear all sessions (for testing or maintenance).
    
    Returns:
        Number of sessions that were cleared
    """
    with _SESSION_LOCK:
        count = len(_SESSION_STATE)
        _SESSION_STATE.clear()
        return count


def export_sessions() -> str:
    """Export all session data as JSON string.
    
    Returns:
        JSON string containing all session data
    """
    with _SESSION_LOCK:
        return json.dumps({
            "sessions": _SESSION_STATE,
            "analytics": {
                k: dict(v) if isinstance(v, defaultdict) else v
                for k, v in _SESSION_ANALYTICS.items()
            },
            "exported_at": datetime.now(timezone.utc).isoformat(),
        }, indent=2)


def import_sessions(json_data: str) -> int:
    """Import session data from JSON string.
    
    Args:
        json_data: JSON string containing session data
        
    Returns:
        Number of sessions imported
    """
    data = json.loads(json_data)
    sessions = data.get("sessions", {})
    
    with _SESSION_LOCK:
        _SESSION_STATE.update(sessions)
        return len(sessions)
