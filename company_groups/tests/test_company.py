"""
Unit tests for Company model
"""
import unittest
from datetime import time, date

from company_groups.src.company import Company, CompanyCollection, company_generator
from company_groups.src.member import Member, MemberRole
from company_groups.src.group_schedule import GroupSchedule, DayOfWeek
from company_groups.src.incentive import (
    IncentiveTask, IncentiveType, IncentiveFrequency,
    StockRecommendation, LotteryRaffle, MonthlyDisbursement
)


class TestCompany(unittest.TestCase):

    def setUp(self):
        """Set up test company."""
        self.company = Company(
            company_id=1,
            name="Test Company",
            description="A test company",
            has_lottery=True,
            has_raffle=True,
            has_monthly_disbursement=True
        )

    def test_company_creation(self):
        """Test creating a company."""
        self.assertEqual(self.company.company_id, 1)
        self.assertEqual(self.company.name, "Test Company")
        self.assertEqual(self.company.description, "A test company")

    def test_add_member(self):
        """Test adding a member to company."""
        member = Member(1, "Test User", "test@example.com", MemberRole.PROFESSOR)
        self.company.add_member(member)
        
        members = self.company.get_all_members()
        self.assertEqual(len(members), 1)
        self.assertEqual(members[0].name, "Test User")

    def test_get_members_by_role(self):
        """Test getting members by role."""
        self.company.add_member(Member(1, "Prof", "prof@test.com", MemberRole.PROFESSOR))
        self.company.add_member(Member(2, "Assist", "assist@test.com", MemberRole.ASSISTANT))
        self.company.add_member(Member(3, "Guest", "guest@test.com", MemberRole.GUEST_SPEAKER))
        
        professors = self.company.get_professors()
        self.assertEqual(len(professors), 1)
        
        assistants = self.company.get_assistants()
        self.assertEqual(len(assistants), 1)
        
        guests = self.company.get_guest_speakers()
        self.assertEqual(len(guests), 1)

    def test_add_schedule(self):
        """Test adding a schedule to company."""
        schedule = GroupSchedule(
            schedule_id=1,
            name="Morning Session",
            days=[DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY],
            start_time=time(9, 0),
            end_time=time(11, 0)
        )
        self.company.add_schedule(schedule)
        
        schedules = self.company.get_schedules()
        self.assertEqual(len(schedules), 1)

    def test_add_incentive_task(self):
        """Test adding an incentive task."""
        task = IncentiveTask(
            task_id=1,
            name="Daily Check-in",
            task_type=IncentiveType.CHECK_IN,
            reward_amount=5.0,
            frequency=IncentiveFrequency.DAILY
        )
        self.company.add_incentive_task(task)
        
        tasks = self.company.get_incentive_tasks()
        self.assertEqual(len(tasks), 1)

    def test_add_stock_recommendation(self):
        """Test adding a stock recommendation."""
        stock = StockRecommendation(
            recommendation_id=1,
            ticker="AAPL",
            company_name="Apple Inc.",
            recommendation_type="buy",
            incentive_reward=50.0
        )
        self.company.add_stock_recommendation(stock)
        
        stocks = self.company.get_stock_recommendations()
        self.assertEqual(len(stocks), 1)
        
        incentive_stocks = self.company.get_incentive_stocks()
        self.assertEqual(len(incentive_stocks), 1)

    def test_lottery_feature(self):
        """Test lottery feature."""
        lottery = LotteryRaffle(
            event_id=1,
            name="Test Lottery",
            event_type="lottery",
            prize_amount=1000.0,
            draw_date=date(2026, 12, 31)
        )
        self.company.add_lottery(lottery)
        
        lotteries = self.company.get_lotteries()
        self.assertEqual(len(lotteries), 1)

    def test_raffle_feature(self):
        """Test raffle feature."""
        raffle = LotteryRaffle(
            event_id=1,
            name="Test Raffle",
            event_type="raffle",
            prize_amount=250.0,
            draw_date=date(2026, 12, 31)
        )
        self.company.add_raffle(raffle)
        
        raffles = self.company.get_raffles()
        self.assertEqual(len(raffles), 1)

    def test_disbursement_feature(self):
        """Test monthly disbursement feature."""
        disbursement = MonthlyDisbursement(
            disbursement_id=1,
            name="Monthly Dividend",
            amount=100.0,
            day_of_month=15
        )
        self.company.add_disbursement(disbursement)
        
        disbursements = self.company.get_disbursements()
        self.assertEqual(len(disbursements), 1)

    def test_company_to_dict(self):
        """Test converting company to dictionary."""
        self.company.add_member(Member(1, "Test", "test@test.com", MemberRole.PROFESSOR))
        
        data = self.company.to_dict()
        
        self.assertEqual(data["company_id"], 1)
        self.assertEqual(data["name"], "Test Company")
        self.assertTrue(data["has_lottery"])
        self.assertEqual(len(data["members"]), 1)

    def test_company_from_dict(self):
        """Test creating company from dictionary."""
        data = {
            "company_id": 2,
            "name": "From Dict Company",
            "description": "Created from dict",
            "has_lottery": True,
            "has_raffle": False,
            "has_monthly_disbursement": True,
            "members": [],
            "schedules": [],
            "incentive_tasks": [],
            "stock_recommendations": [],
            "lotteries": [],
            "raffles": [],
            "disbursements": []
        }
        
        company = Company.from_dict(data)
        
        self.assertEqual(company.company_id, 2)
        self.assertEqual(company.name, "From Dict Company")


class TestCompanyCollection(unittest.TestCase):

    def test_collection_operations(self):
        """Test company collection operations."""
        collection = CompanyCollection()
        
        company1 = Company(1, "Company 1")
        company2 = Company(2, "Company 2")
        
        collection.add_company(company1)
        collection.add_company(company2)
        
        self.assertEqual(len(collection), 2)
        
        found = collection.get_company(1)
        self.assertIsNotNone(found)
        self.assertEqual(found.name, "Company 1")
        
        removed = collection.remove_company(1)
        self.assertTrue(removed)
        self.assertEqual(len(collection), 1)

    def test_company_generator(self):
        """Test company generator function."""
        collection = CompanyCollection()
        collection.add_company(Company(1, "A"))
        collection.add_company(Company(2, "B"))
        
        gen = company_generator(collection)
        self.assertEqual(next(gen).name, "A")
        self.assertEqual(next(gen).name, "B")


if __name__ == '__main__':
    unittest.main()
