import json
import calendar

def generate_calendar_data(year, month):
    cal = calendar.monthcalendar(year, month)
    data = {
        'year': year,
        'month': month,
        'calendar': cal
    }
    with open('json/calendar.json', 'w') as f:
        json.dump(data, f, indent=4)

if __name__ == '__main__':
    import datetime
    today = datetime.date.today()
    generate_calendar_data(today.year, today.month)
