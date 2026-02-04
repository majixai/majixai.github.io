"""
GroupSchedule module - Represents group meeting schedules for companies
"""
from datetime import datetime, time
from enum import Enum
from typing import List, Optional


class DayOfWeek(Enum):
    """Days of the week."""
    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6


class GroupSchedule:
    """Represents a scheduled group meeting time."""
    
    def __init__(
        self,
        schedule_id: int,
        name: str,
        days: List[DayOfWeek],
        start_time: time,
        end_time: time,
        include_weekends: bool = False,
        is_active: bool = True
    ):
        self.schedule_id = schedule_id
        self.name = name
        self._days = days
        self._start_time = start_time
        self._end_time = end_time
        self.__include_weekends = include_weekends
        self.__is_active = is_active
    
    def get_days(self) -> List[DayOfWeek]:
        """Returns the scheduled days."""
        return self._days
    
    def includes_weekends(self) -> bool:
        """Returns whether weekends are included."""
        return self.__include_weekends
    
    def set_weekend_inclusion(self, include: bool) -> None:
        """Sets weekend inclusion."""
        self.__include_weekends = include
        if include:
            if DayOfWeek.SATURDAY not in self._days:
                self._days.append(DayOfWeek.SATURDAY)
            if DayOfWeek.SUNDAY not in self._days:
                self._days.append(DayOfWeek.SUNDAY)
        else:
            self._days = [d for d in self._days if d not in [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY]]
    
    def is_active(self) -> bool:
        """Returns whether the schedule is active."""
        return self.__is_active
    
    def toggle_active(self) -> None:
        """Toggles the active status."""
        self.__is_active = not self.__is_active
    
    def get_time_range(self) -> tuple:
        """Returns the start and end time."""
        return (self._start_time, self._end_time)
    
    def is_meeting_now(self) -> bool:
        """Checks if a meeting is currently happening."""
        now = datetime.now()
        current_day = DayOfWeek(now.weekday())
        current_time = now.time()
        
        if current_day not in self._days:
            return False
        
        return self._start_time <= current_time <= self._end_time
    
    def to_dict(self) -> dict:
        """Converts schedule to dictionary representation."""
        return {
            "schedule_id": self.schedule_id,
            "name": self.name,
            "days": [d.value for d in self._days],
            "start_time": self._start_time.isoformat(),
            "end_time": self._end_time.isoformat(),
            "include_weekends": self.__include_weekends,
            "is_active": self.__is_active
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'GroupSchedule':
        """Creates a GroupSchedule instance from dictionary."""
        return cls(
            schedule_id=data["schedule_id"],
            name=data["name"],
            days=[DayOfWeek(d) for d in data["days"]],
            start_time=time.fromisoformat(data["start_time"]),
            end_time=time.fromisoformat(data["end_time"]),
            include_weekends=data.get("include_weekends", False),
            is_active=data.get("is_active", True)
        )


class ScheduleCollection:
    """A collection of schedules."""
    
    def __init__(self):
        self._schedules = []
    
    def add_schedule(self, schedule: GroupSchedule) -> None:
        """Add a schedule to the collection."""
        self._schedules.append(schedule)
    
    def get_active_schedules(self) -> List[GroupSchedule]:
        """Get all active schedules."""
        return [s for s in self._schedules if s.is_active()]
    
    def get_weekend_schedules(self) -> List[GroupSchedule]:
        """Get schedules that include weekends."""
        return [s for s in self._schedules if s.includes_weekends()]
    
    def __iter__(self):
        return iter(self._schedules)
    
    def __len__(self):
        return len(self._schedules)
