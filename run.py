from app import create_app
from app.models.project import Project

PROJECTS = [
    Project('7t', '7t/', 'Experimental text and alpha tools'),
    Project('best', 'best/', 'Best strategies and alpha'),
    Project('beta', 'beta/', 'Beta features and scripts'),
    Project('chat', 'chat/', 'Chat and indicators'),
    Project('chaturbate_app', 'chaturbate_app/', 'Chaturbate event handlers'),
    Project('church_school_lesson_plan', 'church_school_lesson_plan/', 'Church school lesson plans'),
    Project('csv', 'csv/', 'Stock CSV data'),
    Project('etrade_client', 'etrade_client/', 'Etrade API client'),
    Project('Gridiron', 'Gridiron/', 'Football analytics'),
    Project('jinx', 'jinx/', 'Jinx core'),
    Project('jinx_strategy', 'jinx_strategy/', 'Jinx strategies'),
    Project('jinxcasino', 'jinxcasino/', 'Jinx casino'),
    Project('json', 'json/', 'JSON data'),
    Project('link_indexer', 'link_indexer/', 'Link indexer'),
    Project('market', 'market/', 'Market tools'),
    Project('nfl', 'nfl/', 'NFL data'),
    Project('nfl_offensive_playbook', 'nfl_offensive_playbook/', 'NFL playbook'),
    Project('option', 'option/', 'Options tools'),
    Project('options', 'options/', 'Options strategies'),
    Project('pj', 'pj/', 'PJ tools'),
    Project('playbook', 'playbook/', 'Football playbook'),
    Project('playbook_app', 'playbook_app/', 'Playbook app'),
    Project('referrals', 'referrals/', 'Referral system'),
    Project('script', 'script/', 'Scripts'),
    Project('seventy', 'seventy/', 'Seventy tools'),
    Project('simple', 'simple/', 'Simple tools'),
    Project('stays', 'stays/', 'Stay management'),
    Project('stock', 'stock/', 'Stock tools'),
    Project('stock_analyzer', 'stock_analyzer/', 'Stock analyzer'),
    Project('stock_fetcher', 'stock_fetcher/', 'Stock fetcher'),
    Project('study', 'study/', 'Study tools'),
    Project('style', 'style/', 'Style resources'),
    Project('texas_holdem', 'texas_holdem/', 'Texas Holdem'),
    Project('ticker', 'ticker/', 'Ticker tools'),
    Project('tickers', 'tickers/', 'Tickers'),
    Project('Trades', 'Trades/', 'Trade logs'),
    Project('whatsapp_integration', 'whatsapp_integration/', 'WhatsApp integration'),
]

def inject_projects():
    return dict(projects=[p.to_dict() for p in PROJECTS])

app = create_app()
app.context_processor(inject_projects)

if __name__ == '__main__':
    app.run(debug=True)
