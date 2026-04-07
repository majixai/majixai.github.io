"""
Company module - Represents a company with members, schedules, and incentives
"""
from datetime import datetime
from typing import List, Optional
from enum import Enum

from .member import Member, MemberRole, MemberCollection
from .group_schedule import GroupSchedule, ScheduleCollection
from .incentive import (
    IncentiveTask, StockRecommendation, 
    LotteryRaffle, MonthlyDisbursement
)


def log_method_call(func):
    """Decorator for logging method calls."""
    def wrapper(*args, **kwargs):
        print(f"Calling method: {func.__name__}")
        return func(*args, **kwargs)
    return wrapper


class Company:
    """Represents a company group with members, schedules, and incentive programs."""
    
    def __init__(
        self,
        company_id: int,
        name: str,
        description: str = "",
        has_lottery: bool = False,
        has_raffle: bool = False,
        has_monthly_disbursement: bool = False
    ):
        self.company_id = company_id
        self.name = name
        self.description = description
        
        # Feature flags
        self._has_lottery = has_lottery
        self._has_raffle = has_raffle
        self._has_monthly_disbursement = has_monthly_disbursement
        
        # Collections
        self._members = MemberCollection()
        self._schedules = ScheduleCollection()
        self._incentive_tasks: List[IncentiveTask] = []
        self._stock_recommendations: List[StockRecommendation] = []
        self._lotteries: List[LotteryRaffle] = []
        self._raffles: List[LotteryRaffle] = []
        self._disbursements: List[MonthlyDisbursement] = []
        
        self._created_at = datetime.now()
    
    # --- Member Management ---
    @log_method_call
    def add_member(self, member: Member) -> None:
        """Add a member to the company."""
        self._members.add_member(member)
    
    @log_method_call
    def remove_member(self, member_id: int) -> bool:
        """Remove a member from the company."""
        return self._members.remove_member(member_id)
    
    def get_professors(self) -> List[Member]:
        """Get all professors/leaders."""
        return (
            self._members.get_by_role(MemberRole.PROFESSOR) +
            self._members.get_by_role(MemberRole.LEADER)
        )
    
    def get_assistants(self) -> List[Member]:
        """Get all assistants."""
        return self._members.get_by_role(MemberRole.ASSISTANT)
    
    def get_guest_speakers(self) -> List[Member]:
        """Get all guest speakers."""
        return self._members.get_by_role(MemberRole.GUEST_SPEAKER)
    
    def get_all_members(self) -> List[Member]:
        """Get all members."""
        return list(self._members)
    
    # --- Schedule Management ---
    @log_method_call
    def add_schedule(self, schedule: GroupSchedule) -> None:
        """Add a group schedule."""
        self._schedules.add_schedule(schedule)
    
    def get_schedules(self) -> List[GroupSchedule]:
        """Get all schedules."""
        return list(self._schedules)
    
    def get_active_schedules(self) -> List[GroupSchedule]:
        """Get active schedules."""
        return self._schedules.get_active_schedules()
    
    def has_weekend_meetings(self) -> bool:
        """Check if company has weekend meetings."""
        return len(self._schedules.get_weekend_schedules()) > 0
    
    # --- Incentive Management ---
    @log_method_call
    def add_incentive_task(self, task: IncentiveTask) -> None:
        """Add an incentive task."""
        self._incentive_tasks.append(task)
    
    def get_incentive_tasks(self) -> List[IncentiveTask]:
        """Get all incentive tasks."""
        return self._incentive_tasks
    
    def get_active_incentive_tasks(self) -> List[IncentiveTask]:
        """Get active incentive tasks."""
        return [t for t in self._incentive_tasks if t.is_active()]
    
    # --- Stock Recommendations ---
    @log_method_call
    def add_stock_recommendation(self, recommendation: StockRecommendation) -> None:
        """Add a stock recommendation."""
        self._stock_recommendations.append(recommendation)
    
    def get_stock_recommendations(self) -> List[StockRecommendation]:
        """Get all stock recommendations."""
        return self._stock_recommendations
    
    def get_incentive_stocks(self) -> List[StockRecommendation]:
        """Get stock recommendations with incentive rewards."""
        return [s for s in self._stock_recommendations if s.has_incentive()]
    
    # --- Lottery & Raffle ---
    @log_method_call
    def add_lottery(self, lottery: LotteryRaffle) -> None:
        """Add a lottery event."""
        if self._has_lottery:
            self._lotteries.append(lottery)
        else:
            print("Lottery feature is not enabled for this company.")
    
    @log_method_call
    def add_raffle(self, raffle: LotteryRaffle) -> None:
        """Add a raffle event."""
        if self._has_raffle:
            self._raffles.append(raffle)
        else:
            print("Raffle feature is not enabled for this company.")
    
    def get_lotteries(self) -> List[LotteryRaffle]:
        """Get all lotteries."""
        return self._lotteries if self._has_lottery else []
    
    def get_raffles(self) -> List[LotteryRaffle]:
        """Get all raffles."""
        return self._raffles if self._has_raffle else []
    
    # --- Monthly Disbursements ---
    @log_method_call
    def add_disbursement(self, disbursement: MonthlyDisbursement) -> None:
        """Add a monthly disbursement."""
        if self._has_monthly_disbursement:
            self._disbursements.append(disbursement)
        else:
            print("Monthly disbursement feature is not enabled for this company.")
    
    def get_disbursements(self) -> List[MonthlyDisbursement]:
        """Get all monthly disbursements."""
        return self._disbursements if self._has_monthly_disbursement else []
    
    # --- Feature Flags ---
    def enable_lottery(self) -> None:
        """Enable lottery feature."""
        self._has_lottery = True
    
    def enable_raffle(self) -> None:
        """Enable raffle feature."""
        self._has_raffle = True
    
    def enable_monthly_disbursement(self) -> None:
        """Enable monthly disbursement feature."""
        self._has_monthly_disbursement = True
    
    # --- Serialization ---
    def to_dict(self) -> dict:
        """Converts company to dictionary representation."""
        return {
            "company_id": self.company_id,
            "name": self.name,
            "description": self.description,
            "has_lottery": self._has_lottery,
            "has_raffle": self._has_raffle,
            "has_monthly_disbursement": self._has_monthly_disbursement,
            "members": [m.to_dict() for m in self._members],
            "schedules": [s.to_dict() for s in self._schedules],
            "incentive_tasks": [t.to_dict() for t in self._incentive_tasks],
            "stock_recommendations": [s.to_dict() for s in self._stock_recommendations],
            "lotteries": [l.to_dict() for l in self._lotteries],
            "raffles": [r.to_dict() for r in self._raffles],
            "disbursements": [d.to_dict() for d in self._disbursements],
            "created_at": self._created_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'Company':
        """Creates a Company instance from dictionary."""
        company = cls(
            company_id=data["company_id"],
            name=data["name"],
            description=data.get("description", ""),
            has_lottery=data.get("has_lottery", False),
            has_raffle=data.get("has_raffle", False),
            has_monthly_disbursement=data.get("has_monthly_disbursement", False)
        )
        
        # Load members
        for member_data in data.get("members", []):
            company.add_member(Member.from_dict(member_data))
        
        # Load schedules
        for schedule_data in data.get("schedules", []):
            company.add_schedule(GroupSchedule.from_dict(schedule_data))
        
        # Load incentive tasks
        for task_data in data.get("incentive_tasks", []):
            company._incentive_tasks.append(IncentiveTask.from_dict(task_data))
        
        # Load stock recommendations
        for rec_data in data.get("stock_recommendations", []):
            company._stock_recommendations.append(StockRecommendation.from_dict(rec_data))
        
        # Load lotteries
        for lottery_data in data.get("lotteries", []):
            company._lotteries.append(LotteryRaffle.from_dict(lottery_data))
        
        # Load raffles
        for raffle_data in data.get("raffles", []):
            company._raffles.append(LotteryRaffle.from_dict(raffle_data))
        
        # Load disbursements
        for disb_data in data.get("disbursements", []):
            company._disbursements.append(MonthlyDisbursement.from_dict(disb_data))
        
        if "created_at" in data:
            company._created_at = datetime.fromisoformat(data["created_at"])
        
        return company


class CompanyCollection:
    """A collection of companies that acts as an iterator."""
    
    def __init__(self):
        self._companies = []
    
    def add_company(self, company: Company) -> None:
        """Add a company to the collection."""
        self._companies.append(company)
    
    def get_company(self, company_id: int) -> Optional[Company]:
        """Get a company by ID."""
        for company in self._companies:
            if company.company_id == company_id:
                return company
        return None
    
    def remove_company(self, company_id: int) -> bool:
        """Remove a company by ID."""
        for i, company in enumerate(self._companies):
            if company.company_id == company_id:
                self._companies.pop(i)
                return True
        return False
    
    def __iter__(self):
        return iter(self._companies)
    
    def __len__(self):
        return len(self._companies)


def company_generator(collection: CompanyCollection):
    """A generator that yields each company from the collection."""
    for company in collection:
        yield company
