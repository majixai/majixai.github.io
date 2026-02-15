"""
Flask application for Company Groups management
"""
from flask import Flask, jsonify, render_template, request
from datetime import time, date

from src.company import Company, CompanyCollection
from src.member import Member, MemberRole
from src.group_schedule import GroupSchedule, DayOfWeek
from src.incentive import (
    IncentiveTask, IncentiveType, IncentiveFrequency,
    StockRecommendation, LotteryRaffle, MonthlyDisbursement
)
from src.data_manager import CompanyDataManager

app = Flask(__name__, template_folder='templates', static_folder='static')

# Initialize data manager
data_manager = CompanyDataManager(data_dir='data')

# In-memory data store with sample data
companies_db = CompanyCollection()

# Create sample company
sample_company = Company(
    company_id=1,
    name="Alpha Trading Academy",
    description="Learn trading with professional educators",
    has_lottery=True,
    has_raffle=True,
    has_monthly_disbursement=True
)

# Add sample members
sample_company.add_member(Member(1, "Dr. John Smith", "john@example.com", MemberRole.PROFESSOR))
sample_company.add_member(Member(2, "Jane Doe", "jane@example.com", MemberRole.ASSISTANT))
sample_company.add_member(Member(3, "Mike Johnson", "mike@example.com", MemberRole.GUEST_SPEAKER))

# Add sample schedules
sample_company.add_schedule(GroupSchedule(
    schedule_id=1,
    name="Morning Session",
    days=[DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY],
    start_time=time(9, 0),
    end_time=time(11, 0),
    include_weekends=False
))

sample_company.add_schedule(GroupSchedule(
    schedule_id=2,
    name="Weekend Workshop",
    days=[DayOfWeek.SATURDAY],
    start_time=time(10, 0),
    end_time=time(14, 0),
    include_weekends=True
))

# Add sample incentive tasks
sample_company.add_incentive_task(IncentiveTask(
    task_id=1,
    name="Daily Check-in",
    task_type=IncentiveType.CHECK_IN,
    reward_amount=5.0,
    frequency=IncentiveFrequency.DAILY,
    links=["https://example.com/checkin"],
    description="Check in daily for rewards"
))

sample_company.add_incentive_task(IncentiveTask(
    task_id=2,
    name="Weekly Quiz",
    task_type=IncentiveType.QUIZ,
    reward_amount=25.0,
    frequency=IncentiveFrequency.WEEKLY,
    description="Complete weekly trading quiz"
))

sample_company.add_incentive_task(IncentiveTask(
    task_id=3,
    name="Homework Assignment",
    task_type=IncentiveType.HOMEWORK,
    reward_amount=15.0,
    frequency=IncentiveFrequency.DAILY,
    description="Complete daily homework"
))

sample_company.add_incentive_task(IncentiveTask(
    task_id=4,
    name="Vote for Top Stock",
    task_type=IncentiveType.VOTING,
    reward_amount=10.0,
    frequency=IncentiveFrequency.DAILY,
    links=["https://example.com/vote1", "https://example.com/vote2"],
    description="Vote for your favorite stock pick"
))

# Add stock recommendations
sample_company.add_stock_recommendation(StockRecommendation(
    recommendation_id=1,
    ticker="AAPL",
    company_name="Apple Inc.",
    recommendation_type="buy",
    incentive_reward=50.0,
    purchase_link="https://example.com/buy/aapl"
))

sample_company.add_stock_recommendation(StockRecommendation(
    recommendation_id=2,
    ticker="GOOGL",
    company_name="Alphabet Inc.",
    recommendation_type="hold",
    incentive_reward=0.0
))

# Add lottery
sample_company.add_lottery(LotteryRaffle(
    event_id=1,
    name="Monthly Jackpot",
    event_type="lottery",
    prize_amount=1000.0,
    draw_date=date(2026, 3, 1)
))

# Add raffle
sample_company.add_raffle(LotteryRaffle(
    event_id=2,
    name="Weekly Prize Draw",
    event_type="raffle",
    prize_amount=250.0,
    draw_date=date(2026, 2, 15)
))

# Add disbursement
sample_company.add_disbursement(MonthlyDisbursement(
    disbursement_id=1,
    name="Monthly Dividend",
    amount=100.0,
    day_of_month=15
))

companies_db.add_company(sample_company)


# --- Helper Functions ---
def company_to_dict(company: Company) -> dict:
    """Convert company to dictionary for JSON response."""
    return company.to_dict()


# --- Routes ---
@app.route('/')
def index():
    """Render main page."""
    return render_template('index.html')


@app.route('/api/companies', methods=['GET'])
def get_companies():
    """Get all companies."""
    companies_json = [company_to_dict(c) for c in companies_db]
    return jsonify(companies_json)


