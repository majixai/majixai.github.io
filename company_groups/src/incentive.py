"""
Incentive module - Represents incentive tasks and rewards for companies
"""
from datetime import datetime, date
from enum import Enum
from typing import List, Optional


class IncentiveType(Enum):
    """Types of incentive tasks."""
    STOCK_PURCHASE = "stock_purchase"
    CHECK_IN = "check_in"
    VOTING = "voting"
    HOMEWORK = "homework"
    QUIZ = "quiz"
    QUESTION = "question"
    LOTTERY = "lottery"
    RAFFLE = "raffle"
    MONTHLY_DISBURSEMENT = "monthly_disbursement"


class IncentiveFrequency(Enum):
    """Frequency of incentive tasks."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    ONE_TIME = "one_time"


class IncentiveTask:
    """Represents an incentive task for users to complete."""
    
    def __init__(
        self,
        task_id: int,
        name: str,
        task_type: IncentiveType,
        reward_amount: float,
        frequency: IncentiveFrequency = IncentiveFrequency.DAILY,
        links: Optional[List[str]] = None,
        is_active: bool = True,
        description: str = ""
    ):
        self.task_id = task_id
        self.name = name
        self._task_type = task_type
        self._reward_amount = reward_amount
        self.__frequency = frequency
        self.__links = links or []
        self.__is_active = is_active
        self.description = description
        self._created_at = datetime.now()
    
    def get_task_type(self) -> IncentiveType:
        """Returns the type of incentive task."""
        return self._task_type
    
    def get_reward_amount(self) -> float:
        """Returns the reward amount."""
        return self._reward_amount
    
    def set_reward_amount(self, amount: float) -> None:
        """Sets the reward amount."""
        if amount >= 0:
            self._reward_amount = amount
        else:
            print("Reward amount must be non-negative.")
    
    def get_frequency(self) -> IncentiveFrequency:
        """Returns the frequency of the task."""
        return self.__frequency
    
    def get_links(self) -> List[str]:
        """Returns the associated links (1-3 links)."""
        return self.__links[:3]  # Limit to 3 links
    
    def add_link(self, link: str) -> bool:
        """Adds a link (max 3)."""
        if len(self.__links) < 3:
            self.__links.append(link)
            return True
        print("Maximum of 3 links allowed.")
        return False
    
    def remove_link(self, link: str) -> bool:
        """Removes a link."""
        if link in self.__links:
            self.__links.remove(link)
            return True
        return False
    
    def is_active(self) -> bool:
        """Returns whether the task is active."""
        return self.__is_active
    
    def toggle_active(self) -> None:
        """Toggles the active status."""
        self.__is_active = not self.__is_active
    
    def to_dict(self) -> dict:
        """Converts task to dictionary representation."""
        return {
            "task_id": self.task_id,
            "name": self.name,
            "task_type": self._task_type.value,
            "reward_amount": self._reward_amount,
            "frequency": self.__frequency.value,
            "links": self.__links,
            "is_active": self.__is_active,
            "description": self.description,
            "created_at": self._created_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'IncentiveTask':
        """Creates an IncentiveTask instance from dictionary."""
        task = cls(
            task_id=data["task_id"],
            name=data["name"],
            task_type=IncentiveType(data["task_type"]),
            reward_amount=data["reward_amount"],
            frequency=IncentiveFrequency(data.get("frequency", "daily")),
            links=data.get("links", []),
            is_active=data.get("is_active", True),
            description=data.get("description", "")
        )
        if "created_at" in data:
            task._created_at = datetime.fromisoformat(data["created_at"])
        return task


class StockRecommendation:
    """Represents a stock recommendation with potential incentive rewards."""
    
    def __init__(
        self,
        recommendation_id: int,
        ticker: str,
        company_name: str,
        recommendation_type: str,
        incentive_reward: float = 0.0,
        purchase_link: str = ""
    ):
        self.recommendation_id = recommendation_id
        self.ticker = ticker
        self.company_name = company_name
        self._recommendation_type = recommendation_type  # buy, sell, hold
        self._incentive_reward = incentive_reward
        self._purchase_link = purchase_link
        self._created_at = datetime.now()
    
    def has_incentive(self) -> bool:
        """Returns whether this recommendation has an incentive reward."""
        return self._incentive_reward > 0
    
    def get_incentive_reward(self) -> float:
        """Returns the incentive reward amount."""
        return self._incentive_reward
    
    def to_dict(self) -> dict:
        """Converts recommendation to dictionary representation."""
        return {
            "recommendation_id": self.recommendation_id,
            "ticker": self.ticker,
            "company_name": self.company_name,
            "recommendation_type": self._recommendation_type,
            "incentive_reward": self._incentive_reward,
            "purchase_link": self._purchase_link,
            "created_at": self._created_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'StockRecommendation':
        """Creates a StockRecommendation instance from dictionary."""
        rec = cls(
            recommendation_id=data["recommendation_id"],
            ticker=data["ticker"],
            company_name=data["company_name"],
            recommendation_type=data["recommendation_type"],
            incentive_reward=data.get("incentive_reward", 0.0),
            purchase_link=data.get("purchase_link", "")
        )
        if "created_at" in data:
            rec._created_at = datetime.fromisoformat(data["created_at"])
        return rec


class LotteryRaffle:
    """Represents a lottery or raffle event."""
    
    def __init__(
        self,
        event_id: int,
        name: str,
        event_type: str,  # "lottery" or "raffle"
        prize_amount: float,
        draw_date: date,
        is_active: bool = True
    ):
        self.event_id = event_id
        self.name = name
        self._event_type = event_type
        self._prize_amount = prize_amount
        self._draw_date = draw_date
        self.__is_active = is_active
        self._entries = []
    
    def add_entry(self, user_id: int) -> None:
        """Add a user entry to the lottery/raffle."""
        if user_id not in self._entries:
            self._entries.append(user_id)
    
    def get_entry_count(self) -> int:
        """Returns the number of entries."""
        return len(self._entries)
    
    def is_active(self) -> bool:
        """Returns whether the event is active."""
        return self.__is_active and self._draw_date >= date.today()
    
    def to_dict(self) -> dict:
        """Converts event to dictionary representation."""
        return {
            "event_id": self.event_id,
            "name": self.name,
            "event_type": self._event_type,
            "prize_amount": self._prize_amount,
            "draw_date": self._draw_date.isoformat(),
            "is_active": self.__is_active,
            "entry_count": len(self._entries)
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'LotteryRaffle':
        """Creates a LotteryRaffle instance from dictionary."""
        return cls(
            event_id=data["event_id"],
            name=data["name"],
            event_type=data["event_type"],
            prize_amount=data["prize_amount"],
            draw_date=date.fromisoformat(data["draw_date"]),
            is_active=data.get("is_active", True)
        )


class MonthlyDisbursement:
    """Represents a monthly date-based disbursement."""
    
    def __init__(
        self,
        disbursement_id: int,
        name: str,
        amount: float,
        day_of_month: int,
        is_active: bool = True
    ):
        self.disbursement_id = disbursement_id
        self.name = name
        self._amount = amount
        self._day_of_month = min(max(day_of_month, 1), 28)  # 1-28 to avoid month issues
        self.__is_active = is_active
    
    def get_next_disbursement_date(self) -> date:
        """Returns the next disbursement date."""
        today = date.today()
        if today.day <= self._day_of_month:
            return date(today.year, today.month, self._day_of_month)
        else:
            if today.month == 12:
                return date(today.year + 1, 1, self._day_of_month)
            return date(today.year, today.month + 1, self._day_of_month)
    
    def to_dict(self) -> dict:
        """Converts disbursement to dictionary representation."""
        return {
            "disbursement_id": self.disbursement_id,
            "name": self.name,
            "amount": self._amount,
            "day_of_month": self._day_of_month,
            "is_active": self.__is_active,
            "next_date": self.get_next_disbursement_date().isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'MonthlyDisbursement':
        """Creates a MonthlyDisbursement instance from dictionary."""
        return cls(
            disbursement_id=data["disbursement_id"],
            name=data["name"],
            amount=data["amount"],
            day_of_month=data["day_of_month"],
            is_active=data.get("is_active", True)
        )