@app.route('/api/companies/<int:company_id>', methods=['GET'])
def get_company(company_id: int):
    """Get a specific company."""
    company = companies_db.get_company(company_id)
    if company:
        return jsonify(company_to_dict(company))
    return jsonify({"error": "Company not found"}), 404


@app.route('/api/companies', methods=['POST'])
def create_company():
    """Create a new company."""
    data = request.get_json()
    
    if not data or 'name' not in data:
        return jsonify({"error": "Company name is required"}), 400
    
    # Generate new company ID
    new_id = max([c.company_id for c in companies_db], default=0) + 1
    
    company = Company(
        company_id=new_id,
        name=data['name'],
        description=data.get('description', ''),
        has_lottery=data.get('has_lottery', False),
        has_raffle=data.get('has_raffle', False),
        has_monthly_disbursement=data.get('has_monthly_disbursement', False)
    )
    
    companies_db.add_company(company)
    
    # Save to compressed storage
    data_manager.save_company(company)
    
    return jsonify(company_to_dict(company)), 201


@app.route('/api/companies/<int:company_id>/members', methods=['GET'])
def get_company_members(company_id: int):
    """Get all members of a company."""
    company = companies_db.get_company(company_id)
    if not company:
        return jsonify({"error": "Company not found"}), 404
    
    members = [m.to_dict() for m in company.get_all_members()]
    return jsonify(members)


@app.route('/api/companies/<int:company_id>/members', methods=['POST'])
def add_company_member(company_id: int):
    """Add a member to a company."""
    company = companies_db.get_company(company_id)
    if not company:
        return jsonify({"error": "Company not found"}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "Member data required"}), 400
    
    try:
        member = Member(
            member_id=data['member_id'],
            name=data['name'],
            email=data['email'],
            role=MemberRole(data['role'])
        )
        company.add_member(member)
        return jsonify(member.to_dict()), 201
    except (KeyError, ValueError) as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/companies/<int:company_id>/schedules', methods=['GET'])
def get_company_schedules(company_id: int):
    """Get all schedules of a company."""
    company = companies_db.get_company(company_id)
    if not company:
        return jsonify({"error": "Company not found"}), 404
    
    schedules = [s.to_dict() for s in company.get_schedules()]
    return jsonify(schedules)


@app.route('/api/companies/<int:company_id>/incentives', methods=['GET'])
def get_company_incentives(company_id: int):
    """Get all incentive tasks of a company."""
    company = companies_db.get_company(company_id)
    if not company:
        return jsonify({"error": "Company not found"}), 404
    
    incentives = [t.to_dict() for t in company.get_incentive_tasks()]
    return jsonify(incentives)


@app.route('/api/companies/<int:company_id>/stocks', methods=['GET'])
def get_company_stocks(company_id: int):
    """Get all stock recommendations of a company."""
    company = companies_db.get_company(company_id)
    if not company:
        return jsonify({"error": "Company not found"}), 404
    
    stocks = [s.to_dict() for s in company.get_stock_recommendations()]
    return jsonify(stocks)


@app.route('/api/companies/<int:company_id>/lotteries', methods=['GET'])
def get_company_lotteries(company_id: int):
    """Get all lotteries of a company."""
    company = companies_db.get_company(company_id)
    if not company:
        return jsonify({"error": "Company not found"}), 404
    
    lotteries = [l.to_dict() for l in company.get_lotteries()]
    return jsonify(lotteries)


@app.route('/api/companies/<int:company_id>/raffles', methods=['GET'])
def get_company_raffles(company_id: int):
    """Get all raffles of a company."""
    company = companies_db.get_company(company_id)
    if not company:
        return jsonify({"error": "Company not found"}), 404
    
    raffles = [r.to_dict() for r in company.get_raffles()]
    return jsonify(raffles)


@app.route('/api/companies/<int:company_id>/disbursements', methods=['GET'])
def get_company_disbursements(company_id: int):
    """Get all monthly disbursements of a company."""
    company = companies_db.get_company(company_id)
    if not company:
        return jsonify({"error": "Company not found"}), 404
    
    disbursements = [d.to_dict() for d in company.get_disbursements()]
    return jsonify(disbursements)


@app.route('/api/companies/save', methods=['POST'])
def save_all_companies():
    """Save all companies to compressed storage."""
    companies_list = list(companies_db)
    metadata = data_manager.save_companies(companies_list)
    return jsonify({
        "message": "Companies saved successfully",
        "metadata": metadata
    })


@app.route('/api/companies/load', methods=['GET'])
def load_all_companies():
    """Load all companies from compressed storage."""
    companies_data = data_manager.load_companies()
    return jsonify({
        "message": f"Loaded {len(companies_data)} companies",
        "companies": companies_data
    })


if __name__ == '__main__':
    import os
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug_mode, port=5002)
